import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;
import { DataTypes, Model, Optional } from 'sequelize';

/**
 * Define the UserRole attributes interface
 */
export interface UserRoleAttributes {
  id: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for UserRole creation attributes (with optional fields for creation)
 */
type UserRoleCreationAttributes = Optional<
  UserRoleAttributes,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * UserRole model definition using functional pattern
 */
export const defineUserRoleModel = (
  sequelize: Sequelize
): Model<UserRoleAttributes, UserRoleCreationAttributes> => {
  const UserRoleModel = sequelize.define<Model<UserRoleAttributes, UserRoleCreationAttributes>>(
    'UserRole',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
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
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'UserRole',
      tableName: 'UserRoles',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['userId', 'roleId'],
          name: 'user_role_unique',
        },
      ],
    }
  );

  // Define model associations using a function approach
  const associateUserRole = (models: Record<string, Model>): void => {
    UserRoleModel.belongsTo(models.User as Model);
    UserRoleModel.belongsTo(models.Role as Model);
  };

  // Add association method to model
  (UserRoleModel as any).associate = associateUserRole;

  return UserRoleModel;
};

export default defineUserRoleModel;