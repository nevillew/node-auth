const express = require('express');
const logger = require('./config/logger');
const app = express();

// Add request logging middleware
app.use(logger.addRequestContext);

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
