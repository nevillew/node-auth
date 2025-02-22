const axios = require('axios');
const logger = require('../utils/logger');
const dbManager = require('../config/database');
const redisService = require('../services/redisService');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Rate limiting configuration
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisService.client,
    prefix: 'rate_limit_auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later'
});

async function validateToken(req, res, next) {
  try {
    // Validate authorization header format
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length < 10) { // Basic token length validation
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId || !tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid tenant ID format' });
    }

    // Check Redis cache first
    const cachedToken = await redisService.get(`token:${token}`);
    let tokenData;

    if (cachedToken) {
      tokenData = cachedToken;
      logger.debug('Token found in cache');
    } else {
      // Validate token with auth service
      const response = await axios.post(
        `${process.env.AUTH_SERVICE_URL}${process.env.TOKEN_INTROSPECTION_ENDPOINT}`,
        { token },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.data.active) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      tokenData = response.data;
      // Cache token data for 5 minutes
      await redisService.set(`token:${token}`, tokenData, 300);
    }

    if (!tokenData.active) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user has access to requested tenant
    const userTenants = response.data.user.tenants || [];
    if (!userTenants.includes(tenantId)) {
      return res.status(403).json({ error: 'User does not have access to this tenant' });
    }

    // Get tenant database connection
    const tenantDb = await dbManager.getTenantConnection(tenantId);

    // Add user and tenant info to request
    req.user = response.data.user;
    req.tenant = {
      id: tenantId,
      db: tenantDb
    };

    next();
  } catch (error) {
    logger.error('Token validation failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  validateToken
};
