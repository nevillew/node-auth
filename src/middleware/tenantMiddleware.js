const { getTenantConnection, manager } = require('../config/database');

async function tenantMiddleware(req, res, next) {
  // Check cache first
  const redisClient = await manager.getRedisClient();
  const tenantId = req.headers['x-tenant'];
  const cacheKey = `tenant:${tenantId}`;
  
  // Try to get cached connection
  const cachedConnection = await redisClient.get(cacheKey);
  
  if (cachedConnection) {
    // Refresh TTL on cache hit
    await redisClient.expire(cacheKey, 3600); // 1 hour TTL
    req.tenantDb = JSON.parse(cachedConnection);
    return next();
  }
  const tenantId = req.headers['x-tenant'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  try {
    req.tenantDb = await getTenantConnection(tenantId);
      
    // Cache the connection details with 1 hour TTL
    await redisClient.setEx(
      cacheKey,
      3600, // 1 hour TTL
      JSON.stringify({
        tenantId,
        databaseUrl: req.tenantDb.config.databaseUrl,
        createdAt: new Date().toISOString()
      })
    );
      
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid tenant' });
  }
}

module.exports = tenantMiddleware;
