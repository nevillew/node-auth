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
    logo: {
      type: DataTypes.STRING,
      validate: {
        isUrl: {
          msg: 'Logo must be a valid URL'
        }
      }
    },
    colors: DataTypes.JSON,
    features: DataTypes.JSON,
    securityPolicy: {
      type: DataTypes.JSON,
      defaultValue: {
        password: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          preventPasswordReuse: 3,
          expiryDays: 90
        },
        session: {
          maxConcurrentSessions: 3,
          sessionTimeout: 3600, // 1 hour in seconds
          extendOnActivity: true,
          requireMFA: false
        },
        ipRestrictions: {
          enabled: false,
          allowedIPs: [],
          allowedRanges: [],
          blockList: []
        }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'pending_deletion'),
      defaultValue: 'active'
    },
    deletionRequestedAt: DataTypes.DATE,
    deletionScheduledAt: DataTypes.DATE,
    gracePeriodDays: {
      type: DataTypes.INTEGER,
      defaultValue: 7
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
