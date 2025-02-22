const { sanitizeObject, validateContentSecurityPolicy } = require('../utils/sanitize');
const logger = require('../config/logger');
const { AppError } = require('./errorHandler');

const sanitizeMiddleware = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    // Sanitize headers
    if (req.headers) {
      const sanitizedHeaders = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          sanitizedHeaders[key] = sanitizeObject(value);
        } else {
          sanitizedHeaders[key] = value;
        }
      }
      req.headers = sanitizedHeaders;
    }

    // Validate Content-Security-Policy
    if (req.headers['content-security-policy']) {
      validateContentSecurityPolicy(req.headers['content-security-policy']);
    }

    // Add security headers to response
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Log sanitization events
    if (req.sanitized) {
      logger.warn('Content sanitized', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        sanitized: req.sanitized
      });
    }

    next();
  } catch (error) {
    logger.error('Sanitization error:', error);
    next(new AppError('INVALID_INPUT', 400, {
      message: 'Input validation failed',
      details: error.message
    }));
  }
};

module.exports = sanitizeMiddleware;
