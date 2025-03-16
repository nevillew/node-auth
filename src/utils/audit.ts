import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { Result, success, failure } from './errors';
import logger from '../config/logger';
import { SecurityAuditLog, ActivityLog } from '../models';

// Types for audit logging
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogParams {
  userId: string;
  event: string;
  details?: Record<string, any>;
  severity: AuditSeverity;
  transaction?: Transaction;
}

export interface ActivityLogParams {
  userId: string;
  action: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  transaction?: Transaction;
}

/**
 * Create a security audit log entry
 * 
 * @param params Audit log parameters
 * @returns Result with success or failure
 */
export const createSecurityAuditLog = async (
  params: AuditLogParams
): Promise<Result<void>> => {
  try {
    await SecurityAuditLog.create({
      id: uuidv4(),
      userId: params.userId,
      event: params.event,
      details: params.details || {},
      severity: params.severity,
      createdAt: new Date()
    }, { 
      transaction: params.transaction 
    });
    
    return success(undefined);
  } catch (err) {
    logger.error('Failed to create security audit log:', { error: err });
    return failure({
      message: 'Failed to create security audit log',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Create an activity log entry
 * 
 * @param params Activity log parameters
 * @returns Result with success or failure
 */
export const createActivityLog = async (
  params: ActivityLogParams
): Promise<Result<void>> => {
  try {
    await ActivityLog.create({
      id: uuidv4(),
      userId: params.userId,
      action: params.action,
      details: params.details || {},
      ip: params.ip,
      userAgent: params.userAgent,
      createdAt: new Date()
    }, { 
      transaction: params.transaction 
    });
    
    return success(undefined);
  } catch (err) {
    logger.error('Failed to create activity log:', { error: err });
    return failure({
      message: 'Failed to create activity log',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Log a security event with appropriate severity level
 * 
 * @param event Security event type
 * @param userId User ID
 * @param details Additional details
 * @param severity Severity level
 * @param transaction Optional transaction
 * @returns Result with success or failure
 */
export const logSecurityEvent = async (
  event: string,
  userId: string,
  details?: Record<string, any>,
  severity: AuditSeverity = 'medium',
  transaction?: Transaction
): Promise<Result<void>> => {
  return createSecurityAuditLog({
    userId,
    event,
    details,
    severity,
    transaction
  });
};

/**
 * Log a user activity
 * 
 * @param action Activity action
 * @param userId User ID
 * @param details Additional details
 * @param req Optional request object for IP and user agent
 * @param transaction Optional transaction
 * @returns Result with success or failure
 */
export const logActivity = async (
  action: string,
  userId: string,
  details?: Record<string, any>,
  req?: { ip?: string; headers?: { 'user-agent'?: string } },
  transaction?: Transaction
): Promise<Result<void>> => {
  return createActivityLog({
    userId,
    action,
    details,
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    transaction
  });
};