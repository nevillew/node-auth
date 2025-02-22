const { getTenantConnection, manager } = require('../config/database');

async function tenantMiddleware(req, res, next) {
  // Check cache first
  const redisClient = await manager.getRedisClient();
  const cacheKey = `tenant:${req.headers['x-tenant']}`;
  const cachedTenant = await redisClient.get(cacheKey);
  
  if (cachedTenant) {
    req.tenantDb = JSON.parse(cachedTenant);
    return next();
  }
  const tenantId = req.headers['x-tenant'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  try {
    req.tenantDb = await getTenantConnection(tenantId);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid tenant' });
  }
}

module.exports = tenantMiddleware;
