const winston = require('winston');
const { combine, timestamp, json, errors } = winston.format;

// Custom format for structured logging
const structuredFormat = winston.format((info) => {
  info.environment = process.env.NODE_ENV;
  info.service = process.env.SERVICE_NAME || 'multi-tenant-api';
  info.version = process.env.npm_package_version;
  
  // Add stack trace for errors
  if (info.error instanceof Error) {
    info.error = {
      message: info.error.message,
      stack: info.error.stack,
      code: info.error.code,
      name: info.error.name
    };
  }

  // Add request context if available
  if (info.req) {
    info.request = {
      id: info.req.id,
      method: info.req.method,
      url: info.req.url,
      ip: info.req.ip,
      userAgent: info.req.headers['user-agent'],
      userId: info.req.user?.id,
      tenantId: info.req.tenant?.id
    };
    delete info.req;
  }

  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    structuredFormat(),
    json()
  ),
  defaultMeta: {
    environment: process.env.NODE_ENV,
    service: process.env.SERVICE_NAME || 'multi-tenant-api'
  },
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add request context middleware
logger.addRequestContext = (req, res, next) => {
  req.id = req.id || crypto.randomUUID();
  req.startTime = Date.now();
  
  // Log request
  logger.info('Request started', { 
    req,
    correlationId: req.headers['x-correlation-id']
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      req,
      response: {
        statusCode: res.statusCode,
        duration
      },
      correlationId: req.headers['x-correlation-id']
    });
  });

  next();
};

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
