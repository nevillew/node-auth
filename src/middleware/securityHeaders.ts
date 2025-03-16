import { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { randomBytes } from 'crypto';
import { generateCsrfToken } from './csrf';
import sanitizeMiddleware from './sanitize';
import logger from '../config/logger';

/**
 * Generate a random nonce for CSP (pure function)
 */
const generateNonce = (): string => {
  return randomBytes(32).toString('base64');
};

/**
 * Create Helmet CSP configuration (pure function)
 */
const createCspConfig = () => ({
  useDefaults: true,
  directives: {
    defaultSrc: ["'none'"],
    scriptSrc: [
      "'self'",
      (req: Request, res: Response) => `'nonce-${res.locals.nonce}'`,
      'https://cdn.jsdelivr.net'
    ],
    styleSrc: [
      "'self'",
      'https://cdn.jsdelivr.net',
      "'unsafe-inline'" // Only if absolutely necessary
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https://*.googleusercontent.com',
      'https://cdn.jsdelivr.net'
    ],
    fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    connectSrc: [
      "'self'",
      'https://api.example.com' // Replace with actual API domains
    ],
    mediaSrc: ["'none'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
    sandbox: [
      'allow-forms',
      'allow-scripts',
      'allow-same-origin',
      'allow-popups'
    ],
    reportUri: '/api/csp-report'
  }
});

/**
 * Create permissions policy configuration (pure function)
 */
const createPermissionsPolicy = () => ({
  features: {
    accelerometer: [],
    ambientLightSensor: [],
    autoplay: [],
    battery: [],
    camera: [],
    displayCapture: [],
    documentDomain: [],
    encryptedMedia: [],
    fullscreen: [],
    geolocation: [],
    gyroscope: [],
    magnetometer: [],
    microphone: [],
    midi: [],
    payment: [],
    pictureInPicture: [],
    usb: [],
    xr: []
  }
});

/**
 * Create HSTS configuration (pure function)
 */
const createHstsConfig = () => ({
  maxAge: 31536000, // One year in seconds
  includeSubDomains: true,
  preload: true
});

/**
 * Create custom security headers (pure function)
 */
const createCustomHeaders = (path: string): Record<string, string> => {
  const headers: Record<string, string> = {
    // Enhanced XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Cross-Origin-Embedder-Policy
    'Cross-Origin-Embedder-Policy': 'require-corp',
    
    // Cross-Origin-Opener-Policy
    'Cross-Origin-Opener-Policy': 'same-origin',
    
    // Cross-Origin-Resource-Policy
    'Cross-Origin-Resource-Policy': 'same-origin',
    
    // Permissions-Policy
    'Permissions-Policy': 
      "camera=(), microphone=(), geolocation=(), payment=(), " +
      "usb=(), bluetooth=(), serial=(), nfc=(), " +
      "ambient-light-sensor=(), accelerometer=(), gyroscope=(), magnetometer=()",
    
    // Cache-Control
    'Cache-Control': 'no-store, max-age=0',
    
    // Strict-Transport-Security with includeSubDomains and preload
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Expect-CT header for Certificate Transparency
    'Expect-CT': 'enforce, max-age=30',
    
    // Feature-Policy header (legacy but still useful)
    'Feature-Policy': 
      "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none';",
  };
  
  // Clear site data on logout
  if (path === '/auth/logout') {
    headers['Clear-Site-Data'] = '"cache","cookies","storage"';
  }
  
  return headers;
};

/**
 * Apply custom headers middleware (pure function returning a middleware)
 */
const applyCustomHeaders = () => (req: Request, res: Response, next: NextFunction) => {
  const headers = createCustomHeaders(req.path);
  
  // Set all headers
  Object.entries(headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });
  
  next();
};

/**
 * Handle CSP violations (pure function returning a middleware)
 */
const handleCspViolation = () => (req: Request, res: Response) => {
  const violation = req.body?.['csp-report'];
  logger.warn('CSP Violation:', violation);
  res.status(204).end();
};

/**
 * Set nonce for CSP (pure function returning a middleware)
 */
const setNonce = () => (req: Request, res: Response, next: NextFunction) => {
  res.locals.nonce = generateNonce();
  next();
};

/**
 * Configure and apply all security middleware to the application
 */
const configureSecurityHeaders = (app: Application): void => {
  // Add sanitization middleware
  app.use(sanitizeMiddleware);
  
  // Add CSRF token generation
  app.use(generateCsrfToken);
  
  // Generate nonce for CSP
  app.use(setNonce());

  // Configure Helmet with enhanced security headers
  app.use(helmet({
    contentSecurityPolicy: createCspConfig(),
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: createHstsConfig(),
    referrerPolicy: {
      policy: ['no-referrer', 'strict-origin-when-cross-origin']
    },
    noSniff: true,
    dnsPrefetchControl: {
      allow: false
    },
    frameguard: {
      action: 'deny'
    },
    permissionsPolicy: createPermissionsPolicy(),
    hidePoweredBy: true
  }));

  // Apply additional custom security headers
  app.use(applyCustomHeaders());

  // CSP violation reporting endpoint
  app.post('/api/csp-report', handleCspViolation());
};

export default configureSecurityHeaders;