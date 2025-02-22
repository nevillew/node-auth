const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ActivityLog extends Model {
    static associate(models) {
      ActivityLog.belongsTo(models.User, {
        foreignKey: 'userId',
        onDelete: 'CASCADE'
      });
    }
  }
  
  ActivityLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    details: DataTypes.JSON,
    ipAddress: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'ActivityLog',
  });
  
  return ActivityLog;
};
