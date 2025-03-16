import { Op } from 'sequelize';
import { SecurityAuditLog, User } from '../models';
import { SecurityAuditLogAttributes } from '../types';
import { Result, success, failure, ErrorCode } from '../utils/errors';
import logger from '../config/logger';

// Types for security audit service
interface AuditHistoryOptions {
  startDate?: string;
  endDate?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  event?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

interface AuditHistoryResult {
  logs: SecurityAuditLogAttributes[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Build the where clause for audit log queries
 */
const buildWhereClause = (
  options: AuditHistoryOptions,
  userId?: string
): Record<string, any> => {
  const where: Record<string, any> = {};
  
  if (userId) {
    where.userId = userId;
  } else if (options.userId) {
    where.userId = options.userId;
  }
  
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt[Op.gte] = new Date(options.startDate);
    if (options.endDate) where.createdAt[Op.lte] = new Date(options.endDate);
  }
  
  if (options.severity) where.severity = options.severity;
  if (options.event) where.event = options.event;
  
  return where;
};

/**
 * Fetch audit logs with pagination and formatting
 */
const fetchAuditLogs = async (
  where: Record<string, any>,
  options: AuditHistoryOptions
): Promise<Result<AuditHistoryResult>> => {
  try {
    const {
      page = 1,
      limit = 20,
      sortOrder = 'DESC'
    } = options;
    
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
    
    return success({
      logs: logs.rows.map(log => log.toJSON()) as SecurityAuditLogAttributes[],
      total: logs.count,
      page,
      totalPages: Math.ceil(logs.count / limit)
    });
  } catch (err) {
    logger.error('Error fetching audit logs:', { error: err });
    return failure({
      message: 'Error fetching audit logs',
      statusCode: 500,
      code: ErrorCode.DATABASE_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Get audit history for a specific user
 */
export const getUserAuditHistory = async (
  userId: string,
  options: AuditHistoryOptions = {}
): Promise<Result<AuditHistoryResult>> => {
  const where = buildWhereClause(options, userId);
  return fetchAuditLogs(where, options);
};

/**
 * Get audit history for a tenant
 */
export const getTenantAuditHistory = async (
  tenantId: string,
  options: AuditHistoryOptions = {}
): Promise<Result<AuditHistoryResult>> => {
  const where = buildWhereClause(options);
  // Add tenant-specific logic here when tenant filtering is implemented
  // For now, we're just using the same approach as getUserAuditHistory
  return fetchAuditLogs(where, options);
};
