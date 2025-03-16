import { DataTypes, Model, Sequelize, Optional } from 'sequelize';

/**
 * Define the RolePermission attributes interface
 */
export interface RolePermissionAttributes {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for RolePermission creation attributes (with optional fields for creation)
 */
type RolePermissionCreationAttributes = Optional<
  RolePermissionAttributes,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * RolePermission model definition using functional pattern
 */
export const defineRolePermissionModel = (
  sequelize: Sequelize
): Model<RolePermissionAttributes, RolePermissionCreationAttributes> => {
  const RolePermissionModel = sequelize.define<Model<RolePermissionAttributes, RolePermissionCreationAttributes>>(
    'RolePermission',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Roles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Permissions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'RolePermission',
      tableName: 'RolePermissions',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['roleId', 'permissionId'],
          name: 'role_permission_unique',
        },
      ],
    }
  );

  // Define model associations using a function approach
  const associateRolePermission = (models: Record<string, Model>): void => {
    RolePermissionModel.belongsTo(models.Role as Model);
    RolePermissionModel.belongsTo(models.Permission as Model);
  };

  // Add association method to model
  (RolePermissionModel as any).associate = associateRolePermission;

  return RolePermissionModel;
};

export default defineRolePermissionModel;