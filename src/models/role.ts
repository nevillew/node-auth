import { DataTypes, Sequelize, Optional } from 'sequelize';
import { RoleAttributes, ModelRegistry, AssociableModel } from '../types';
import { createModelDefiner } from '../utils/modelFactory';

/**
 * Interface for Role creation attributes (with optional fields for creation)
 */
type RoleCreationAttributes = Optional<
  RoleAttributes,
  | 'id'
  | 'scopes'
  | 'isSystem'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Known scopes in the system - in a real app, this would be imported from a central location
 */
export enum SystemScopes {
  ADMIN = 'admin',
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  ROLE_READ = 'role:read',
  ROLE_WRITE = 'role:write',
  ROLE_DELETE = 'role:delete',
  TENANT_READ = 'tenant:read',
  TENANT_WRITE = 'tenant:write',
  TENANT_DELETE = 'tenant:delete',
  AUDIT_READ = 'audit:read',
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',
}

/**
 * Pure function to validate scopes against known system scopes and format rules
 */
const validateScopes = (scopes: string[]): boolean => {
  // Check if it's a valid array
  if (!Array.isArray(scopes)) return false;
  
  // Validate scope format
  return scopes.every(scope => 
    typeof scope === 'string' && 
    scope.trim().length > 0 && 
    /^[a-z0-9:_-]+$/i.test(scope)
  );
};

/**
 * Basic role associations that connect to main entity relationships
 */
const defineBasicRoleAssociations = (models: ModelRegistry): void => {
  models.Role.belongsTo(models.Tenant);
  
  models.Role.belongsToMany(models.User, {
    through: models.UserRole,
    foreignKey: 'roleId',
  });
  
  models.Role.belongsToMany(models.Permission, {
    through: models.RolePermission,
    foreignKey: 'roleId',
  });
};

/**
 * Add model methods and additional functionality
 * This demonstrates functional composition by extending the model in a separate function
 */
const extendRoleModel = (model: AssociableModel<RoleAttributes, RoleCreationAttributes>) => {
  // Static methods
  model.getSystemRoles = async (): Promise<AssociableModel<RoleAttributes>[]> => {
    return model.findAll({
      where: {
        isSystem: true
      }
    });
  };

  // Instance methods
  model.prototype.hasScope = function(scope: string): boolean {
    return this.scopes.includes(scope);
  };

  model.prototype.hasAllScopes = function(scopes: string[]): boolean {
    return scopes.every(scope => this.scopes.includes(scope));
  };

  model.prototype.hasAnyScope = function(scopes: string[]): boolean {
    return scopes.some(scope => this.scopes.includes(scope));
  };
  
  return model;
};

/**
 * Role model definition using the higher-order function pattern
 * 
 * This example demonstrates our new createModelDefiner factory
 * which provides a consistent pattern for model definition
 * and handles common boilerplate.
 * 
 * Benefits of this approach:
 * - Separation of concerns (attributes, options, associations)
 * - Improved code organization with pure functions
 * - Consistent type safety
 * - Reduced boilerplate with factory pattern
 */
export const defineRoleModel = (sequelize: Sequelize) => {
  // Create the base model using our factory
  const baseModel = createModelDefiner<RoleAttributes, RoleCreationAttributes>({
    name: 'Role',
    attributes: {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 50]
        }
      },
      description: {
        type: DataTypes.TEXT,
        validate: {
          len: [0, 1000]
        }
      },
      scopes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        validate: {
          isValidScopes(value: string[]): void {
            if (!validateScopes(value)) {
              throw new Error('One or more invalid scopes provided');
            }
          },
        },
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Tenants',
          key: 'id',
        },
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    options: {
      modelName: 'Role',
      tableName: 'Roles',
      timestamps: true,
      indexes: [
        {
          name: 'role_tenant_name_unique',
          unique: true,
          fields: ['tenantId', 'name'],
          where: {
            tenantId: { [DataTypes.Op.ne]: null }
          }
        },
        {
          name: 'system_role_name_unique',
          unique: true,
          fields: ['name'],
          where: {
            isSystem: true
          }
        }
      ],
      hooks: {
        // Prevent modification of system roles by non-admin users
        beforeUpdate: (role, options: any) => {
          const changed = role.changed();
          if (changed && role.getDataValue('isSystem') === true) {
            if (options.bypassSystemCheck !== true) {
              throw new Error('Cannot modify system roles');
            }
          }
        },
        beforeDestroy: (role, options: any) => {
          if (role.getDataValue('isSystem') === true) {
            if (options.bypassSystemCheck !== true) {
              throw new Error('Cannot delete system roles');
            }
          }
        }
      }
    },
    associate: defineBasicRoleAssociations
  })(sequelize);
  
  // Extend the model with additional methods
  return extendRoleModel(baseModel);
};

export default defineRoleModel;