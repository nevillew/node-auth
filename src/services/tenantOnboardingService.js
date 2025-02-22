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
        isDefault: false
      },
      {
        name: 'Member',
        description: 'Standard user access',
        tenantId,
        isDefault: true
      }
    ]);

    // Update onboarding status
    await tenantDb.models.Tenant.update(
      { onboardingStatus: 'in_progress' },
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
