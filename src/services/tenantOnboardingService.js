const { manager } = require('../config/database');
const emailService = require('./emailService');

class TenantOnboardingService {
  async startOnboarding(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
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
          password: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            preventPasswordReuse: 3,
            expiryDays: 90
          },
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

    // Send welcome email
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
  }

  async completeOnboarding(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
    await tenantDb.models.Tenant.update(
      { onboardingStatus: 'completed' },
      { where: { id: tenantId } }
    );
  }
}

module.exports = new TenantOnboardingService();
