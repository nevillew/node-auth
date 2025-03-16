export enum ErrorCode {
  // Authentication Errors (1xxx)
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INVALID_TOKEN = "INVALID_TOKEN",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED",
  INVALID_2FA_TOKEN = "INVALID_2FA_TOKEN",
  MFA_CONFIGURATION_ERROR = "MFA_CONFIGURATION_ERROR",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
  PASSKEY_ERROR = "PASSKEY_ERROR",

  // Authorization Errors (2xxx)
  UNAUTHORIZED = "UNAUTHORIZED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  INVALID_SCOPE = "INVALID_SCOPE",
  IP_RESTRICTED = "IP_RESTRICTED",
  ROLE_REQUIRED = "ROLE_REQUIRED",

  // Resource Errors (3xxx)
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_EXISTS = "RESOURCE_EXISTS",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  RESOURCE_DELETED = "RESOURCE_DELETED",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",
  RESOURCE_INACTIVE = "RESOURCE_INACTIVE",
  RESOURCE_VERSION_CONFLICT = "RESOURCE_VERSION_CONFLICT",
  RESOURCE_DEPENDENCY_ERROR = "RESOURCE_DEPENDENCY_ERROR",
  RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED",

  // Validation Errors (4xxx)
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED = "MISSING_REQUIRED",
  INVALID_FORMAT = "INVALID_FORMAT",
  DATA_TYPE_ERROR = "DATA_TYPE_ERROR",
  VALIDATION_COMPLEX = "VALIDATION_COMPLEX",
  PASSWORD_POLICY_VIOLATION = "PASSWORD_POLICY_VIOLATION",
  EMAIL_FORMAT_INVALID = "EMAIL_FORMAT_INVALID",

  // Tenant Errors (5xxx)
  TENANT_NOT_FOUND = "TENANT_NOT_FOUND",
  TENANT_SUSPENDED = "TENANT_SUSPENDED",
  TENANT_LIMIT_EXCEEDED = "TENANT_LIMIT_EXCEEDED",
  TENANT_DELETED = "TENANT_DELETED",
  TENANT_NAME_TAKEN = "TENANT_NAME_TAKEN",
  TENANT_CONFIGURATION_ERROR = "TENANT_CONFIGURATION_ERROR",

  // Rate Limiting Errors (6xxx)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  CONCURRENT_REQUEST_LIMIT = "CONCURRENT_REQUEST_LIMIT",
  API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",

  // Integration Errors (7xxx)
  INTEGRATION_ERROR = "INTEGRATION_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  EMAIL_DELIVERY_FAILED = "EMAIL_DELIVERY_FAILED",
  THIRD_PARTY_API_ERROR = "THIRD_PARTY_API_ERROR",
  WEBHOOK_DELIVERY_FAILED = "WEBHOOK_DELIVERY_FAILED",

  // Database Errors (8xxx)
  DB_CONNECTION_ERROR = "DB_CONNECTION_ERROR",
  DB_QUERY_FAILED = "DB_QUERY_FAILED",
  DB_TRANSACTION_ERROR = "DB_TRANSACTION_ERROR",
  DB_FOREIGN_KEY_VIOLATION = "DB_FOREIGN_KEY_VIOLATION",
  DB_UNIQUE_CONSTRAINT_VIOLATION = "DB_UNIQUE_CONSTRAINT_VIOLATION",
  DB_CHECK_CONSTRAINT_VIOLATION = "DB_CHECK_CONSTRAINT_VIOLATION",
  DB_DEADLOCK = "DB_DEADLOCK",
  DB_TIMEOUT = "DB_TIMEOUT",
  DB_SERIALIZATION_ERROR = "DB_SERIALIZATION_ERROR",

  // System Errors (9xxx)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  MAINTENANCE_MODE = "MAINTENANCE_MODE",
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  TIMEOUT = "TIMEOUT",
  INITIALIZATION_ERROR = "INITIALIZATION_ERROR"
}

export interface ErrorInfo {
  code: number;
  message: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  errorId?: number;
}

export const ErrorCodes: Record<string, ErrorInfo> = {
  // Authentication Errors (1xxx)
  INVALID_CREDENTIALS: {
    code: 1001,
    message: 'Invalid email or password'
  },
  TOKEN_EXPIRED: {
    code: 1002,
    message: 'Authentication token has expired'
  },
  INVALID_TOKEN: {
    code: 1003,
    message: 'Invalid authentication token'
  },
  ACCOUNT_LOCKED: {
    code: 1004,
    message: 'Account is locked due to too many failed attempts'
  },
  TWO_FACTOR_REQUIRED: {
    code: 1005,
    message: '2FA verification required'
  },
  INVALID_2FA_TOKEN: {
    code: 1006,
    message: 'Invalid 2FA verification code'
  },
  MFA_CONFIGURATION_ERROR: {
    code: 1007,
    message: 'Error configuring multi-factor authentication'
  },
  SESSION_EXPIRED: {
    code: 1008,
    message: 'Your session has expired, please login again'
  },
  INVALID_REFRESH_TOKEN: {
    code: 1009,
    message: 'Invalid refresh token'
  },
  PASSKEY_ERROR: {
    code: 1010,
    message: 'Error with passkey authentication'
  },

  // Authorization Errors (2xxx)
  UNAUTHORIZED: {
    code: 2001,
    message: 'You are not authorized to perform this action'
  },
  INSUFFICIENT_PERMISSIONS: {
    code: 2002,
    message: 'Insufficient permissions'
  },
  INVALID_SCOPE: {
    code: 2003,
    message: 'Invalid or missing scope'
  },
  IP_RESTRICTED: {
    code: 2004,
    message: 'Access from this IP address is restricted'
  },
  ROLE_REQUIRED: {
    code: 2005,
    message: 'This action requires a specific role'
  },

  // Resource Errors (3xxx)
  RESOURCE_NOT_FOUND: {
    code: 3001,
    message: 'Requested resource not found'
  },
  RESOURCE_EXISTS: {
    code: 3002,
    message: 'Resource already exists'
  },
  RESOURCE_CONFLICT: {
    code: 3003,
    message: 'Resource conflict'
  },
  RESOURCE_DELETED: {
    code: 3004,
    message: 'Resource has been deleted'
  },
  RESOURCE_LOCKED: {
    code: 3005,
    message: 'Resource is locked and cannot be modified'
  },
  RESOURCE_INACTIVE: {
    code: 3006,
    message: 'Resource is inactive'
  },
  RESOURCE_VERSION_CONFLICT: {
    code: 3007, 
    message: 'Resource has been modified by another user'
  },
  RESOURCE_DEPENDENCY_ERROR: {
    code: 3008,
    message: 'Resource has dependencies that prevent this operation'
  },
  RESOURCE_LIMIT_EXCEEDED: {
    code: 3009,
    message: 'Resource limit exceeded'
  },

  // Validation Errors (4xxx)
  INVALID_INPUT: {
    code: 4001,
    message: 'Invalid input data'
  },
  MISSING_REQUIRED: {
    code: 4002,
    message: 'Required fields are missing'
  },
  INVALID_FORMAT: {
    code: 4003,
    message: 'Invalid data format'
  },
  DATA_TYPE_ERROR: {
    code: 4004,
    message: 'Data type error'
  },
  VALIDATION_COMPLEX: {
    code: 4005,
    message: 'Multiple validation errors occurred'
  },
  PASSWORD_POLICY_VIOLATION: {
    code: 4006,
    message: 'Password does not meet the required security policy'
  },
  EMAIL_FORMAT_INVALID: {
    code: 4007,
    message: 'Email format is invalid'
  },

  // Tenant Errors (5xxx)
  TENANT_NOT_FOUND: {
    code: 5001,
    message: 'Tenant not found'
  },
  TENANT_SUSPENDED: {
    code: 5002,
    message: 'Tenant is suspended'
  },
  TENANT_LIMIT_EXCEEDED: {
    code: 5003,
    message: 'Tenant resource limit exceeded'
  },
  TENANT_DELETED: {
    code: 5004,
    message: 'Tenant has been deleted'
  },
  TENANT_NAME_TAKEN: {
    code: 5005,
    message: 'Tenant name is already taken'
  },
  TENANT_CONFIGURATION_ERROR: {
    code: 5006,
    message: 'Tenant configuration error'
  },

  // Rate Limiting Errors (6xxx)
  RATE_LIMIT_EXCEEDED: {
    code: 6001,
    message: 'Rate limit exceeded'
  },
  TOO_MANY_REQUESTS: {
    code: 6002,
    message: 'Too many requests'
  },
  CONCURRENT_REQUEST_LIMIT: {
    code: 6003,
    message: 'Too many concurrent requests'
  },
  API_QUOTA_EXCEEDED: {
    code: 6004,
    message: 'API quota exceeded for this billing period'
  },

  // Integration Errors (7xxx)
  INTEGRATION_ERROR: {
    code: 7001,
    message: 'External service integration error'
  },
  SERVICE_UNAVAILABLE: {
    code: 7002,
    message: 'External service is unavailable'
  },
  EMAIL_DELIVERY_FAILED: {
    code: 7003,
    message: 'Email delivery failed'
  },
  THIRD_PARTY_API_ERROR: {
    code: 7004,
    message: 'Third-party API error'
  },
  WEBHOOK_DELIVERY_FAILED: {
    code: 7005,
    message: 'Webhook delivery failed'
  },

  // Database Errors (8xxx)
  DB_CONNECTION_ERROR: {
    code: 8001,
    message: 'Database connection error'
  },
  DB_QUERY_FAILED: {
    code: 8002,
    message: 'Database query failed'
  },
  DB_TRANSACTION_ERROR: {
    code: 8003,
    message: 'Database transaction error'
  },
  DB_FOREIGN_KEY_VIOLATION: {
    code: 8004,
    message: 'Foreign key constraint violation'
  },
  DB_UNIQUE_CONSTRAINT_VIOLATION: {
    code: 8005,
    message: 'Unique constraint violation'
  },
  DB_CHECK_CONSTRAINT_VIOLATION: {
    code: 8006,
    message: 'Check constraint violation'
  },
  DB_DEADLOCK: {
    code: 8007,
    message: 'Database deadlock detected'
  },
  DB_TIMEOUT: {
    code: 8008,
    message: 'Database operation timed out'
  },
  DB_SERIALIZATION_ERROR: {
    code: 8009,
    message: 'Database serialization error'
  },

  // System Errors (9xxx)
  INTERNAL_ERROR: {
    code: 9001,
    message: 'Internal server error'
  },
  DATABASE_ERROR: {
    code: 9002,
    message: 'Database operation failed'
  },
  CONFIGURATION_ERROR: {
    code: 9003,
    message: 'System configuration error'
  },
  MAINTENANCE_MODE: {
    code: 9004,
    message: 'System is in maintenance mode'
  },
  FILE_SYSTEM_ERROR: {
    code: 9005,
    message: 'File system error'
  },
  MEMORY_LIMIT_EXCEEDED: {
    code: 9006,
    message: 'Memory limit exceeded'
  },
  TIMEOUT: {
    code: 9007,
    message: 'Operation timed out'
  },
  INITIALIZATION_ERROR: {
    code: 9008,
    message: 'Service initialization error'
  }
};

export const getErrorResponse = (errorCode: keyof typeof ErrorCodes, details: any = null): ErrorResponse => {
  const error = ErrorCodes[errorCode];
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      details
    };
  }

  return {
    code: errorCode,
    message: error.message,
    details,
    errorId: error.code
  };
};

export { ErrorCode as default };