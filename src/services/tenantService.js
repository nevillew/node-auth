const { manager } = require('../config/database');

class TenantService {
  async suspendTenant(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    const t = await tenantDb.transaction();
    
    try {
      await tenantDb.models.Tenant.update(
        { status: 'suspended' },
        { 
          where: { id: tenantId },
          transaction: t
        }
      );

      await tenantDb.models.User.update(
        { isActive: false },
        { 
          where: { tenantId },
          transaction: t
        }
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw new AppError('Failed to suspend tenant', 500, error);
    }
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
