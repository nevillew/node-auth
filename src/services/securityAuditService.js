const { SecurityAuditLog, User } = require('../models');
const { Op } = require('sequelize');

class SecurityAuditService {
  async getUserAuditHistory(userId, options = {}) {
    const {
      startDate,
      endDate,
      severity,
      event,
      page = 1,
      limit = 20,
      sortOrder = 'DESC'
    } = options;

    const where = { userId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    if (severity) where.severity = severity;
    if (event) where.event = event;

    const logs = await SecurityAuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        attributes: ['email', 'name']
      }],
      order: [['createdAt', sortOrder]],
      limit,
      offset: (page - 1) * limit
    });

    return {
      logs: logs.rows,
      total: logs.count,
      page,
      totalPages: Math.ceil(logs.count / limit)
    };
  }
}

module.exports = new SecurityAuditService();
