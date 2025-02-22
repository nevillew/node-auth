const { manager } = require('../config/database');

class TenantConfigService {
  async getConfig(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    return tenant.settings;
  }

  async updateConfig(tenantId, config) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
    await tenantDb.models.Tenant.update(
      { settings: config },
      { where: { id: tenantId } }
    );
  }

  async getFeatureFlags(tenantId) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    return tenant.featureFlags;
  }

  async updateFeatureFlags(tenantId, flags) {
    const tenantDb = await manager.getTenantConnection(tenantId);
    
    await tenantDb.models.Tenant.update(
      { featureFlags: flags },
      { where: { id: tenantId } }
    );
  }
}

module.exports = new TenantConfigService();
