/**
 * Models Index
 * 
 * This file centralizes model imports and exports
 */

import { Sequelize, Op, Model, DataTypes } from 'sequelize';
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
const env = process.env.NODE_ENV || 'development';
const config = require('../config/database')[env];

export const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool
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
  [ModelName.TENANT_USER]: TenantUser as AssociableModel<TenantUserAttributes>
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
export { Op };

// Export models
export {
  User,
  Tenant,
  Role,
  ActivityLog,
  LoginHistory,
  SecurityAuditLog,
  Notification,
  Authenticator,
  UserRole,
  RolePermission,
  Invitation,
  TenantUser
};