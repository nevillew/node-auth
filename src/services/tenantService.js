const { manager } = require('../config/database');

class TenantService {
  async suspendTenant(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
    await tenantDb.models.Tenant.update(
      { status: 'suspended' },
      { where: { id: tenantId } }
    );

    // Optionally: Disable user logins
    await tenantDb.models.User.update(
      { isActive: false },
      { where: { tenantId } }
    );
  }

  async reactivateTenant(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
    await tenantDb.models.Tenant.update(
      { status: 'active' },
      { where: { id: tenantId } }
    );

    // Re-enable user logins
    await tenantDb.models.User.update(
      { isActive: true },
      { where: { tenantId } }
    );
  }
}

module.exports = new TenantService();
