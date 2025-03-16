import { Request, Response, NextFunction } from 'express';
import { manager } from '../config/database';
import { isIPInRange, isIPInAnyRange } from '../utils/ipUtils';
import logger from '../config/logger';
import { SecurityAuditLog } from '../models';
import { AuthenticatedRequest } from '../types';
import { Result, success, failure, handleResult } from '../utils/errors';

interface TenantContext {
  id: string;
  db: any; // Database connection
}

interface IPRestrictions {
  enabled: boolean;
  allowedIPs: string[];
  allowedRanges: string[];
  blockList: string[];
}

/**
 * Get tenant ID from request (pure function)
 */
const getTenantId = (req: AuthenticatedRequest): Result<string> => {
  const tenantId = req.headers['x-tenant-id'] as string || req.user?.tenantId as string;
  
  if (!tenantId) {
    return failure({
      message: 'Tenant ID is required',
      statusCode: 400,
      code: 'MISSING_TENANT_ID'
    });
  }
  
  return success(tenantId);
};

/**
 * Get tenant connection from cache or database (async with Result pattern)
 */
const getTenantConnection = async (tenantId: string): Promise<Result<any>> => {
  try {
    // Get tenant connection from cache or database
    const redisClient = await manager.getRedisClient();
    const cacheKey = `tenant:${tenantId}`;
    
    const cachedTenant = await redisClient.get(cacheKey);
    if (cachedTenant) {
      const tenantDb = JSON.parse(cachedTenant);
      await redisClient.expire(cacheKey, 3600); // Refresh TTL
      return success(tenantDb);
    } 
    
    const tenantDb = await manager.getTenantConnection(tenantId);
    await redisClient.set(cacheKey, JSON.stringify(tenantDb), { EX: 3600 });
    return success(tenantDb);
  } catch (error) {
    logger.error('Tenant connection error:', error);
    return failure({
      message: 'Failed to connect to tenant database',
      statusCode: 503,
      code: 'DB_CONNECTION_ERROR',
      originalError: error instanceof Error ? error : new Error('Connection failed')
    });
  }
};

/**
 * Check if tenant is suspended (async with Result pattern)
 */
const checkTenantStatus = async (
  tenantDb: any, 
  tenantId: string
): Promise<Result<void>> => {
  try {
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    
    if (!tenant) {
      return failure({
        message: 'Tenant not found',
        statusCode: 404,
        code: 'TENANT_NOT_FOUND'
      });
    }
    
    if (tenant.status === 'suspended') {
      return failure({
        message: 'Tenant is suspended',
        statusCode: 403,
        code: 'TENANT_SUSPENDED'
      });
    }
    
    return success(undefined);
  } catch (error) {
    logger.error('Tenant status check error:', error);
    return failure({
      message: 'Failed to check tenant status',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Status check failed')
    });
  }
};

/**
 * Create a security audit log (async function)
 */
const createSecurityAuditLog = async (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  userId: string | undefined,
  details: Record<string, any>
): Promise<void> => {
  try {
    await SecurityAuditLog.create({
      userId,
      event,
      severity,
      details
    });
  } catch (error) {
    logger.error('Failed to create security audit log:', error);
  }
};

/**
 * Check IP restrictions (async with Result pattern)
 */
const checkIPRestrictions = async (
  req: AuthenticatedRequest,
  tenantId: string,
  ipRestrictions: IPRestrictions | undefined,
  redisClient: any
): Promise<Result<void>> => {
  if (!ipRestrictions?.enabled) {
    return success(undefined);
  }
  
  const clientIP = req.ip || req.connection.remoteAddress || '';
  const { allowedIPs, allowedRanges, blockList } = ipRestrictions;
  
  // Check block list first
  if (blockList.includes(clientIP)) {
    await createSecurityAuditLog(
      'IP_ACCESS_BLOCKED',
      'high',
      req.user?.id,
      { ip: clientIP, tenantId, reason: 'IP in block list' }
    );
    
    logger.warn('Blocked IP attempt', { ip: clientIP, tenantId });
    
    return failure({
      message: 'IP address is blocked',
      statusCode: 403,
      code: 'IP_BLOCKED'
    });
  }
  
  // Check if IP is explicitly allowed or in allowed ranges
  const isAllowed = allowedIPs.includes(clientIP) || 
                   isIPInAnyRange(clientIP, allowedRanges);
  
  if (!isAllowed) {
    await createSecurityAuditLog(
      'IP_ACCESS_DENIED',
      'medium',
      req.user?.id,
      { ip: clientIP, tenantId, reason: 'IP not in allowed list' }
    );
    
    logger.warn('Unauthorized IP attempt', { ip: clientIP, tenantId });
    
    return failure({
      message: 'IP address not allowed',
      statusCode: 403,
      code: 'IP_NOT_ALLOWED'
    });
  }
  
  // Log successful access from new IP
  const cacheKey = `ip:${clientIP}:tenant:${tenantId}`;
  const cached = await redisClient.get(cacheKey);
  
  if (!cached) {
    await createSecurityAuditLog(
      'NEW_IP_ACCESS',
      'low',
      req.user?.id,
      { ip: clientIP, tenantId }
    );
    
    await redisClient.set(cacheKey, '1', { EX: 86400 }); // Cache for 24 hours
  }
  
  return success(undefined);
};

/**
 * Handle database errors (pure function)
 */
const handleDatabaseError = (error: any): { statusCode: number; code: string; message: string } => {
  if (error.name === 'SequelizeConnectionError') {
    return { 
      statusCode: 503, 
      code: 'DB_CONNECTION_ERROR',
      message: 'Database connection failed'
    };
  }
  
  if (error.name === 'SequelizeTimeoutError') {
    return { 
      statusCode: 504, 
      code: 'DB_TIMEOUT_ERROR',
      message: 'Database request timed out'
    };
  }
  
  return { 
    statusCode: 500, 
    code: 'INTERNAL_ERROR',
    message: 'Internal server error'
  };
};

/**
 * Tenant context middleware
 */
const tenantContextMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Get tenant ID
    const tenantIdResult = getTenantId(req as AuthenticatedRequest);
    
    if (!tenantIdResult.ok) {
      return res.status(tenantIdResult.error.statusCode).json({ 
        error: tenantIdResult.error.message,
        code: tenantIdResult.error.code
      });
    }
    
    const tenantId = tenantIdResult.value;
    
    // Get tenant connection
    const connectionResult = await getTenantConnection(tenantId);
    
    if (!connectionResult.ok) {
      return res.status(connectionResult.error.statusCode).json({ 
        error: connectionResult.error.message,
        code: connectionResult.error.code
      });
    }
    
    const tenantDb = connectionResult.value;
    
    // Set tenant context
    (req as AuthenticatedRequest).tenant = {
      id: tenantId,
      db: tenantDb
    };
    
    // Check tenant status
    const statusResult = await checkTenantStatus(tenantDb, tenantId);
    
    if (!statusResult.ok) {
      return res.status(statusResult.error.statusCode).json({ 
        error: statusResult.error.message,
        code: statusResult.error.code
      });
    }
    
    // Get tenant for security checks
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    
    // Check IP restrictions
    const redisClient = await manager.getRedisClient();
    const ipResult = await checkIPRestrictions(
      req as AuthenticatedRequest,
      tenantId,
      tenant.securityPolicy?.ipRestrictions,
      redisClient
    );
    
    if (!ipResult.ok) {
      return res.status(ipResult.error.statusCode).json({ 
        error: ipResult.error.message,
        code: ipResult.error.code
      });
    }
    
    next();
  } catch (error) {
    logger.error('Tenant context error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: (req.headers['x-tenant-id'] as string)
    });
    
    const errorInfo = handleDatabaseError(error);
    
    res.status(errorInfo.statusCode).json({
      error: errorInfo.message,
      code: errorInfo.code
    });
  }
};

export default tenantContextMiddleware;