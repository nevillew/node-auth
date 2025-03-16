import { Sequelize } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Result, success, failure } from '../utils/errors';
import { TenantAttributes } from '../types';
import logger from '../config/logger';

// We'll need to convert the database manager to TypeScript later
// For now, we'll import it as a require
const { manager } = require('../config/database');

// Types for tenant service
interface TenantConnection {
  models: {
    Tenant: any;
    User: any;
    [key: string]: any;
  };
  transaction: () => Promise<any>;
}

/**
 * Get a tenant connection
 */
const getTenantConnection = async (tenantId: string): Promise<Result<TenantConnection>> => {
  return fromPromise(
    manager.getTenantConnection(tenantId),
    'tenantService.getTenantConnection'
  ).catch(err => {
    logger.error('Error getting tenant connection:', { error: err, tenantId });
    return failure<TenantConnection>({
      message: 'Failed to connect to tenant database',
      statusCode: 500,
      code: ErrorCode.DB_CONNECTION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  });
};

/**
 * Suspend a tenant
 */
export const suspendTenant = async (tenantId: string): Promise<Result<void>> => {
  // Get tenant connection
  const connectionResult = await getTenantConnection(tenantId);
  if (!connectionResult.ok) return connectionResult;
  
  const tenantDb = connectionResult.value;
  
  // Use withTransaction to handle transaction lifecycle
  return withTransaction(async (t) => {
    try {
      // Update tenant status
      await tenantDb.models.Tenant.update(
        { status: 'suspended' },
        { 
          where: { id: tenantId },
          transaction: t
        }
      );
  
      // Disable user logins
      await tenantDb.models.User.update(
        { isActive: false },
        { 
          where: { tenantId },
          transaction: t
        }
      );
  
      // Log the suspension action
      await tenantDb.models.SecurityAuditLog.create({
        id: uuidv4(),
        userId: 'system',
        event: 'TENANT_SUSPENDED',
        details: {
          tenantId,
          timestamp: new Date()
        },
        severity: 'high'
      }, { transaction: t });
  
      return success(undefined);
    } catch (err) {
      logger.error('Failed to suspend tenant:', { error: err, tenantId });
      return failure({
        message: 'Failed to suspend tenant',
        statusCode: 500,
        code: ErrorCode.TRANSACTION_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  });
};

/**
 * Reactivate a suspended tenant
 */
export const reactivateTenant = async (tenantId: string): Promise<Result<void>> => {
  // Get tenant connection
  const connectionResult = await getTenantConnection(tenantId);
  if (!connectionResult.ok) return connectionResult;
  
  const tenantDb = connectionResult.value;
  
  // Use withTransaction to handle transaction lifecycle
  return withTransaction(async (t) => {
    try {
      // Update tenant status
      await tenantDb.models.Tenant.update(
        { status: 'active' },
        { 
          where: { id: tenantId },
          transaction: t
        }
      );
  
      // Re-enable user logins
      await tenantDb.models.User.update(
        { isActive: true },
        { 
          where: { tenantId },
          transaction: t
        }
      );
  
      // Log the reactivation action
      await tenantDb.models.SecurityAuditLog.create({
        id: uuidv4(),
        userId: 'system',
        event: 'TENANT_REACTIVATED',
        details: {
          tenantId,
          timestamp: new Date()
        },
        severity: 'medium'
      }, { transaction: t });
  
      return success(undefined);
    } catch (err) {
      logger.error('Failed to reactivate tenant:', { error: err, tenantId });
      return failure({
        message: 'Failed to reactivate tenant',
        statusCode: 500,
        code: ErrorCode.TRANSACTION_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  });
};

/**
 * Get tenant details by ID
 */
export const getTenantById = async (tenantId: string): Promise<Result<TenantAttributes>> => {
  // Get tenant connection using chainResult for functional flow
  return getTenantConnection(tenantId)
    .then(connectionResult => 
      chainResult(connectionResult, async (tenantDb) => {
        try {
          const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
          
          if (!tenant) {
            return failure({
              message: 'Tenant not found',
              statusCode: 404,
              code: ErrorCode.RESOURCE_NOT_FOUND
            });
          }
          
          return success(tenant.toJSON() as TenantAttributes);
        } catch (err) {
          logger.error('Error fetching tenant:', { error: err, tenantId });
          return failure({
            message: 'Error fetching tenant',
            statusCode: 500,
            code: ErrorCode.DATABASE_ERROR,
            originalError: err instanceof Error ? err : new Error('Unknown error')
          });
        }
      })
    );
};
