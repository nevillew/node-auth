const csrf = require('csurf');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('./errorHandler');
const logger = require('../config/logger');

// Configure CSRF protection
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  },
  value: (req) => {
    // Get token from header or body
    return req.headers['x-csrf-token'] || req.body._csrf;
  }
});

// Generate CSRF token middleware
const generateCsrfToken = (req, res, next) => {
  // Skip CSRF for GET/HEAD/OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Generate token
  const token = uuidv4();
  
  // Set token in cookie and response header
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Allow client-side JS to read
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  });
  
  res.set('X-CSRF-Token', token);
  
  // Store token in request for validation
  req.csrfToken = token;
  
  next();
};

// Validate CSRF token middleware
const crypto = require('crypto');

const validateCsrfToken = (req, res, next) => {
  // Skip CSRF for GET/HEAD/OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get tokens from request
  const requestToken = req.headers['x-csrf-token'] || req.body._csrf;
  const cookieToken = req.cookies['XSRF-TOKEN'];
  
  if (!requestToken || !cookieToken) {
    logger.warn('CSRF token missing', { 
      url: req.originalUrl,
      method: req.method,
      hasRequestToken: !!requestToken,
      hasCookieToken: !!cookieToken
    });
    throw new AppError('CSRF token missing', 403);
  }

  // Use timing-safe comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(requestToken),
    Buffer.from(cookieToken)
  );

  if (!isValid) {
    logger.warn('CSRF token mismatch', { 
      url: req.originalUrl,
      method: req.method 
    });
    
    // Create security audit log
    SecurityAuditLog.create({
      userId: req.user?.id,
      event: 'CSRF_VALIDATION_FAILED',
      details: {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      },
      severity: 'high'
    });

    throw new AppError('CSRF token invalid', 403);
  }

  // Rotate token after successful validation
  const newToken = crypto.randomBytes(32).toString('hex');
  res.cookie('XSRF-TOKEN', newToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000 // 1 hour
  });
  
  next();
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  validateCsrfToken
};
