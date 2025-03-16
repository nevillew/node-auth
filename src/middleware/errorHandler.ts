import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppErrorOptions, ErrorCode } from '../types';
import logger from '../config/logger';
import { ErrorCodes, getErrorResponse } from '../constants/errors';

/**
 * Identifies the error type from the error object or message
 * This helps map generic errors to specific error codes
 */
const identifyErrorType = (error: Error): keyof typeof ErrorCodes => {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
  // Database errors
  if (
    errorName.includes('sequelize') || 
    errorName.includes('database') ||
    errorMessage.includes('database') ||
    errorMessage.includes('sql') ||
    errorMessage.includes('query')
  ) {
    // Check for more specific database error types
    if (errorMessage.includes('foreign key') || errorMessage.includes('references')) {
      return 'DB_FOREIGN_KEY_VIOLATION';
    }
    
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      return 'DB_UNIQUE_CONSTRAINT_VIOLATION';
    }
    
    if (errorMessage.includes('check constraint')) {
      return 'DB_CHECK_CONSTRAINT_VIOLATION';
    }
    
    if (errorMessage.includes('deadlock') || errorMessage.includes('could not serialize')) {
      return 'DB_DEADLOCK';
    }
    
    if (errorMessage.includes('timeout')) {
      return 'DB_TIMEOUT';
    }
    
    if (errorMessage.includes('connection')) {
      return 'DB_CONNECTION_ERROR';
    }
    
    if (errorMessage.includes('transaction')) {
      return 'DB_TRANSACTION_ERROR';
    }
    
    return 'DB_QUERY_FAILED';
  }
  
  // Authentication errors
  if (
    errorMessage.includes('authentication') || 
    errorMessage.includes('login') || 
    errorMessage.includes('credentials') ||
    errorMessage.includes('password') ||
    errorMessage.includes('token') ||
    errorMessage.includes('session')
  ) {
    if (errorMessage.includes('expired')) {
      return errorMessage.includes('token') ? 'TOKEN_EXPIRED' : 'SESSION_EXPIRED';
    }
    
    if (errorMessage.includes('invalid') && errorMessage.includes('token')) {
      return 'INVALID_TOKEN';
    }
    
    if (errorMessage.includes('locked')) {
      return 'ACCOUNT_LOCKED';
    }
    
    if (errorMessage.includes('2fa') || errorMessage.includes('two factor')) {
      return errorMessage.includes('required') ? 'TWO_FACTOR_REQUIRED' : 'INVALID_2FA_TOKEN';
    }
    
    return 'INVALID_CREDENTIALS';
  }
  
  // Resource errors
  if (
    errorMessage.includes('not found') || 
    errorMessage.includes('doesn\'t exist') || 
    errorMessage.includes('does not exist')
  ) {
    if (errorMessage.includes('tenant')) {
      return 'TENANT_NOT_FOUND';
    }
    
    return 'RESOURCE_NOT_FOUND';
  }
  
  if (errorMessage.includes('conflict')) {
    if (errorMessage.includes('version') || errorMessage.includes('modified')) {
      return 'RESOURCE_VERSION_CONFLICT';
    }
    
    if (errorMessage.includes('deleted')) {
      return 'RESOURCE_DELETED';
    }
    
    if (errorMessage.includes('locked')) {
      return 'RESOURCE_LOCKED';
    }
    
    if (errorMessage.includes('inactive')) {
      return 'RESOURCE_INACTIVE';
    }
    
    if (errorMessage.includes('dependency') || errorMessage.includes('dependent')) {
      return 'RESOURCE_DEPENDENCY_ERROR';
    }
    
    return 'RESOURCE_CONFLICT';
  }
  
  // Authorization errors
  if (
    errorMessage.includes('unauthorized') || 
    errorMessage.includes('not authorized') || 
    errorMessage.includes('forbidden') ||
    errorMessage.includes('access denied')
  ) {
    if (errorMessage.includes('permission')) {
      return 'INSUFFICIENT_PERMISSIONS';
    }
    
    if (errorMessage.includes('scope')) {
      return 'INVALID_SCOPE';
    }
    
    if (errorMessage.includes('ip')) {
      return 'IP_RESTRICTED';
    }
    
    if (errorMessage.includes('role')) {
      return 'ROLE_REQUIRED';
    }
    
    return 'UNAUTHORIZED';
  }
  
  // Validation errors
  if (
    errorMessage.includes('validation') || 
    errorMessage.includes('invalid') || 
    errorMessage.includes('required') ||
    errorMessage.includes('format')
  ) {
    if (errorMessage.includes('required field')) {
      return 'MISSING_REQUIRED';
    }
    
    if (errorMessage.includes('format')) {
      return 'INVALID_FORMAT';
    }
    
    if (errorMessage.includes('email')) {
      return 'EMAIL_FORMAT_INVALID';
    }
    
    if (errorMessage.includes('password policy')) {
      return 'PASSWORD_POLICY_VIOLATION';
    }
    
    if (errorMessage.includes('multiple')) {
      return 'VALIDATION_COMPLEX';
    }
    
    return 'INVALID_INPUT';
  }
  
  // Rate limiting errors
  if (
    errorMessage.includes('rate limit') || 
    errorMessage.includes('too many requests')
  ) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  
  // External service errors
  if (
    errorMessage.includes('service unavailable') || 
    errorMessage.includes('external service')
  ) {
    return 'SERVICE_UNAVAILABLE';
  }
  
  // Default to internal error
  return 'INTERNAL_ERROR';
};

/**
 * Create an application error with proper structure
 */
export const createAppError = (
  errorCode: keyof typeof ErrorCodes, 
  statusCode = 500, 
  details: Record<string, unknown> | null = null,
  source?: string
): AppErrorOptions => {
  const errorInfo = ErrorCodes[errorCode] || ErrorCodes.INTERNAL_ERROR;
  
  return {
    message: errorInfo.message,
    code: ErrorCode[errorCode as keyof typeof ErrorCode] || ErrorCode.INTERNAL_ERROR,
    statusCode,
    details: details || undefined,
    isOperational: true,
    source
  };
};

/**
 * Transform a generic error into an AppErrorOptions object with a standardized error code
 */
const normalizeError = (err: Error | AppErrorOptions): AppErrorOptions => {
  if ('statusCode' in err && 'code' in err) {
    // Already an AppErrorOptions object, just ensure all required properties exist
    return {
      ...err,
      isOperational: err.isOperational ?? true
    };
  }
  
  // Identify the error type based on the error message and name
  const errorType = identifyErrorType(err);
  const errorInfo = ErrorCodes[errorType];
  
  // Map error type prefix to appropriate HTTP status code
  let statusCode = 500;
  if (errorInfo) {
    const codePrefix = String(errorInfo.code).charAt(0);
    
    switch (codePrefix) {
      case '1': // Authentication
        statusCode = 401;
        break;
      case '2': // Authorization
        statusCode = 403;
        break;
      case '3': // Resource
        statusCode = errorType === 'RESOURCE_NOT_FOUND' ? 404 : 409;
        break;
      case '4': // Validation
        statusCode = 400;
        break;
      case '5': // Tenant
        statusCode = errorType === 'TENANT_NOT_FOUND' ? 404 : 400;
        break;
      case '6': // Rate Limiting
        statusCode = 429;
        break;
      case '7': // Integration
        statusCode = errorType === 'SERVICE_UNAVAILABLE' ? 503 : 502;
        break;
      case '8': // Database
        statusCode = 500;
        break;
      default:
        statusCode = 500;
    }
  }
  
  return {
    message: errorInfo ? errorInfo.message : err.message,
    code: ErrorCode[errorType as keyof typeof ErrorCode] || ErrorCode.INTERNAL_ERROR,
    statusCode,
    originalError: err,
    isOperational: false // Generic errors are not considered operational by default
  };
};

/**
 * Format error response based on environment
 */
const formatErrorResponse = (
  err: AppErrorOptions, 
  requestId: string, 
  includeStack = false
): Record<string, unknown> => {
  // Convert ErrorCode enum value to ErrorCodes key
  const errorCodeKey = Object.keys(ErrorCode).find(key => 
    ErrorCode[key as keyof typeof ErrorCode] === err.code
  ) as keyof typeof ErrorCodes || 'INTERNAL_ERROR';
  
  const response = {
    requestId,
    ...(getErrorResponse(errorCodeKey, err.details)),
  };
  
  return includeStack && err.originalError ? 
    { ...response, stack: err.originalError.stack } : 
    response;
};

/**
 * Log error details based on environment
 */
const logError = (
  err: AppErrorOptions, 
  req: Request, 
  requestId: string
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const logData = {
    requestId,
    errorCode: err.code,
    message: err.message,
    statusCode: err.statusCode,
    details: err.details,
    source: err.source,
    // Include more context in development
    ...(isDevelopment && {
      req: {
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body,
      },
      user: req.user ? {
        id: req.user.id,
        email: req.user.email
      } : null,
      tenant: (req as any).tenant?.id,
      session: (req as any).session?.id,
      correlationId: req.headers['x-correlation-id'],
      performanceMetrics: {
        totalDuration: Date.now() - ((req as any).startTime || Date.now()),
        memoryUsage: process.memoryUsage()
      }
    })
  };

  // Log at appropriate level based on severity
  const codePrefix = String(err.code || '9').charAt(0);
  
  if (isDevelopment) {
    logger.error('Request failed', logData);
  } else if (codePrefix === '9' || codePrefix === '8') {
    // System and database errors are most severe
    logger.error('Error 🔥', logData);
  } else if (codePrefix === '7' || codePrefix === '6' || codePrefix === '2') {
    // Integration, rate limiting, and authorization errors are warnings
    logger.warn('Warning ⚠️', logData);
  } else {
    // Other errors are informational in production
    logger.info('Error', logData);
  }
  
  // Log the stack trace in development or for system/database errors
  if (isDevelopment || codePrefix === '9' || codePrefix === '8') {
    if (err.originalError && err.originalError.stack) {
      logger.error('Stack trace:', err.originalError.stack);
    }
  }
};

/**
 * Error handling middleware
 */
export const errorHandler = (
  err: AppErrorOptions | Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = (req as any).id || randomUUID();
  
  // Normalize error structure
  const appError: AppErrorOptions = normalizeError(err);
    
  // Ensure status code exists
  appError.statusCode = appError.statusCode || 500;
  
  // Log error with appropriate detail level
  logError(appError, req, requestId);
  
  // Send response with appropriate details based on environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment || appError.isOperational) {
    res.status(appError.statusCode).json(
      formatErrorResponse(appError, requestId, isDevelopment)
    );
  } else {
    // For unexpected errors in production, return generic error
    res.status(500).json(
      formatErrorResponse(
        createAppError('INTERNAL_ERROR'), 
        requestId
      )
    );
  }
};

export { ErrorCodes };