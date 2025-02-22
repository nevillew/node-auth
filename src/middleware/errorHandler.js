const logger = require('../config/logger');
const { ErrorCodes, getErrorResponse } = require('../constants/errors');

class AppError extends Error {
  constructor(errorCode, statusCode = 500, details = null) {
    const errorInfo = ErrorCodes[errorCode] || ErrorCodes.INTERNAL_ERROR;
    super(errorInfo.message);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Generate request ID for error tracking
  const requestId = req.id || crypto.randomUUID();

  if (process.env.NODE_ENV === 'development') {
    logger.error('Request failed', { 
      req: req,
      error: err,
      requestId,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      details: err.details,
      user: req.user ? {
        id: req.user.id,
        email: req.user.email
      } : null,
      tenant: req.tenant?.id,
      session: req.session?.id,
      correlationId: req.headers['x-correlation-id'],
      performanceMetrics: {
        totalDuration: Date.now() - req.startTime,
        memoryUsage: process.memoryUsage()
      }
    });
    
    res.status(err.statusCode).json({
      requestId,
      ...getErrorResponse(err.errorCode, err.details),
      stack: err.stack
    });
  } else {
    logger.error('Error 🔥', { 
      requestId,
      errorCode: err.errorCode,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details
    });

    if (err.isOperational) {
      res.status(err.statusCode).json({
        requestId,
        ...getErrorResponse(err.errorCode, err.details)
      });
    } else {
      // For unexpected errors, return generic error
      res.status(500).json({
        requestId,
        ...getErrorResponse('INTERNAL_ERROR')
      });
    }
  }
};

module.exports = {
  AppError,
  errorHandler,
  ErrorCodes
};
