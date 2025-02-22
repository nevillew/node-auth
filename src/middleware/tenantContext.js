const { manager } = require('../config/database');
const { isIPInRange } = require('../utils/ipUtils');
const logger = require('../config/logger');

module.exports = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Get tenant connection from cache or database
    const redisClient = await manager.getRedisClient();
    const cacheKey = `tenant:${tenantId}`;
    let tenantDb;

    const cachedTenant = await redisClient.get(cacheKey);
    if (cachedTenant) {
      tenantDb = JSON.parse(cachedTenant);
      await redisClient.expire(cacheKey, 3600); // Refresh TTL
    } else {
      tenantDb = await manager.getTenantConnection(tenantId);
      await redisClient.set(cacheKey, JSON.stringify(tenantDb), { EX: 3600 });
    }

    // Set tenant context
    req.tenant = {
      id: tenantId,
      db: tenantDb
    };

    // Check if tenant is suspended
    const tenant = await tenantDb.models.Tenant.findByPk(tenantId);
    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Tenant is suspended' });
    }

    // Check IP restrictions
    if (tenant.securityPolicy?.ipRestrictions?.enabled) {
      const clientIP = req.ip || req.connection.remoteAddress;
      const { allowedIPs, allowedRanges, blockList } = tenant.securityPolicy.ipRestrictions;

      if (blockList.includes(clientIP)) {
        logger.warn('Blocked IP attempt', { ip: clientIP, tenantId });
        return res.status(403).json({ error: 'IP address is blocked' });
      }

      const isAllowed = allowedIPs.includes(clientIP) || 
                       allowedRanges.some(range => isIPInRange(clientIP, range));

      if (!isAllowed) {
        logger.warn('Unauthorized IP attempt', { ip: clientIP, tenantId });
        return res.status(403).json({ error: 'IP address not allowed' });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
