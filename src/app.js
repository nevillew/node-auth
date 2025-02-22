const express = require('express');
const logger = require('./config/logger');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Enable compression
app.use(compression({
  filter: (req, res) => {
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
app.use((req, res, next) => {
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
require('./middleware/securityHeaders')(app);

// Add sanitization middleware
const sanitizeMiddleware = require('./middleware/sanitize');
app.use(sanitizeMiddleware);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/auth', require('./routes/auth'));
app.use('/email', require('./routes/emailRoutes'));
app.use('/health', require('./routes/health'));

// Error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
