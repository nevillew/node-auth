import { Model, FindOptions, Sequelize, DataTypes } from 'sequelize';
import { TenantContext } from '../middleware/tenant-context';

export class BaseModel extends Model {
  public id!: string;
  public tenantId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt!: Date | null;
  public version!: number;
  public createdBy?: string;
  public updatedBy?: string;

  static addTenantScope(): void {
    this.addScope('tenant', {
      where: {
        tenantId: TenantContext.getCurrentTenant()
      }
    });

    // Add default scope for soft deletes
    this.addScope('defaultScope', {
      where: {
        deletedAt: null
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
    
    // Set audit fields
    instance.version = 1;
    instance.createdBy = TenantContext.getCurrentUser()?.id;
  }

  static beforeUpdate(instance: any): void {
    // Increment version
    instance.version += 1;
    instance.updatedBy = TenantContext.getCurrentUser()?.id;
  }

  static initModel(sequelize: Sequelize): void {
    this.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true
      },
      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true
      }
    }, {
      sequelize,
      paranoid: true,
      timestamps: true,
      hooks: {
        beforeFind: this.beforeFind,
        beforeCreate: this.beforeCreate,
        beforeUpdate: this.beforeUpdate
      }
    });

    this.addTenantScope();
  }
}
