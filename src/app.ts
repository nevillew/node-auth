import express, { Request, Response, NextFunction } from 'express';
import logger from './config/logger';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';

// Routes
import userRoutes from './routes/userRoutes';
import tenantRoutes from './routes/tenantRoutes';
import notificationRoutes from './routes/notificationRoutes';
import roleRoutes from './routes/roleRoutes';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emailRoutes';
import healthRoutes from './routes/health';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import securityHeaders from './middleware/securityHeaders';
import sanitizeMiddleware from './middleware/sanitize';

const app = express();

// Enable compression
app.use(compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level
}));

// Add security headers
app.use(helmet());

// Enable response caching
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// Load API documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'docs/openapi.yaml'));

// Add request logging middleware
app.use(logger.addRequestContext);

// Serve API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Add security headers
securityHeaders(app);

// Add sanitization middleware
app.use(sanitizeMiddleware);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/roles', roleRoutes);
app.use('/auth', authRoutes);
app.use('/email', emailRoutes);
app.use('/health', healthRoutes);

// Error handler
app.use(errorHandler);

export default app;