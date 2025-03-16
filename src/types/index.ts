import { Request, Response, NextFunction } from 'express';
// Import types from our custom declaration file
import type { Sequelize, Model } from './sequelize';

// Extend Express Request
export interface AuthenticatedRequest extends Omit<Request, 'route'> {
  user?: UserAttributes;
  impersonator?: UserAttributes;
  route?: {
    scopes: string[];
  };
  tenant?: {
    id: string;
    name: string;
  };
}

// User-related types
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

export enum FontSize {
  SMALL = 'small',
  NORMAL = 'normal',
  LARGE = 'large'
}

export enum VisibilityType {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export enum ThemeType {
  LIGHT = 'light',
  DARK = 'dark'
}

export interface UserAttributes {
  id: string;
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  googleId?: string;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorPendingVerification: boolean;
  twoFactorBackupCodes: string[];
  twoFactorSetupStartedAt?: Date;
  twoFactorLastVerifiedAt?: Date;
  twoFactorVerificationAttempts: number;
  twoFactorLastFailedAttempt?: Date;
  failedLoginAttempts: number;
  accountLockedUntil?: Date;
  lastFailedLoginAt?: Date;
  currentChallenge?: string;
  passKeyEnabled: boolean;
  passkeyRegistrationStartedAt?: Date;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
  preferences: UserPreferences;
  lastActivity?: Date;
  profile: UserProfile;
  emailPreferences: EmailPreferences;
  status: UserStatus;
  deletedAt?: Date;
  deletedBy?: string;
  statusReason?: string;
  statusChangedAt?: Date;
  statusChangedBy?: string;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  deactivationReason?: string;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  phoneNumber?: string;
  address?: string;
  timezone: string;
  language: string;
  bio?: string;
  socialLinks: Record<string, string>;
  skills: string[];
  title?: string;
  department?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface AccessibilityPreferences {
  highContrast: boolean;
  fontSize: FontSize;
}

export interface PrivacyPreferences {
  profileVisibility: VisibilityType;
  activityVisibility: VisibilityType;
}

export interface UserPreferences {
  theme: ThemeType;
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
  privacy: PrivacyPreferences;
}

export interface EmailPreferences {
  marketing: boolean;
  updates: boolean;
  security: boolean;
  newsletter: boolean;
}

// Tenant-related types
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventPasswordReuse: number;
  expiryDays: number;
}

export interface SessionPolicy {
  maxConcurrentSessions: number;
  sessionTimeout: number;
  extendOnActivity: boolean;
  requireMFA: boolean;
}

export interface IpRestrictionPolicy {
  enabled: boolean;
  allowedIPs: string[];
  allowedRanges: string[];
  blockList: string[];
}

export interface TenantSecurityPolicy {
  password: PasswordPolicy;
  session: SessionPolicy;
  ipRestrictions: IpRestrictionPolicy;
}

export interface TenantAttributes {
  id: string;
  name: string;
  slug: string;
  features: Record<string, boolean>;
  status: TenantStatus;
  securityPolicy: TenantSecurityPolicy;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface TenantUserAttributes {
  userId: string;
  tenantId: string;
  roles: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Role and permission types
export interface RoleAttributes {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  isSystem: boolean;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionAttributes {
  id: string;
  name: string;
  description: string;
  code: string;
  category: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissionAttributes {
  roleId: string;
  permissionId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Activity logging types
export interface ActivityLogAttributes {
  id: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
  ip?: string;
  userAgent?: string;
}

export enum LoginStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  LOCKED = 'locked',
  SUSPENDED = 'suspended'
}

export interface GeoLocation {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface LoginHistoryAttributes {
  id: string;
  userId: string;
  status: LoginStatus;
  ip: string;
  userAgent: string;
  location?: GeoLocation;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityAuditLogAttributes {
  id: string;
  userId: string;
  event: string;
  details: Record<string, unknown>;
  severity: SecuritySeverity;
  createdAt: Date;
  ip?: string;
  userAgent?: string;
}

// Controller function types
export type ControllerFunction = (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => Promise<void>;

/**
 * Error codes for consistent error handling across the application
 * 
 * These error codes provide a more granular classification of errors
 * that can occur in the application, allowing for more precise error
 * handling and improved user feedback.
 * 
 * Following functional programming principles, these codes create a
 * closed set of possible error states, enabling exhaustive pattern matching
 * and improved type safety throughout the application.
 * 
 * @enum {string}
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
  TYPE_ERROR = 'TYPE_ERROR',
  ARRAY_VALIDATION_ERROR = 'ARRAY_VALIDATION_ERROR',
  OBJECT_VALIDATION_ERROR = 'OBJECT_VALIDATION_ERROR',
  STRING_VALIDATION_ERROR = 'STRING_VALIDATION_ERROR',
  NUMBER_VALIDATION_ERROR = 'NUMBER_VALIDATION_ERROR',
  
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  MFA_EXPIRED = 'MFA_EXPIRED',
  PASSKEY_ERROR = 'PASSKEY_ERROR',
  
  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SCOPE_REQUIRED = 'SCOPE_REQUIRED',
  ROLE_REQUIRED = 'ROLE_REQUIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  IP_RESTRICTED = 'IP_RESTRICTED',
  TENANT_ACCESS_DENIED = 'TENANT_ACCESS_DENIED',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  RESOURCE_IMMUTABLE = 'RESOURCE_IMMUTABLE',
  RESOURCE_EXPIRED = 'RESOURCE_EXPIRED',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
  RESOURCE_DEPENDENCY_ERROR = 'RESOURCE_DEPENDENCY_ERROR',
  RESOURCE_VERSION_CONFLICT = 'RESOURCE_VERSION_CONFLICT',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',
  CHECK_CONSTRAINT_VIOLATION = 'CHECK_CONSTRAINT_VIOLATION',
  DEADLOCK_ERROR = 'DEADLOCK_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
  INTEGRATION_CONFIGURATION_ERROR = 'INTEGRATION_CONFIGURATION_ERROR',
  THIRD_PARTY_API_ERROR = 'THIRD_PARTY_API_ERROR',
  
  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_MISS = 'CACHE_MISS',
  CACHE_INVALID = 'CACHE_INVALID',
  REDIS_ERROR = 'REDIS_ERROR',
  
  // File errors
  FILE_ERROR = 'FILE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  RUNTIME_ERROR = 'RUNTIME_ERROR'
}

/**
 * Maps HTTP status codes to appropriate error codes
 * This helps with automatic error code selection based on HTTP status
 * 
 * @type {Record<number, ErrorCode>}
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.INVALID_INPUT,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.VALIDATION_ERROR,
  429: ErrorCode.RATE_LIMIT_EXCEEDED,
  500: ErrorCode.INTERNAL_ERROR,
  501: ErrorCode.NOT_IMPLEMENTED,
  502: ErrorCode.BAD_GATEWAY,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.TIMEOUT
};

/**
 * Interface for service error responses
 * 
 * @interface
 */
export interface ServiceError {
  /** Human-readable error message */
  message: string;
  /** Machine-readable error code for programmatic handling */
  code: ErrorCode;
  /** Optional details for more context */
  details?: unknown;
  /** Optional source of the error */
  source?: string;
}

// Service result types
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

// Authentication types
export interface AuthenticatorAttributes {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationAttributes {
  id: string;
  email: string;
  tenantId: string;
  invitedById: string;
  token: string;
  expiresAt: Date;
  roles: string[];
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleAttributes {
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  grantedBy?: string;
}

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// OAuth related types
export interface OAuthClientAttributes {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  description?: string;
  redirectUris: string[];
  allowedScopes: string[];
  grants: string[];
  tenantId: string;
  createdById: string;
  isActive: boolean;
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
  userId: string;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum ModelName {
  USER = 'User',
  TENANT = 'Tenant',
  TENANT_USER = 'TenantUser',
  ROLE = 'Role',
  PERMISSION = 'Permission',
  ROLE_PERMISSION = 'RolePermission',
  USER_ROLE = 'UserRole',
  ACTIVITY_LOG = 'ActivityLog',
  LOGIN_HISTORY = 'LoginHistory',
  SECURITY_AUDIT_LOG = 'SecurityAuditLog',
  NOTIFICATION = 'Notification',
  AUTHENTICATOR = 'Authenticator',
  INVITATION = 'Invitation'
}

/**
 * Database context with all models
 * This interface represents the complete application database context,
 * including the Sequelize instance and all model instances.
 */
export interface DatabaseContext {
  sequelize: Sequelize;
  User: AssociableModel<UserAttributes>;
  Tenant: AssociableModel<TenantAttributes>;
  TenantUser: AssociableModel<TenantUserAttributes>;
  Role: AssociableModel<RoleAttributes>;
  Permission: AssociableModel<PermissionAttributes>;
  ActivityLog: AssociableModel<ActivityLogAttributes>;
  LoginHistory: AssociableModel<LoginHistoryAttributes>;
  SecurityAuditLog: AssociableModel<SecurityAuditLogAttributes>;
  Notification: AssociableModel<NotificationAttributes>;
  Authenticator: AssociableModel<AuthenticatorAttributes>;
  UserRole: AssociableModel<UserRoleAttributes>;
  RolePermission: AssociableModel<RolePermissionAttributes>;
  Invitation: AssociableModel<InvitationAttributes>;
  // Index signature for dynamic access
  [key: string]: Sequelize | AssociableModel<unknown, unknown>;
}

/**
 * Options for application errors
 * Provides a consistent structure for error objects throughout the application
 * 
 * @interface
 */
export interface AppErrorOptions {
  /** Human-readable error message */
  message: string;
  /** HTTP status code for the error */
  statusCode: number;
  /** Machine-readable error code for programmatic handling */
  code?: ErrorCode;
  /** Additional details about the error */
  details?: Record<string, unknown>;
  /** Original error that caused this error */
  originalError?: Error;
  /** Where the error originated */
  source?: string;
  /** Whether this is an operational error */
  isOperational?: boolean;
}

// Validation types (for zod)
export interface ValidationError {
  path: string[];
  message: string;
}

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

/**
 * Interface for models that support associations
 * This extends the Sequelize Model type to include the associate method
 * that is commonly used in models for defining relationships
 * 
 * This follows the functional programming principle of explicit interfaces
 * and type safety, ensuring model associations are properly typed.
 * 
 * @template T The model's attributes type
 * @template C The model's creation attributes type (defaults to T)
 */
export interface AssociableModel<T, C = T> extends Model {
  /**
   * Define model associations with other models
   * 
   * @param {ModelRegistry} models - Registry of all models for association
   * @returns {void}
   */
  associate: (models: ModelRegistry) => void;
  
  /**
   * Find a record by its primary key with proper typing
   * 
   * @param {string | number} id - The primary key value
   * @param {object} options - Query options
   * @returns {Promise<AssociableModel<T, C> | null>} The found record or null
   */
  findByPk(id: string | number, options?: Record<string, unknown>): Promise<AssociableModel<T, C> | null>;
  
  /**
   * Find a single record with proper typing
   * 
   * @param {object} options - Query options
   * @returns {Promise<AssociableModel<T, C> | null>} The found record or null
   */
  findOne(options?: Record<string, unknown>): Promise<AssociableModel<T, C> | null>;
  
  /**
   * Create a new record with proper typing
   * 
   * @param {C} values - The values to create the record with
   * @param {object} options - Creation options
   * @returns {Promise<AssociableModel<T, C>>} The created record
   */
  create(values: C, options?: Record<string, unknown>): Promise<AssociableModel<T, C>>;
  
  /**
   * Find all records matching criteria
   * 
   * @param {object} options - Query options
   * @returns {Promise<AssociableModel<T, C>[]>} Array of matching records
   */
  findAll(options?: Record<string, unknown>): Promise<AssociableModel<T, C>[]>;
  
  /**
   * Find and count records
   * 
   * @param {object} options - Query options
   * @returns {Promise<{ rows: AssociableModel<T, C>[]; count: number }>} Count and rows
   */
  findAndCountAll(options?: Record<string, unknown>): Promise<{ rows: AssociableModel<T, C>[]; count: number }>;
  
  /**
   * Update an existing record
   * 
   * @param {Partial<T>} values - Values to update
   * @param {object} options - Update options
   * @returns {Promise<[number, AssociableModel<T, C>[]]>} Number of affected rows and affected records
   */
  update(values: Partial<T>, options?: Record<string, unknown>): Promise<[number, AssociableModel<T, C>[]]>;
  
  /**
   * Delete records
   * 
   * @param {object} options - Destroy options
   * @returns {Promise<number>} Number of deleted records
   */
  destroy(options?: Record<string, unknown>): Promise<number>;
  
  /**
   * Convert model instance to plain object
   * 
   * @returns {T} Plain object representation
   */
  toJSON(): T;
  
  /**
   * Get related models through an association
   * 
   * @param {string} associationName - Name of the association
   * @returns {Promise<any[]>} Related models
   */
  get<K extends keyof T>(key: K): T[K];
  
  /**
   * Access to all model attributes as defined in T
   */
  [key: string]: any;
}

// Extended model interfaces with association accessors
export interface UserModel extends AssociableModel<UserAttributes> {
  getRoles(): Promise<RoleModel[]>;
  getTenants(): Promise<TenantModel[]>;
  getAuthenticators(): Promise<AssociableModel<AuthenticatorAttributes>[]>;
  getActivityLogs(): Promise<AssociableModel<ActivityLogAttributes>[]>;
  getLoginHistory(): Promise<AssociableModel<LoginHistoryAttributes>[]>;
  Roles?: RoleModel[];
  Tenants?: TenantModel[];
  Authenticators?: AssociableModel<AuthenticatorAttributes>[];
}

export interface TenantModel extends AssociableModel<TenantAttributes> {
  getUsers(): Promise<UserModel[]>;
  getRoles(): Promise<RoleModel[]>;
  Users?: UserModel[];
  Roles?: RoleModel[];
}

export interface RoleModel extends AssociableModel<RoleAttributes> {
  getUsers(): Promise<UserModel[]>;
  getPermissions(): Promise<PermissionModel[]>;
  Users?: UserModel[];
  Permissions?: PermissionModel[];
}

export interface PermissionModel extends AssociableModel<PermissionAttributes> {
  getRoles(): Promise<RoleModel[]>;
  Roles?: RoleModel[];
}

export interface OAuthClientModel extends AssociableModel<OAuthClientAttributes> {
  getTokens(): Promise<OAuthTokenModel[]>;
  Tokens?: OAuthTokenModel[];
}

export interface OAuthTokenModel extends AssociableModel<OAuthTokenAttributes> {
  getClient(): Promise<OAuthClientModel>;
  getUser(): Promise<UserModel>;
  client?: OAuthClientModel;
  user?: UserModel;
}

/**
 * Model Registry for typed associations
 * This provides a centralized registry of all model types in the application
 * for use in defining relationships between models
 */
export interface ModelRegistry {
  [ModelName.USER]: UserModel;
  [ModelName.TENANT]: TenantModel;
  [ModelName.TENANT_USER]: AssociableModel<TenantUserAttributes>;
  [ModelName.ROLE]: RoleModel;
  [ModelName.PERMISSION]: PermissionModel;
  [ModelName.ACTIVITY_LOG]: AssociableModel<ActivityLogAttributes>;
  [ModelName.LOGIN_HISTORY]: AssociableModel<LoginHistoryAttributes>;
  [ModelName.SECURITY_AUDIT_LOG]: AssociableModel<SecurityAuditLogAttributes>;
  [ModelName.NOTIFICATION]: AssociableModel<NotificationAttributes>;
  [ModelName.AUTHENTICATOR]: AssociableModel<AuthenticatorAttributes>;
  [ModelName.USER_ROLE]: AssociableModel<UserRoleAttributes>;
  [ModelName.ROLE_PERMISSION]: AssociableModel<RolePermissionAttributes>;
  [ModelName.INVITATION]: AssociableModel<InvitationAttributes>;
}

/**
 * Common options for database operations
 * This type provides a consistent structure for database query options
 */
export interface QueryOptions {
  transaction?: unknown;
  where?: Record<string, unknown>;
  include?: unknown[];
  order?: [string, string][];
  limit?: number;
  offset?: number;
  attributes?: string[];
  group?: string[];
  raw?: boolean;
  nest?: boolean;
  paranoid?: boolean;
  [key: string]: unknown;
}

/**
 * Type for database query conditions
 * This provides a more specific type than Record<string, unknown>
 */
export interface QueryCondition {
  [key: string]: string | number | boolean | Date | RegExp | QueryCondition | Array<string | number | boolean | Date | RegExp | QueryCondition>;
}