const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Tenant extends Model {
    static associate(models) {
      Tenant.belongsToMany(models.User, {
        through: models.TenantUser,
        foreignKey: 'tenantId'
      });
    }
  }
  
  Tenant.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    databaseUrl: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    logo: DataTypes.STRING,
    colors: DataTypes.JSON,
    features: DataTypes.JSON,
    securityPolicy: DataTypes.JSON,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active'
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    featureFlags: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    onboardingStatus: {
      type: DataTypes.STRING,
      defaultValue: 'pending'
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Tenant',
  });
  
  return Tenant;
};
