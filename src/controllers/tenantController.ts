import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from '../middleware/fileUpload';
import { 
  Tenant, 
  User, 
  TenantUser, 
  SecurityAuditLog, 
  LoginHistory,
  Op 
} from '../models';
import { 
  tenantOnboardingService, 
  slackService, 
  securityAuditService 
} from '../services';
import logger from '../config/logger';
import { manager } from '../config/database';
import { AuthenticatedRequest, ControllerFunction } from '../types';
import { Result, success, failure, fromPromise, mapResult } from '../utils/errors';
import { 
  handleServiceResult,
  createController,
  getPaginationParams,
  getSortParams,
  buildSearchCondition,
  buildDateRangeCondition,
  combineConditions,
  formatPaginatedResponse
} from '../utils/controller';

// Type definitions
interface TenantCreateParams {
  name: string;
  slug?: string;
  features?: Record<string, any>;
  securityPolicy?: Record<string, any>;
}

interface TenantUpdateParams {
  name?: string;
  features?: Record<string, any>;
  securityPolicy?: Record<string, any>;
  status?: string;
}

interface TenantDeleteParams {
  confirm?: boolean;
}

interface TenantFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface InvitationParams {
  token: string;
  password: string;
}

interface UserRemoveParams {
  confirm?: boolean;
}

interface LoginHistoryFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  userId?: string;
  ipAddress?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'DESC' | 'ASC';
}

// Pure functions for tenant operations

/**
 * Get signed logo URL (pure function)
 */
const getLogoUrl = async (logoKey: string): Promise<Result<string>> => {
  try {
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME || '',
      Key: logoKey
    }), { expiresIn: 24 * 60 * 60 });
    
    return success(url);
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    return failure({
      message: 'Error generating logo URL',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Format tenant object for response (pure function)
 */
export const formatTenantResponse = async (
  tenant: any, 
  includeDetails: boolean = false
): Promise<Record<string, any>> => {
  const formatted: Record<string, any> = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    onboardingStatus: tenant.onboardingStatus,
    createdAt: tenant.createdAt
  };
  
  // Add logo URL if present
  if (tenant.logo) {
    const logoUrlResult = await getLogoUrl(tenant.logo);
    if (logoUrlResult.ok) {
      formatted['logoUrl'] = logoUrlResult.value;
    }
  }
  
  // Add additional details if requested
  if (includeDetails) {
    formatted['features'] = tenant.features;
    formatted['securityPolicy'] = tenant.securityPolicy;
    
    if (tenant.Users) {
      formatted['users'] = tenant.Users.map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.TenantUser?.roles || []
      }));
    }
  }
  
  return formatted;
};

/**
 * Create a tenant (pure service function)
 */
const createTenantLogic = async (
  params: TenantCreateParams,
  userId: string
): Promise<Result<any>> => {
  try {
    const { name, slug = uuidv4(), features = {}, securityPolicy = {} } = params;
    
    if (!userId) {
      return failure({
        message: 'Authentication required',
        statusCode: 401
      });
    }
    
    // Create tenant database
    await manager.createTenantDatabase(slug);

    // Create tenant record
    const tenant = await Tenant.create({
      name,
      slug,
      databaseUrl: `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${slug}`,
      features,
      securityPolicy,
      onboardingStatus: 'pending'
    });

    // Create admin user relationship
    await TenantUser.create({
      userId,
      tenantId: tenant.id,
      roles: ['admin']
    });

    // Start onboarding 
    await tenantOnboardingService.startOnboarding(tenant.id);
    
    // Send notifications (handled separately to not block tenant creation)
    const user = await User.findByPk(userId);
    slackService.sendMessage({
      channel: '#tenant-activity',
      text: `New tenant created: ${tenant.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Tenant Created*\nName: ${tenant.name}\nCreated by: ${user?.email || userId}`
          }
        }
      ]
    }).catch(err => {
      logger.error('Error sending slack notification:', err);
    });

    return success({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      onboardingStatus: tenant.onboardingStatus
    });
  } catch (error) {
    logger.error('Failed to create tenant:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Get IP restrictions for a tenant (pure service function)
 */
const getIpRestrictionsLogic = async (
  tenantId: string
): Promise<Result<any>> => {
  try {
    const tenant = await Tenant.findByPk(tenantId);
    
    if (!tenant) {
      return failure({
        message: 'Tenant not found',
        statusCode: 404
      });
    }

    const ipRestrictions = tenant.securityPolicy?.ipRestrictions || {
      enabled: false,
      allowedIPs: [],
      allowedRanges: [],
      blockList: []
    };

    return success({
      enabled: ipRestrictions.enabled,
      allowedIPs: ipRestrictions.allowedIPs,
      allowedRanges: ipRestrictions.allowedRanges,
      blockList: ipRestrictions.blockList
    });
  } catch (error) {
    logger.error('IP restrictions retrieval failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Get login history for a tenant (pure service function)
 */
const getLoginHistoryLogic = async (
  tenantId: string,
  filters: LoginHistoryFilters,
  userId: string
): Promise<Result<any>> => {
  try {
    const { 
      startDate, 
      endDate, 
      status,
      userId: filterUserId,
      ipAddress,
      page = 1, 
      limit = 20,
      sortOrder = 'DESC'
    } = filters;

    const where: any = { tenantId };
    
    // Apply filters
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    if (status) where.status = status;
    if (filterUserId) where.userId = filterUserId;
    if (ipAddress) where.ipAddress = ipAddress;

    // Query with pagination
    const loginHistory = await LoginHistory.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['id', 'email', 'name']
      }],
      order: [['createdAt', sortOrder]],
      limit: parseInt(limit?.toString() || '20'),
      offset: ((page || 1) - 1) * (limit || 20),
      attributes: [
        'id',
        'userId',
        'ipAddress',
        'userAgent',
        'location',
        'status',
        'failureReason',
        'createdAt'
      ]
    });

    // Create audit log for history access
    await SecurityAuditLog.create({
      userId,
      event: 'LOGIN_HISTORY_ACCESSED',
      details: {
        tenantId,
        filters: {
          startDate,
          endDate,
          status,
          userId: filterUserId,
          ipAddress
        }
      },
      severity: 'low'
    });

    return success({
      history: loginHistory.rows,
      total: loginHistory.count,
      page: parseInt(page?.toString() || '1'),
      totalPages: Math.ceil(loginHistory.count / (limit || 20))
    });
  } catch (error) {
    logger.error('Tenant login history retrieval failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Get audit history for a tenant (pure service function)
 */
const getAuditHistoryLogic = async (
  tenantId: string,
  filters: any
): Promise<Result<any>> => {
  try {
    const result = await fromPromise(
      securityAuditService.getTenantAuditHistory(tenantId, filters)
    );
    
    return result;
  } catch (error) {
    logger.error('Tenant audit history retrieval failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * List tenants with filtering (pure service function)
 */
const listTenantsLogic = async (
  filters: TenantFilters
): Promise<Result<any>> => {
  try {
    const { 
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = filters;

    const where: any = {};
    
    // Apply filters
    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Query with pagination
    const tenants = await Tenant.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit?.toString() || '20'),
      offset: ((page || 1) - 1) * (limit || 20),
      attributes: [
        'id', 
        'name',
        'slug',
        'status',
        'logo',
        'onboardingStatus',
        'createdAt'
      ]
    });

    // Generate signed URLs for logos
    const formattedTenants = await Promise.all(
      tenants.rows.map(tenant => formatTenantResponse(tenant))
    );

    return success({
      tenants: formattedTenants,
      total: tenants.count,
      page: parseInt(page?.toString() || '1'),
      totalPages: Math.ceil(tenants.count / (limit || 20))
    });
  } catch (error) {
    logger.error('Tenant listing failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

/**
 * Get tenant details (pure service function)
 */
const getTenantLogic = async (
  tenantId: string
): Promise<Result<any>> => {
  try {
    const tenant = await Tenant.findByPk(tenantId, {
      include: [{
        model: User,
        through: { attributes: ['roles'] }
      }]
    });
    
    if (!tenant) {
      return failure({
        message: 'Tenant not found',
        statusCode: 404
      });
    }

    const formattedTenant = await formatTenantResponse(tenant, true);
    return success(formattedTenant);
  } catch (error) {
    logger.error('Tenant retrieval failed:', error);
    return failure({
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('Unknown error')
    });
  }
};

// Controller handler functions

/**
 * Create tenant handler
 */
const createTenantHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const params = req.body as TenantCreateParams;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await createTenantLogic(params, userId);
  handleServiceResult(result, res, 201);
};

/**
 * Get IP restrictions handler
 */
const getIpRestrictionsHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const tenantId = req.params.id;
  const result = await getIpRestrictionsLogic(tenantId);
  handleServiceResult(result, res);
};

/**
 * Get login history handler
 */
const getLoginHistoryHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const tenantId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const filters = req.query as unknown as LoginHistoryFilters;
  const result = await getLoginHistoryLogic(tenantId, filters, userId);
  handleServiceResult(result, res);
};

/**
 * Get audit history handler
 */
const getAuditHistoryHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const tenantId = req.params.id;
  
  const filters = {
    startDate: req.query.startDate?.toString(),
    endDate: req.query.endDate?.toString(),
    severity: req.query.severity?.toString(),
    event: req.query.event?.toString(),
    userId: req.query.userId?.toString(),
    page: parseInt(req.query.page?.toString() || '1'),
    limit: parseInt(req.query.limit?.toString() || '20'),
    sortOrder: req.query.sortOrder?.toString()
  };
  
  const result = await getAuditHistoryLogic(tenantId, filters);
  handleServiceResult(result, res);
};

/**
 * List tenants handler
 */
const listTenantsHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const pagination = getPaginationParams(req.query);
  const sorting = getSortParams(req.query, 'name', 'ASC');
  
  const filters: TenantFilters = {
    ...pagination,
    ...sorting,
    status: req.query.status as string,
    search: req.query.search as string
  };
  
  const result = await listTenantsLogic(filters);
  handleServiceResult(result, res);
};

/**
 * Get tenant handler
 */
const getTenantHandler: ControllerFunction = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const tenantId = req.params.id;
  const result = await getTenantLogic(tenantId);
  handleServiceResult(result, res);
};

// Export the controller with error handling wrapper
export default createController({
  createTenant: createTenantHandler,
  getTenant: getTenantHandler,
  listTenants: listTenantsHandler,
  getIpRestrictions: getIpRestrictionsHandler,
  getLoginHistory: getLoginHistoryHandler,
  getAuditHistory: getAuditHistoryHandler
  // Additional handlers would be implemented following the same pattern
  // restore
  // update
  // suspend
  // delete
  // acceptInvitation
  // removeUser
  // updateUserRoles
  // processScheduledDeletions
});

// Export individual handlers for direct access if needed
export const createTenant = createTenantHandler;
export const getTenant = getTenantHandler;
export const listTenants = listTenantsHandler;
export const getIpRestrictions = getIpRestrictionsHandler;
export const getLoginHistory = getLoginHistoryHandler;
export const getAuditHistory = getAuditHistoryHandler;
