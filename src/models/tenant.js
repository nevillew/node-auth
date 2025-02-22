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
      allowNull: false,
      validate: {
        is: /^[a-z0-9-]+$/i
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 100]
      }
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
    colors: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    features: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    securityPolicy: {
      type: DataTypes.JSON,
      defaultValue: {
        session: {
          maxConcurrentSessions: 3,
          sessionTimeout: 3600,
          extendOnActivity: true,
          requireMFA: false
        },
        twoFactor: {
          required: false,
          graceLogins: 3,
          gracePeriodDays: 7,
          allowBackupCodes: true,
          allowRememberDevice: false,
          exemptRoles: [],
          enforcementDate: null,
          enforcedBy: null
        },
        ipRestrictions: {
          enabled: false,
          allowedIPs: [],
          allowedRanges: [],
          blockList: []
        }
      }
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
        },
        isSignedS3Url(value) {
          if (value && !value.includes('X-Amz-Signature')) {
            throw new Error('Logo URL must be a signed S3 URL');
          }
        }
      }
    },
    colors: DataTypes.JSON,
    features: DataTypes.JSON,
        session: {
          maxConcurrentSessions: 3,
          sessionTimeout: 3600, // 1 hour in seconds
          extendOnActivity: true,
          requireMFA: false
        },
        twoFactor: {
          required: false,
          graceLogins: 3,
          gracePeriodDays: 7,
          allowBackupCodes: true,
          allowRememberDevice: false
        },
        ipRestrictions: {
          enabled: false,
          allowedIPs: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: [],
            validate: {
              isValidIPs(value) {
                if (!Array.isArray(value)) throw new Error('Must be an array');
                value.forEach(ip => {
                  if (!isValidIP(ip)) throw new Error(`Invalid IP address: ${ip}`);
                });
              }
            }
          },
          allowedRanges: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: [],
            validate: {
              isValidCIDR(value) {
                if (!Array.isArray(value)) throw new Error('Must be an array');
                value.forEach(range => {
                  if (!isValidCIDR(range)) throw new Error(`Invalid CIDR range: ${range}`);
                });
              }
            }
          },
          blockList: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: [],
            validate: {
              isValidIPs(value) {
                if (!Array.isArray(value)) throw new Error('Must be an array');
                value.forEach(ip => {
                  if (!isValidIP(ip)) throw new Error(`Invalid IP address: ${ip}`);
                });
              }
            }
          }
        },
        session: {
          maxConcurrentSessions: 3,
          sessionTimeout: 3600, // 1 hour in seconds
          extendOnActivity: true,
          requireMFA: false
        },
        twoFactor: {
          required: false,
          graceLogins: 3,
          gracePeriodDays: 7,
          allowBackupCodes: true,
          allowRememberDevice: false,
          exemptRoles: [],
          enforcementDate: null,
          enforcedBy: null
        }
      },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'pending_deletion'),
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'suspended', 'pending_deletion']]
      }
    },
    deletionRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deletionScheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterRequestedAt(value) {
          if (value && this.deletionRequestedAt && value <= this.deletionRequestedAt) {
            throw new Error('Scheduled deletion date must be after requested date');
          }
        }
      }
    },
    gracePeriodDays: {
      type: DataTypes.INTEGER,
      defaultValue: 7,
      validate: {
        min: 1,
        max: 30
      }
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
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'in_progress', 'completed']]
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Tenant',
  });
  
  return Tenant;
};
