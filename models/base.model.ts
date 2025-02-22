import { Model, FindOptions, Sequelize, DataTypes } from 'sequelize';
import { TenantContext } from '../middleware/tenant-context';

export class BaseModel extends Model {
  static addTenantScope(): void {
    this.addScope('tenant', {
      where: {
        tenantId: TenantContext.getCurrentTenant()
      }
    });
  }

  static beforeFind(options: FindOptions): void {
    const tenantId = TenantContext.getCurrentTenant();
    if (!tenantId) return;

    if (!options.where) {
      options.where = {};
    }

    // Add tenant filter
    (options.where as any).tenantId = tenantId;
  }

  static beforeCreate(instance: any): void {
    const tenantId = TenantContext.getCurrentTenant();
    if (tenantId) {
      instance.tenantId = tenantId;
    }
  }
}
