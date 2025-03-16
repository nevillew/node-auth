import { User, Notification } from '../models';
import * as emailService from './emailService';
import { Result, success, failure } from '../utils/errors';
import logger from '../config/logger';

// Types for notification service
interface EmailNotificationParams {
  userId: string;
  subject: string;
  message: string;
}

interface SystemNotificationParams {
  userId: string;
  message: string;
}

export interface EmailParams {
  to: string;
  subject: string;
  template?: string;
  html?: string;
  context?: Record<string, any>;
  trackingId?: string;
}

/**
 * Send an email notification to a user
 */
export const sendEmailNotification = async (
  params: EmailNotificationParams
): Promise<Result<boolean>> => {
  try {
    const { userId, subject, message } = params;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return failure({
        message: 'User not found',
        statusCode: 404
      });
    }

    await emailService.sendEmail({
      to: user.email,
      subject,
      html: message
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to send email notification', { error: err });
    return failure({
      message: 'Failed to send email notification',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Send a system notification to a user
 */
export const sendSystemNotification = async (
  userId: string,
  message: string
): Promise<Result<boolean>> => {
  try {
    await Notification.create({
      userId,
      message,
      read: false,
      createdAt: new Date()
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to send system notification', { error: err });
    return failure({
      message: 'Failed to send system notification',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Send an email directly with specified parameters
 */
export const sendEmail = async (
  params: EmailParams
): Promise<Result<boolean>> => {
  try {
    await emailService.sendEmail(params);
    return success(true);
  } catch (err) {
    logger.error('Failed to send email', { error: err });
    return failure({
      message: 'Failed to send email',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};