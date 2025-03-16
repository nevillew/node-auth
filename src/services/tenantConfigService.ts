import { Result, success, failure, ErrorCode } from '../utils/errors';
import logger from '../config/logger';

// Import the manager with proper typing
import { manager } from '../config/database';

// Types for tenant config
interface TenantConnection {
  models: {
    Tenant: any;
    [key: string]: any;
  };
}

// Type for tenant configuration
interface TenantConfig {
  [key: string]: unknown;
}

// Type for feature flags
interface FeatureFlags {
  [key: string]: boolean;
}

/**
 * Get a tenant connection
 */
const getTenantConnection = async (tenantId: string): Promise<Result<TenantConnection>> => {
  try {
    const tenantDb = await manager.getTenantConnection(tenantId);
    return success(tenantDb);
  } catch (err) {
    logger.error('Error getting tenant connection:', { error: err, tenantId });
    return failure({
      message: 'Failed to connect to tenant database',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Get tenant configuration
 */
export const getConfig = async (tenantId: string): Promise<Result<TenantConfig>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    
    if (!tenant) {
      return failure({
        message: 'Tenant not found',
        statusCode: 404
      });
    }
    
    return success(tenant.settings as TenantConfig);
  } catch (err) {
    logger.error('Error getting tenant config:', { error: err, tenantId });
    return failure({
      message: 'Error retrieving tenant configuration',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Update tenant configuration
 */
export const updateConfig = async (
  tenantId: string, 
  config: Record<string, any>
): Promise<Result<boolean>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    
    await tenantDb.models.Tenant.update(
      { settings: config },
      { where: { id: tenantId } }
    );
    
    return success(true);
  } catch (err) {
    logger.error('Error updating tenant config:', { error: err, tenantId });
    return failure({
      message: 'Error updating tenant configuration',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Get tenant feature flags
 */
export const getFeatureFlags = async (tenantId: string): Promise<Result<FeatureFlags>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    
    if (!tenant) {
      return failure({
        message: 'Tenant not found',
        statusCode: 404
      });
    }
    
    return success(tenant.featureFlags as FeatureFlags);
  } catch (err) {
    logger.error('Error getting tenant feature flags:', { error: err, tenantId });
    return failure({
      message: 'Error retrieving tenant feature flags',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Update tenant feature flags
 */
export const updateFeatureFlags = async (
  tenantId: string, 
  flags: Record<string, boolean>
): Promise<Result<boolean>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    
    await tenantDb.models.Tenant.update(
      { featureFlags: flags },
      { where: { id: tenantId } }
    );
    
    return success(true);
  } catch (err) {
    logger.error('Error updating tenant feature flags:', { error: err, tenantId });
    return failure({
      message: 'Error updating tenant feature flags',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};
