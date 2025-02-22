const ErrorCodes = {
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

  // Rate Limiting Errors (6xxx)
  RATE_LIMIT_EXCEEDED: {
    code: 6001,
    message: 'Rate limit exceeded'
  },
  TOO_MANY_REQUESTS: {
    code: 6002,
    message: 'Too many requests'
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
  }
};

const getErrorResponse = (errorCode, details = null) => {
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

module.exports = {
  ErrorCodes,
  getErrorResponse
};
