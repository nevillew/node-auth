/**
 * Middleware Index
 * 
 * This file provides a centralized place to import and export all middlewares
 * allowing for easy importing from a single location.
 */

import { authenticateHandler, authorizeHandler, tokenHandler } from './auth';
import { errorHandler, createAppError } from './errorHandler';
import { validate, commonSchemas, validateSchema } from './validate';
import sanitizeMiddleware from './sanitize';
import { upload, uploadToS3 } from './fileUpload';
import configureSecurityHeaders from './securityHeaders';
import tenantContextMiddleware from './tenantContext';
import { csrfProtection, generateCsrfToken, validateCsrfToken } from './csrf';

export {
  // Auth middleware
  authenticateHandler,
  authorizeHandler,
  tokenHandler,
  
  // Error handling
  errorHandler,
  createAppError,
  
  // Validation
  validate,
  commonSchemas,
  validateSchema,
  
  // Sanitization
  sanitizeMiddleware,
  
  // File handling
  upload,
  uploadToS3,
  
  // Security
  configureSecurityHeaders,
  
  // Tenant context
  tenantContextMiddleware,
  
  // CSRF protection
  csrfProtection,
  generateCsrfToken,
  validateCsrfToken
};