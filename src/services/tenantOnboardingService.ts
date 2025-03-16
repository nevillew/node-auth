import { Result, success, failure, ErrorCode } from '../utils/errors';
import logger from '../config/logger';
import * as emailService from './emailService';
import { DatabaseManager } from '../config/database';

// Import the manager with proper typing
import { manager } from '../config/database';

// Types for tenant onboarding service
interface TenantConnection {
  models: {
    Role: any;
    Tenant: any;
    User: any;
    [key: string]: any;
  };
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
 * Start the tenant onboarding process
 */
export const startOnboarding = async (tenantId: string): Promise<Result<boolean>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    
    // Create default roles
    await tenantDb.models.Role.bulkCreate([
      {
        name: 'Admin',
        description: 'Full access to all features',
        tenantId,
        isDefault: false,
        scopes: ['read', 'write', 'delete', 'admin']
      },
      {
        name: 'Member',
        description: 'Standard user access',
        tenantId,
        isDefault: true,
        scopes: ['read', 'write']
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        tenantId,
        isDefault: false,
        scopes: ['read']
      }
    ]);

    // Create default security policy
    await tenantDb.models.Tenant.update(
      { 
        onboardingStatus: 'in_progress',
        securityPolicy: {
          session: {
            maxConcurrentSessions: 3,
            sessionTimeout: 3600,
            extendOnActivity: true,
            requireMFA: false
          }
        }
      },
      { where: { id: tenantId } }
    );

    // Send welcome email to admin
    const adminUser = await tenantDb.models.User.findOne({
      where: { tenantId },
      order: [['createdAt', 'ASC']]
    });

    if (adminUser) {
      await emailService.sendWelcomeEmail(
        adminUser.email,
        adminUser.name
      );
    }
    
    return success(true);
  } catch (err) {
    logger.error('Error starting tenant onboarding:', { error: err, tenantId });
    return failure({
      message: 'Failed to start tenant onboarding',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Complete the tenant onboarding process
 */
export const completeOnboarding = async (tenantId: string): Promise<Result<boolean>> => {
  try {
    const connectionResult = await getTenantConnection(tenantId);
    if (!connectionResult.ok) {
      return connectionResult;
    }
    
    const tenantDb = connectionResult.value;
    
    await tenantDb.models.Tenant.update(
      { onboardingStatus: 'completed' },
      { where: { id: tenantId } }
    );
    
    return success(true);
  } catch (err) {
    logger.error('Error completing tenant onboarding:', { error: err, tenantId });
    return failure({
      message: 'Failed to complete tenant onboarding',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};
