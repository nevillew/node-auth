const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SecurityAuditLog extends Model {
    static associate(models) {
      SecurityAuditLog.belongsTo(models.User, {
        foreignKey: 'userId',
        onDelete: 'CASCADE'
      });
    }
  }
  
  SecurityAuditLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    event: {
      type: DataTypes.STRING,
      allowNull: false
    },
    details: DataTypes.JSON,
    ipAddress: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'low'
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'SecurityAuditLog',
  });
  
  return SecurityAuditLog;
};
