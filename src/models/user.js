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
    password: {
      type: DataTypes.STRING,
      validate: {
        isStrongPassword(value) {
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/.test(value)) {
            throw new Error('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character');
          }
        }
      }
    },
    passwordHistory: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    passwordChangedAt: DataTypes.DATE,
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    accountLockedUntil: DataTypes.DATE,
    lastFailedLoginAt: DataTypes.DATE,
    currentChallenge: DataTypes.STRING,
    passKeyEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    passkeyRegistrationStartedAt: DataTypes.DATE,
    name: DataTypes.STRING,
    avatar: {
      type: DataTypes.STRING,
      validate: {
        isUrl: {
          msg: 'Avatar must be a valid URL'
        },
        isSignedS3Url(value) {
          if (value && !value.includes('X-Amz-Signature')) {
            throw new Error('Avatar URL must be a signed S3 URL');
          }
        }
      }
    },
    googleId: {
      type: DataTypes.STRING,
      unique: true
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorPendingVerification: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorBackupCodes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    twoFactorSetupStartedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    twoFactorLastVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verificationToken: DataTypes.STRING,
    verificationTokenExpires: DataTypes.DATE,
    resetToken: DataTypes.STRING,
    resetTokenExpires: DataTypes.DATE,
    preferences: DataTypes.JSON,
    lastActivity: DataTypes.DATE,
    profile: {
      type: DataTypes.JSON,
      defaultValue: {
        phoneNumber: null,
        address: null,
        timezone: 'UTC',
        language: 'en',
        bio: null,
        socialLinks: {},
        skills: [],
        title: null,
        department: null
      }
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        accessibility: {
          highContrast: false,
          fontSize: 'normal'
        },
        privacy: {
          profileVisibility: 'public',
          activityVisibility: 'private'
        }
      }
    },
    emailPreferences: {
      type: DataTypes.JSON,
      defaultValue: {
        marketing: true,
        updates: true,
        security: true,
        newsletter: false
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'deleted'),
      defaultValue: 'active'
    },
    deletedAt: DataTypes.DATE,
    deletedBy: {
      type: DataTypes.UUID,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    statusReason: DataTypes.STRING,
    statusChangedAt: DataTypes.DATE,
    statusChangedBy: {
      type: DataTypes.UUID,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    deactivatedAt: DataTypes.DATE,
    deactivatedBy: {
      type: DataTypes.UUID,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    deactivationReason: DataTypes.STRING,
    lastLoginAt: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User',
  });
  
  return User;
};
