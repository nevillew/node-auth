/**
 * Models Index
 * 
 * This file centralizes model imports and exports
 */

import SequelizeOriginal from 'sequelize';
import { Op, Model, ModelStatic, DataTypes } from 'sequelize';

// Make Sequelize available as a type
type SequelizeInstance = SequelizeOriginal.Sequelize;
const { Sequelize } = SequelizeOriginal as any;
import { 
  UserAttributes, 
  TenantAttributes,
  RoleAttributes,
  ActivityLogAttributes,
  LoginHistoryAttributes,
  SecurityAuditLogAttributes,
  NotificationAttributes,
  AuthenticatorAttributes,
  UserRoleAttributes,
  RolePermissionAttributes,
  InvitationAttributes,
  PermissionAttributes,
  TenantUserAttributes,
  ModelName,
  ModelRegistry,
  AssociableModel
} from '../types';

// Initialize Sequelize
import config from '../config/database';
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Import the actual Sequelize constructor
import SequelizeConstructor from 'sequelize';
const Sequelize = SequelizeConstructor;

export const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool
  }
);

// Import model definers
import defineUserModel from './user';
import defineTenantModel from './tenant';
import defineRoleModel from './role';
import defineActivityLogModel from './activityLog';
import defineLoginHistoryModel from './loginHistory';
import defineSecurityAuditLogModel from './securityAuditLog';
import defineNotificationModel from './notification';
import defineAuthenticatorModel from './authenticator';
import defineUserRoleModel from './userRole';
import defineRolePermissionModel from './rolePermission';
import defineInvitationModel from './invitation';
// TODO: Create proper TenantUser model file
// For now, we'll use a safer temporary implementation that still provides
// proper typing but indicates that this is a placeholder
import { createModelDefiner } from '../utils/modelFactory';

// Define models
const User = defineUserModel(sequelize);
const Tenant = defineTenantModel(sequelize);
const Role = defineRoleModel(sequelize);
const ActivityLog = defineActivityLogModel(sequelize);
const LoginHistory = defineLoginHistoryModel(sequelize);
const SecurityAuditLog = defineSecurityAuditLogModel(sequelize);
const Notification = defineNotificationModel(sequelize);
const Authenticator = defineAuthenticatorModel(sequelize);
const UserRole = defineUserRoleModel(sequelize);
const RolePermission = defineRolePermissionModel(sequelize);
const Invitation = defineInvitationModel(sequelize);

// Temporary Permission model
const Permission = createModelDefiner<PermissionAttributes>({
  name: 'Permission',
  attributes: {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  options: {
    tableName: 'Permissions',
    timestamps: true,
  },
  associate: (models: ModelRegistry) => {
    models.Permission.belongsToMany(models.Role, { 
      through: models.RolePermission, 
      foreignKey: 'permissionId' 
    });
  }
})(sequelize);

// OAuth models for authentication
export interface OAuthClientAttributes {
  id: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grants: string[];
  scopes: string[];
  name: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthTokenAttributes {
  id: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  clientId: string;
  userId?: string;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Temporary OAuth models
const OAuthClient = createModelDefiner<OAuthClientAttributes>({
  name: 'OAuthClient',
  attributes: {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    clientSecret: {
      type: DataTypes.STRING,
      allowNull: false
    },
    redirectUris: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    grants: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    scopes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Tenants',
        key: 'id'
      }
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  options: {
    tableName: 'OAuthClients',
    timestamps: true,
  },
  associate: (models: ModelRegistry) => {
    // Associations would be defined here
  }
})(sequelize);

const OAuthToken = createModelDefiner<OAuthTokenAttributes>({
  name: 'OAuthToken',
  attributes: {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    accessToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    accessTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    refreshTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    scope: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  options: {
    tableName: 'OAuthTokens',
    timestamps: true,
  },
  associate: (models: ModelRegistry) => {
    // Associations would be defined here
  }
})(sequelize);

// Temporary TenantUser model with proper typing using the factory pattern
// This is a placeholder until a proper implementation is created
const TenantUser = createModelDefiner<TenantUserAttributes>({
  name: 'TenantUser',
  attributes: {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    tenantId: {
      type: DataTypes.UUID,
      primaryKey: true,
      references: {
        model: 'Tenants',
        key: 'id'
      }
    },
    roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  },
  options: {
    tableName: 'TenantUsers',
    timestamps: true,
  },
  associate: (models: ModelRegistry) => {
    // Define proper associations
    models.TenantUser.belongsTo(models.User, { foreignKey: 'userId' });
    models.TenantUser.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
  }
})(sequelize);

// Create model registry for typed associations
// For ModelName.PERMISSION, we're adding it to match its usage in controllers
const models: ModelRegistry = {
  [ModelName.USER]: User as AssociableModel<UserAttributes>,
  [ModelName.TENANT]: Tenant as AssociableModel<TenantAttributes>,
  [ModelName.ROLE]: Role as AssociableModel<RoleAttributes>,
  [ModelName.ACTIVITY_LOG]: ActivityLog as AssociableModel<ActivityLogAttributes>,
  [ModelName.LOGIN_HISTORY]: LoginHistory as AssociableModel<LoginHistoryAttributes>,
  [ModelName.SECURITY_AUDIT_LOG]: SecurityAuditLog as AssociableModel<SecurityAuditLogAttributes>,
  [ModelName.NOTIFICATION]: Notification as AssociableModel<NotificationAttributes>,
  [ModelName.AUTHENTICATOR]: Authenticator as AssociableModel<AuthenticatorAttributes>,
  [ModelName.USER_ROLE]: UserRole as AssociableModel<UserRoleAttributes>,
  [ModelName.ROLE_PERMISSION]: RolePermission as AssociableModel<RolePermissionAttributes>,
  [ModelName.INVITATION]: Invitation as AssociableModel<InvitationAttributes>,
  [ModelName.TENANT_USER]: TenantUser as AssociableModel<TenantUserAttributes>,
  [ModelName.PERMISSION]: Permission as AssociableModel<PermissionAttributes>
};

// Initialize associations
Object.values(models).forEach(model => {
  // All models in our registry implement the AssociableModel interface
  // so they all have an associate method
  if ('associate' in model) {
    model.associate(models);
  }
});

// Export Sequelize operators and instance
export { Op, Sequelize };

// Export models
export {
  User,
  Tenant,
  Role,
  Permission,
  ActivityLog,
  LoginHistory,
  SecurityAuditLog,
  Notification,
  Authenticator,
  UserRole,
  RolePermission,
  Invitation,
  TenantUser,
  OAuthClient,
  OAuthToken
};

// Export OAuth interfaces
export type {
  OAuthClientAttributes,
  OAuthTokenAttributes
};