import { DataTypes, Model, Sequelize, Optional } from 'sequelize';

/**
 * Define the Notification attributes interface
 */
export interface NotificationAttributes {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  type?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Notification creation attributes (with optional fields for creation)
 */
type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  | 'id'
  | 'read'
  | 'type'
  | 'data'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Notification model definition using functional pattern
 */
export const defineNotificationModel = (
  sequelize: Sequelize
): Model<NotificationAttributes, NotificationCreationAttributes> => {
  const NotificationModel = sequelize.define<Model<NotificationAttributes, NotificationCreationAttributes>>(
    'Notification',
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
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      data: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'Notifications',
      timestamps: true,
    }
  );

  // Define model associations using a function approach
  const associateNotification = (models: Record<string, Model>): void => {
    NotificationModel.belongsTo(models.User as Model, {
      foreignKey: 'userId',
    });
  };

  // Add association method to model
  (NotificationModel as any).associate = associateNotification;

  return NotificationModel;
};

export default defineNotificationModel;