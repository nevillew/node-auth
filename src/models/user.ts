import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;
import { DataTypes, Model, Optional } from 'sequelize';
import { 
  UserAttributes, 
  UserStatus, 
  ThemeType, 
  FontSize, 
  VisibilityType,
  UserPreferences,
  NotificationPreferences,
  AccessibilityPreferences,
  PrivacyPreferences,
  UserProfile,
  EmailPreferences,
  ModelRegistry,
  AssociableModel
} from '../types';

/**
 * Interface for User creation attributes (with optional fields for creation)
 */
type UserCreationAttributes = Optional<
  UserAttributes,
  | 'id'
  | 'status'
  | 'failedLoginAttempts'
  | 'twoFactorEnabled'
  | 'twoFactorPendingVerification'
  | 'twoFactorBackupCodes'
  | 'twoFactorVerificationAttempts'
  | 'passKeyEnabled'
  | 'emailVerified'
  | 'preferences'
  | 'profile'
  | 'emailPreferences'
  | 'loginCount'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Default values for complex nested objects
 */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  push: true,
  sms: false,
};

const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  fontSize: FontSize.NORMAL,
};

const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  profileVisibility: VisibilityType.PUBLIC,
  activityVisibility: VisibilityType.PRIVATE,
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: ThemeType.LIGHT,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  accessibility: DEFAULT_ACCESSIBILITY_PREFERENCES,
  privacy: DEFAULT_PRIVACY_PREFERENCES,
};

const DEFAULT_USER_PROFILE: UserProfile = {
  phoneNumber: null,
  address: null,
  timezone: 'UTC',
  language: 'en',
  bio: null,
  socialLinks: {},
  skills: [],
  title: null,
  department: null,
};

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  marketing: true,
  updates: true,
  security: true,
  newsletter: false,
};

/**
 * User model definition using functional pattern
 * 
 * This follows the functional programming approach by:
 * - Using factory functions instead of classes
 * - Ensuring proper typing through generics
 * - Separating model definition from association logic
 * 
 * @param {Sequelize} sequelize - The Sequelize instance
 * @returns {AssociableModel<UserAttributes, UserCreationAttributes>} - The User model with associations
 */
export const defineUserModel = (sequelize: Sequelize): AssociableModel<UserAttributes, UserCreationAttributes> => {
  // Use the proper generic type throughout for consistency
  const UserModel = sequelize.define<AssociableModel<UserAttributes, UserCreationAttributes>>(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isEmail: {
            msg: 'Must be a valid email address',
          },
        },
      },
      failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      accountLockedUntil: DataTypes.DATE,
      lastFailedLoginAt: DataTypes.DATE,
      currentChallenge: DataTypes.STRING,
      passKeyEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      passkeyRegistrationStartedAt: DataTypes.DATE,
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [2, 100],
        },
      },
      avatar: {
        type: DataTypes.STRING,
        validate: {
          isUrl: {
            msg: 'Avatar must be a valid URL',
          },
          isSignedS3Url(value: string): void {
            if (value && !value.includes('X-Amz-Signature')) {
              throw new Error('Avatar URL must be a signed S3 URL');
            }
          },
        },
      },
      googleId: {
        type: DataTypes.STRING,
        unique: true,
      },
      twoFactorSecret: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      twoFactorPendingVerification: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      twoFactorBackupCodes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      twoFactorSetupStartedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      twoFactorLastVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      twoFactorVerificationAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      twoFactorLastFailedAttempt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      verificationToken: DataTypes.STRING,
      verificationTokenExpires: DataTypes.DATE,
      resetToken: DataTypes.STRING,
      resetTokenExpires: DataTypes.DATE,
      preferences: {
        type: DataTypes.JSON,
        defaultValue: DEFAULT_USER_PREFERENCES,
      },
      lastActivity: DataTypes.DATE,
      profile: {
        type: DataTypes.JSON,
        defaultValue: DEFAULT_USER_PROFILE,
      },
      emailPreferences: {
        type: DataTypes.JSON,
        defaultValue: DEFAULT_EMAIL_PREFERENCES,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(UserStatus)),
        defaultValue: UserStatus.ACTIVE,
      },
      deletedAt: DataTypes.DATE,
      deletedBy: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      statusReason: DataTypes.STRING,
      statusChangedAt: DataTypes.DATE,
      statusChangedBy: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      deactivatedAt: DataTypes.DATE,
      deactivatedBy: {
        type: DataTypes.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      deactivationReason: DataTypes.STRING,
      lastLoginAt: DataTypes.DATE,
      loginCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      tableName: 'Users',
      timestamps: true,
      paranoid: true, // Use deletedAt as a flag for soft deletes
      hooks: {
        // Example hook for handling status changes
        beforeUpdate: async (user: Model<UserAttributes>) => {
          const changed = user.changed();
          // Create a pure update that avoids direct mutation where possible
          if (changed && changed.includes('status')) {
            // Note: Sequelize hooks require mutation in some cases
            // For a truly functional approach, this logic would be moved to a service layer
            // that creates a new immutable object before saving
            user.set('statusChangedAt', new Date());
            
            // Return the user to indicate we've handled the changes
            return user;
          }
        }
      }
    }
  );

  // Define model associations using a typed approach
  const associateUser = (models: ModelRegistry): void => {
    UserModel.hasMany(models.Authenticator);
    UserModel.hasMany(models.ActivityLog);
    UserModel.hasMany(models.LoginHistory);
    UserModel.hasMany(models.Notification);
    UserModel.hasMany(models.SecurityAuditLog);
    
    UserModel.belongsToMany(models.Tenant, {
      through: models.TenantUser,
      foreignKey: 'userId',
    });
    
    UserModel.belongsToMany(models.Role, {
      through: models.UserRole,
      foreignKey: 'userId',
    });
  };

  // Add association method to model directly
  // No need for type casting since we defined with proper type
  UserModel.associate = associateUser;

  return UserModel;
};

export default defineUserModel;