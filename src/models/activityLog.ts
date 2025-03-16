import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;
import { DataTypes, Model, Optional } from 'sequelize';
import { ActivityLogAttributes } from '../types';

/**
 * Interface for ActivityLog creation attributes (with optional fields for creation)
 */
type ActivityLogCreationAttributes = Optional<
  ActivityLogAttributes,
  | 'id'
  | 'ip'
  | 'userAgent'
  | 'createdAt'
>;

/**
 * ActivityLog model definition using functional pattern
 */
export const defineActivityLogModel = (sequelize: Sequelize): Model<ActivityLogAttributes, ActivityLogCreationAttributes> => {
  const ActivityLogModel = sequelize.define<Model<ActivityLogAttributes, ActivityLogCreationAttributes>>(
    'ActivityLog',
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
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      details: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      ip: {
        type: DataTypes.STRING,
        validate: {
          isIP: {
            msg: 'IP address must be valid',
          },
        },
      },
      userAgent: DataTypes.STRING,
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'ActivityLogs',
      timestamps: true,
      updatedAt: false, // Activity logs should never be updated
    }
  );

  // Define model associations using a function approach
  const associateActivityLog = (models: Record<string, Model>): void => {
    ActivityLogModel.belongsTo(models.User as Model, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
  };

  // Add association method to model
  (ActivityLogModel as Model<ActivityLogAttributes, ActivityLogCreationAttributes> & { associate: typeof associateActivityLog }).associate = associateActivityLog;

  return ActivityLogModel;
};

export default defineActivityLogModel;