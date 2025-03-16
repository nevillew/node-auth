import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { UserAttributes } from '../types';

const { combine, timestamp, json, errors } = winston.format;

interface ExtendedRequest extends Request {
  id?: string;
  startTime?: number;
  user?: UserAttributes;
  tenant?: { 
    id: string;
    [key: string]: any;
  };
}

// Extended Error interface with code property
interface ExtendedError extends Error {
  code?: string | number;
  statusCode?: number;
  details?: unknown;
  isOperational?: boolean;
}

interface LogInfo {
  [key: string]: any;
  error?: ExtendedError;
  req?: ExtendedRequest;
  environment?: string;
  service?: string;
  version?: string;
}

// Custom format for structured logging
const structuredFormat = winston.format((info: winston.Logform.TransformableInfo & LogInfo) => {
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

// Import metrics (assume it exists in the same directory)
import * as metrics from './metrics';

// Extended logger interface
interface ExtendedLogger extends winston.Logger {
  addRequestContext(req: ExtendedRequest, res: Response, next: NextFunction): void;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    structuredFormat(),
    json(),
    metrics.logMetrics()
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
logger.addRequestContext = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  req.id = req.id || crypto.randomUUID();
  req.startTime = Date.now();
  
  // Log request
  logger.info('Request started', { 
    req,
    correlationId: req.headers['x-correlation-id']
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
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

// Cast to ExtendedLogger to satisfy TypeScript
const extendedLogger = logger as ExtendedLogger;

export default extendedLogger;