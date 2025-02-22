const axios = require('axios');
const logger = require('../utils/logger');

async function validateToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate token with auth service
    const response = await axios.post(
      `${process.env.AUTH_SERVICE_URL}${process.env.TOKEN_INTROSPECTION_ENDPOINT}`,
      { token },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.data.active) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = response.data.user;
    next();
  } catch (error) {
    logger.error('Token validation failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  validateToken
};
const axios = require('axios');
const logger = require('../utils/logger');

async function validateToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate token with auth service
    const response = await axios.post(
      `${process.env.AUTH_SERVICE_URL}${process.env.TOKEN_INTROSPECTION_ENDPOINT}`,
      { token },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.data.active) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = response.data.user;
    next();
  } catch (error) {
    logger.error('Token validation failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  validateToken
};
