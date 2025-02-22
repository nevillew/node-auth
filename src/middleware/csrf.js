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
const validateCsrfToken = (req, res, next) => {
  // Skip CSRF for GET/HEAD/OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from request
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    logger.warn('CSRF token missing', { 
      url: req.originalUrl,
      method: req.method 
    });
    throw new AppError('CSRF token missing', 403);
  }

  // Verify token matches
  if (token !== req.csrfToken) {
    logger.warn('CSRF token mismatch', { 
      url: req.originalUrl,
      method: req.method 
    });
    throw new AppError('CSRF token invalid', 403);
  }

  next();
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  validateCsrfToken
};
