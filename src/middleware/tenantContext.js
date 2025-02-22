const { manager } = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Get tenant connection
    const tenantDb = await manager.getTenantConnection(tenantId);
    
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

      // Check if IP is blocked
      if (blockList.includes(clientIP)) {
        logger.warn('Blocked IP attempt', { ip: clientIP, tenantId });
        return res.status(403).json({ error: 'IP address is blocked' });
      }

      // Check if IP is explicitly allowed
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
