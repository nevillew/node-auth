import { DataTypes, Model, Sequelize, Optional } from 'sequelize';
import { SecurityAuditLogAttributes, SecuritySeverity, ModelRegistry } from '../types';

/**
 * @fileoverview
 * This module defines the SecurityAuditLog model using functional patterns.
 * Security audit logs track security-related events throughout the system
 * with various levels of severity and categorization.
 * 
 * Key functional patterns:
 * - Pure validation functions separate from model definition
 * - Category mapping using pure functions
 * - Static methods for common operations
 * - Event enums for type safety
 */

/**
 * Security event categories for organizational purposes
 * Using an enum enforces type safety when categorizing events
 * @enum {string}
 */
export enum SecurityEventCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  CONFIGURATION = 'configuration',
  USER_MANAGEMENT = 'user_management',
  ROLE_MANAGEMENT = 'role_management',
  TENANT_MANAGEMENT = 'tenant_management',
  SECURITY_SETTINGS = 'security_settings',
  API_ACCESS = 'api_access',
  SYSTEM = 'system'
}

/**
 * Specific security events that can be logged
 * This enum provides a centralized list of known events for consistency
 * and allows for strong typing in the codebase
 * @enum {string}
 */
export enum SecurityEvent {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_FAILURE = 'mfa_failure',
  
  // Authorization events
  PERMISSION_DENIED = 'permission_denied',
  SCOPE_DENIED = 'scope_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // User management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_ACTIVATED = 'user_activated',
  
  // Role management
  ROLE_CREATED = 'role_created',
  ROLE_UPDATED = 'role_updated',
  ROLE_DELETED = 'role_deleted',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REVOKED = 'role_revoked',
  
  // Tenant management
  TENANT_CREATED = 'tenant_created',
  TENANT_UPDATED = 'tenant_updated',
  TENANT_DELETED = 'tenant_deleted',
  TENANT_SUSPENDED = 'tenant_suspended',
  
  // Security settings
  SECURITY_POLICY_CHANGED = 'security_policy_changed',
  IP_RESTRICTION_CHANGED = 'ip_restriction_changed',
  PASSWORD_POLICY_CHANGED = 'password_policy_changed',
  SESSION_POLICY_CHANGED = 'session_policy_changed',
  
  // API access
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  
  // System events
  SYSTEM_CONFIGURATION_CHANGED = 'system_configuration_changed',
  BACKUP_CREATED = 'backup_created',
  DATABASE_MIGRATED = 'database_migrated'
}

/**
 * Type definition for SecurityAuditLog creation
 * Using Optional from Sequelize allows us to define which fields
 * are required during creation and which have defaults or are generated
 * 
 * This is an application of the Builder pattern from functional programming,
 * allowing partial object construction with sensible defaults
 * 
 * @typedef {Object} SecurityAuditLogCreationAttributes
 */
type SecurityAuditLogCreationAttributes = Optional<
  SecurityAuditLogAttributes,
  | 'id'
  | 'severity'
  | 'ip'
  | 'userAgent'
  | 'createdAt'
  | 'category'
>;

/**
 * Maps an event to its appropriate category
 * This is a pure function that determines a category based on event name patterns.
 * Using a pure function allows us to:
 * 1. Test this logic independently
 * 2. Reuse it across different contexts
 * 3. Reason about it in isolation
 * 
 * @param {string} event - The event name to categorize
 * @returns {SecurityEventCategory} The determined category
 * 
 * @example
 * // Returns SecurityEventCategory.AUTHENTICATION
 * const category = getCategoryForEvent('login_success');
 */
const getCategoryForEvent = (event: string): SecurityEventCategory => {
  if (event.startsWith('login_') || event.startsWith('password_') || event.startsWith('mfa_')) {
    return SecurityEventCategory.AUTHENTICATION;
  } else if (event.startsWith('permission_') || event.startsWith('scope_')) {
    return SecurityEventCategory.AUTHORIZATION;
  } else if (event.startsWith('user_')) {
    return SecurityEventCategory.USER_MANAGEMENT;
  } else if (event.startsWith('role_')) {
    return SecurityEventCategory.ROLE_MANAGEMENT;
  } else if (event.startsWith('tenant_')) {
    return SecurityEventCategory.TENANT_MANAGEMENT;
  } else if (event.includes('_policy_') || event.includes('_restriction_')) {
    return SecurityEventCategory.SECURITY_SETTINGS;
  } else if (event.startsWith('api_')) {
    return SecurityEventCategory.API_ACCESS;
  }
  
  return SecurityEventCategory.SYSTEM;
};

/**
 * Validates if a string is a valid event name
 * This is a predicate function that returns a boolean result
 * based on validation rules. Predicates are common in functional
 * programming for expressing conditions without side effects.
 * 
 * @param {string} event - The event name to validate
 * @returns {boolean} True if valid, false otherwise
 * 
 * @example
 * // Returns true
 * const isValid = isValidEventName('login_success');
 * 
 * // Returns false
 * const isInvalid = isValidEventName('Login Success');
 */
const isValidEventName = (event: string): boolean => {
  // Check if it's a known security event
  if (Object.values(SecurityEvent).includes(event as SecurityEvent)) {
    return true;
  }
  
  // If not in the enum, check if it follows naming pattern for custom events
  return /^[a-z_]+(\.[a-z_]+)*$/.test(event);
};

/**
 * SecurityAuditLog model definition using functional pattern
 * This function follows the factory pattern in functional programming,
 * creating and returning a model instance with all behaviors defined
 * 
 * @param {Sequelize} sequelize - The Sequelize instance
 * @returns {Model} The defined SecurityAuditLog model
 */
export const defineSecurityAuditLogModel = (
  sequelize: Sequelize
): Model<SecurityAuditLogAttributes, SecurityAuditLogCreationAttributes> => {
  const SecurityAuditLogModel = sequelize.define<Model<SecurityAuditLogAttributes, SecurityAuditLogCreationAttributes>>(
    'SecurityAuditLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true, // Some security events might not be user-specific
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      event: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isValidEvent(value: string): void {
            if (!isValidEventName(value)) {
              throw new Error(`Invalid security event: ${value}`);
            }
          }
        }
      },
      details: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      severity: {
        type: DataTypes.ENUM(...Object.values(SecuritySeverity)),
        defaultValue: SecuritySeverity.LOW,
      },
      ip: {
        type: DataTypes.STRING,
        validate: {
          isIP: {
            msg: 'IP address must be valid',
          },
        },
      },
      userAgent: {
        type: DataTypes.STRING(500), // Limit length to prevent overly long user agents
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: SecurityEventCategory.SYSTEM,
        validate: {
          isIn: {
            args: [Object.values(SecurityEventCategory)],
            msg: 'Category must be valid'
          }
        }
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Tenants',
          key: 'id',
        },
      }
    },
    {
      sequelize,
      modelName: 'SecurityAuditLog',
      tableName: 'SecurityAuditLogs',
      timestamps: true,
      updatedAt: false, // Audit logs should never be updated
      hooks: {
        // Set category if not provided
        beforeValidate: (log: any) => {
          if (!log.category && log.event) {
            log.category = getCategoryForEvent(log.event);
          }
        }
      },
      indexes: [
        {
          fields: ['userId'],
          name: 'security_audit_user_idx'
        },
        {
          fields: ['event'],
          name: 'security_audit_event_idx'
        },
        {
          fields: ['createdAt'],
          name: 'security_audit_date_idx'
        },
        {
          fields: ['category'],
          name: 'security_audit_category_idx'
        },
        {
          fields: ['severity'],
          name: 'security_audit_severity_idx'
        },
        {
          fields: ['tenantId'],
          name: 'security_audit_tenant_idx'
        }
      ]
    }
  );

  // Define model associations using a typed approach
  const associateSecurityAuditLog = (models: ModelRegistry): void => {
    SecurityAuditLogModel.belongsTo(models.User, {
      foreignKey: 'userId',
      onDelete: 'CASCADE',
    });
    
    SecurityAuditLogModel.belongsTo(models.Tenant, {
      foreignKey: 'tenantId',
    });
  };

  // Static methods - these demonstrate functionally pure operations on the model
  
  /**
   * Creates a security audit log entry with proper categorization
   * This factory method ensures consistent log creation with proper defaults
   * 
   * @param {SecurityAuditLogCreationAttributes} data - Log data to create
   * @returns {Promise<Model<SecurityAuditLogAttributes>>} The created log
   * 
   * @example
   * await SecurityAuditLog.createLog({
   *   userId: user.id,
   *   event: SecurityEvent.LOGIN_SUCCESS,
   *   details: { ip: '192.168.1.1' },
   *   severity: SecuritySeverity.LOW
   * });
   */
  (SecurityAuditLogModel as any).createLog = async (
    data: SecurityAuditLogCreationAttributes
  ): Promise<Model<SecurityAuditLogAttributes>> => {
    // Auto-fill category if not provided - this is a functional feature
    // where we derive additional data from existing data
    const enrichedData = {...data};
    if (!enrichedData.category && enrichedData.event) {
      enrichedData.category = getCategoryForEvent(enrichedData.event);
    }
    
    return SecurityAuditLogModel.create(enrichedData);
  };
  
  /**
   * Finds all logs matching a specific event
   * Query function with default ordering and flexible options
   * 
   * @param {SecurityEvent} event - The event to search for
   * @param {Object} options - Additional query options
   * @returns {Promise<Model<SecurityAuditLogAttributes>[]>} Matching logs
   */
  (SecurityAuditLogModel as any).findByEvent = async (
    event: SecurityEvent, 
    options = {}
  ): Promise<Model<SecurityAuditLogAttributes>[]> => {
    return SecurityAuditLogModel.findAll({
      where: { event },
      order: [['createdAt', 'DESC']],
      ...options
    });
  };
  
  /**
   * Finds all logs in a specific category
   * Query function with default ordering and flexible options
   * 
   * @param {SecurityEventCategory} category - The category to search for
   * @param {Object} options - Additional query options
   * @returns {Promise<Model<SecurityAuditLogAttributes>[]>} Matching logs
   */
  (SecurityAuditLogModel as any).findByCategory = async (
    category: SecurityEventCategory, 
    options = {}
  ): Promise<Model<SecurityAuditLogAttributes>[]> => {
    return SecurityAuditLogModel.findAll({
      where: { category },
      order: [['createdAt', 'DESC']],
      ...options
    });
  };
  
  /**
   * Finds all logs with a specific severity
   * Query function with default ordering and flexible options
   * 
   * @param {SecuritySeverity} severity - The severity level to search for
   * @param {Object} options - Additional query options
   * @returns {Promise<Model<SecurityAuditLogAttributes>[]>} Matching logs
   */
  (SecurityAuditLogModel as any).findBySeverity = async (
    severity: SecuritySeverity, 
    options = {}
  ): Promise<Model<SecurityAuditLogAttributes>[]> => {
    return SecurityAuditLogModel.findAll({
      where: { severity },
      order: [['createdAt', 'DESC']],
      ...options
    });
  };

  // Add association method to model
  (SecurityAuditLogModel as any).associate = associateSecurityAuditLog;

  return SecurityAuditLogModel;
};

export default defineSecurityAuditLogModel;