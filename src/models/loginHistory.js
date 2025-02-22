const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LoginHistory extends Model {
    static associate(models) {
      LoginHistory.belongsTo(models.User, {
        foreignKey: 'userId',
        onDelete: 'CASCADE'
      });
    }
  }
  
  LoginHistory.init({
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
    ipAddress: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    location: DataTypes.JSON,
    status: {
      type: DataTypes.ENUM('success', 'failed'),
      allowNull: false
    },
    failureReason: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'LoginHistory',
  });
  
  return LoginHistory;
};
