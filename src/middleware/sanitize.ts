import { Request, Response, NextFunction } from 'express';
import { sanitizeObject, validateContentSecurityPolicy } from '../utils/sanitize';
import logger from '../config/logger';
import { createAppError } from './errorHandler';
import { handleResult } from '../utils/errors';

/**
 * Apply sanitization to a request property using a pure function approach
 */
const sanitizeRequestProperty = (prop: any): any => {
  if (!prop) return prop;
  
  const result = sanitizeObject(prop);
  
  return handleResult(
    result,
    (sanitized) => sanitized,
    (error) => {
      throw new Error(`Sanitization failed: ${error.message}`);
    }
  );
};

/**
 * Create security headers for responses (pure function)
 */
const createSecurityHeaders = (): Record<string, string> => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
});

/**
 * Log sanitization events (pure function returning a side effect)
 */
const logSanitization = (req: Request) => {
  return (sanitized: Record<string, any>) => {
    logger.warn('Content sanitized', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      sanitized
    });
  };
};

/**
 * Validate CSP header (pure function)
 */
const checkContentSecurityPolicy = (header?: string): void => {
  if (!header) return;
  
  const result = validateContentSecurityPolicy(header);
  
  handleResult(
    result,
    () => {}, // Valid - do nothing
    (error) => {
      throw new Error(`CSP validation failed: ${error.message}`);
    }
  );
};

/**
 * Middleware to sanitize request data
 */
const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const sanitized: Record<string, any> = {};
    
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeRequestProperty(req.body);
      sanitized.body = true;
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeRequestProperty(req.query);
      sanitized.query = true;
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeRequestProperty(req.params);
      sanitized.params = true;
    }
    
    // Sanitize headers
    if (req.headers) {
      const sanitizedHeaders: Record<string, string | string[]> = {};
      
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          sanitizedHeaders[key] = sanitizeRequestProperty(value);
        } else if (Array.isArray(value)) {
          sanitizedHeaders[key] = value.map(item => 
            typeof item === 'string' ? sanitizeRequestProperty(item) : item
          );
        } else {
          sanitizedHeaders[key] = value;
        }
      }
      
      // Headers are read-only in Express, can't directly reassign
      Object.assign(req.headers, sanitizedHeaders);
      sanitized.headers = true;
    }
    
    // Validate Content-Security-Policy
    checkContentSecurityPolicy(req.headers['content-security-policy'] as string);

    // Add security headers to response
    const securityHeaders = createSecurityHeaders();
    Object.entries(securityHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    
    // Save sanitized state for logging
    (req as any).sanitized = sanitized;
    
    // Log sanitization events
    if (Object.keys(sanitized).length > 0) {
      logSanitization(req)(sanitized);
    }

    next();
  } catch (error) {
    logger.error('Sanitization error:', error);
    next(createAppError('INVALID_INPUT', 400, {
      message: 'Input validation failed',
      details: error instanceof Error ? error.message : String(error)
    }));
  }
};

export default sanitizeMiddleware;