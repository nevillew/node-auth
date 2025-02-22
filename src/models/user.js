const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.OAuthToken);
      User.belongsToMany(models.Tenant, {
        through: models.TenantUser,
        foreignKey: 'userId'
      });
    }
  }
  
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    password: DataTypes.STRING,
    name: DataTypes.STRING,
    avatar: DataTypes.STRING,
    googleId: {
      type: DataTypes.STRING,
      unique: true
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User',
  });
  
  return User;
};
