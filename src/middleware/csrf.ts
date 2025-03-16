import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';
import { v4 as uuidv4 } from 'uuid';
import { createAppError } from './errorHandler';
import logger from '../config/logger';
import { SecurityAuditLog } from '../models';
import { timingSafeEqual, randomBytes } from 'crypto';

/**
 * Pure function to create CSRF middleware configuration
 */
const createCsrfConfig = () => ({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  },
  value: (req: Request) => {
    // Get token from header or body
    return req.headers['x-csrf-token'] || (req.body?._csrf as string);
  }
});

/**
 * Configure CSRF protection using the pure configuration
 */
export const csrfProtection = csrf(createCsrfConfig());

/**
 * CSRF token cookie configuration factory (pure function)
 */
const createCookieConfig = (httpOnly = false) => ({
  httpOnly,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 1000 // 24 hours in ms
});

/**
 * Generate a new CSRF token (pure function)
 * Using crypto for better randomness than UUID
 */
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to generate and set CSRF token
 */
export const generateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET/HEAD/OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Generate token using our pure function
  const token = generateToken();
  
  // Set token in cookie and response header
  res.cookie('XSRF-TOKEN', token, createCookieConfig(false));
  res.set('X-CSRF-Token', token);
  
  // Store token in request for validation
  (req as any).csrfToken = token;
  
  next();
};

/**
 * Pure function to check if a request method requires CSRF validation
 */
const isMethodRequireCsrf = (method: string): boolean => {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
};

/**
 * Pure function to compare tokens
 */
const compareTokens = (token1: string, token2: string): boolean => {
  try {
    return timingSafeEqual(Buffer.from(token1), Buffer.from(token2));
  } catch (error) {
    return false;
  }
};

/**
 * Log CSRF validation failure (pure function that returns a side effect)
 */
const logCsrfFailure = (
  req: Request,
  hasRequestToken: boolean,
  hasCookieToken: boolean
) => () => {
  logger.warn('CSRF token issue', { 
    url: req.originalUrl,
    method: req.method,
    hasRequestToken,
    hasCookieToken
  });
};

/**
 * Record security audit for CSRF validation failure (pure function that returns a side effect)
 */
const recordCsrfSecurityAudit = (req: Request) => () => {
  SecurityAuditLog.create({
    userId: (req as any).user?.id,
    event: 'CSRF_VALIDATION_FAILED',
    details: {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    },
    severity: 'high'
  }).catch(err => {
    logger.error('Failed to create security audit log for CSRF failure', err);
  });
};

/**
 * Rotate CSRF token (pure function that returns a configuration for the rotation)
 */
const rotateCsrfToken = () => {
  const newToken = randomBytes(32).toString('hex');
  return {
    token: newToken,
    cookieConfig: {
      ...createCookieConfig(false),
      maxAge: 60 * 60 * 1000 // 1 hour
    }
  };
};

/**
 * Middleware to validate CSRF token
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Skip CSRF for methods that don't need it
    if (!isMethodRequireCsrf(req.method)) {
      return next();
    }

    // Get tokens from request
    const requestToken = (req.headers['x-csrf-token'] as string) || (req.body?._csrf as string);
    const cookieToken = req.cookies?.['XSRF-TOKEN'];
    
    // Check if tokens exist
    if (!requestToken || !cookieToken) {
      // Execute side effect
      logCsrfFailure(req, !!requestToken, !!cookieToken)();
      
      throw createAppError('UNAUTHORIZED', 403, { 
        message: 'CSRF token missing'
      });
    }

    // Compare tokens using timing-safe comparison
    const isValid = compareTokens(requestToken, cookieToken);

    if (!isValid) {
      // Execute side effects
      logCsrfFailure(req, true, true)();
      recordCsrfSecurityAudit(req)();
      
      throw createAppError('UNAUTHORIZED', 403, {
        message: 'CSRF token invalid'
      });
    }

    // Rotate token after successful validation
    const { token, cookieConfig } = rotateCsrfToken();
    res.cookie('XSRF-TOKEN', token, cookieConfig);
    
    next();
  } catch (error) {
    next(error);
  }
};
