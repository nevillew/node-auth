const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const logger = require('./utils/logger');
const { validateToken } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth middleware for all routes
app.use(validateToken);

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
