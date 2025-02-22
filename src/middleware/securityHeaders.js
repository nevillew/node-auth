const helmet = require('helmet');
const crypto = require('crypto');
const { generateCsrfToken } = require('./csrf');
const sanitizeMiddleware = require('./sanitize');

module.exports = (app) => {
  // Add sanitization middleware
  app.use(sanitizeMiddleware);
  
  // Add CSRF token generation
  app.use(generateCsrfToken);
  
  // Generate nonce for CSP
  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(32).toString('base64');
    next();
  });

  // Configure Helmet with enhanced security headers
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${res.locals.nonce}'`,
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
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
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
    permissionsPolicy: {
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
    },
    hidePoweredBy: true
  }));

  // Additional custom security headers
  app.use((req, res, next) => {
    // Enhanced XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Clear site data on logout (add to logout route)
    if (req.path === '/auth/logout') {
      res.setHeader('Clear-Site-Data', '"cache","cookies","storage"');
    }
    
    // Expect-CT header for Certificate Transparency
    res.setHeader('Expect-CT', 'enforce, max-age=30');
    
    // Feature-Policy header (legacy but still useful)
    res.setHeader('Feature-Policy', 
      "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none';"
    );
    
    // Cross-Origin-Resource-Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Cross-Origin-Opener-Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    // Cross-Origin-Embedder-Policy
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    next();
  });

  // CSP violation reporting endpoint
  app.post('/api/csp-report', (req, res) => {
    const violation = req.body['csp-report'];
    logger.warn('CSP Violation:', violation);
    res.status(204).end();
  });
};
