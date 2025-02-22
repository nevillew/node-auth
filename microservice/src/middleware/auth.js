const axios = require('axios');
const logger = require('../utils/logger');
const dbManager = require('../config/database');
const redisService = require('../services/redisService');

async function validateToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const tenantId = req.headers['x-tenant-id'];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
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
