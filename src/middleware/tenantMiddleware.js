const { getTenantConnection } = require('../config/database');

async function tenantMiddleware(req, res, next) {
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
