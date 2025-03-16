import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';
import path from 'path';
import Email from 'email-templates';
import { Result, success, failure } from '../utils/errors';
import logger from '../config/logger';
import { emailQueue, bounceQueue } from './emailQueueService';

// Email service types
export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  html?: string;
  context?: Record<string, any>;
  trackingId?: string;
}

interface BounceData {
  recipient: string;
  error: string;
  category: string;
}

interface DeliveryData {
  trackingId: string;
}

// Mailgun auth with webhooks
const auth = {
  auth: {
    api_key: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || ''
  },
  webhookUrl: process.env.EMAIL_WEBHOOK_URL
};

// Create transporter
const transporter = nodemailer.createTransport(mg(auth));

// Configure email templates
const emailTemplates = new Email({
  message: {
    from: process.env.EMAIL_FROM || 'no-reply@example.com'
  },
  transport: transporter,
  views: {
    root: path.join(__dirname, '../emails/templates'),
    options: {
      extension: 'hbs'
    }
  },
  preview: process.env.NODE_ENV !== 'production',
  send: true
});

/**
 * Send a verification email
 */
export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationUrl: string
): Promise<Result<boolean>> => {
  try {
    await emailQueue.add({
      template: 'verification',
      to: email,
      subject: 'Verify your email address',
      context: {
        name,
        verificationUrl,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
      }
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to send verification email', { error: err });
    return failure({
      message: 'Failed to send verification email',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Send a password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string
): Promise<Result<boolean>> => {
  try {
    await emailQueue.add({
      template: 'password-reset',
      to: email,
      subject: 'Password Reset Request',
      context: {
        name,
        resetUrl,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
      }
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to send password reset email', { error: err });
    return failure({
      message: 'Failed to send password reset email',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Send a welcome email
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<Result<boolean>> => {
  try {
    await emailQueue.add({
      template: 'welcome',
      to: email,
      subject: 'Welcome to Our Platform!',
      context: {
        name,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
      }
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to send welcome email', { error: err });
    return failure({
      message: 'Failed to send welcome email',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Send a generic email
 */
export const sendEmail = async (options: EmailOptions): Promise<Result<boolean>> => {
  try {
    const { to, subject, template, html, context = {}, trackingId } = options;
    
    // Add tracking pixel and click tracking if trackingId is provided
    const enrichedContext = { ...context };
    
    if (trackingId) {
      enrichedContext.trackingPixel = `${process.env.API_URL}/email/track/${trackingId}/open`;
      
      // Wrap links with tracking
      if (enrichedContext.verificationUrl) {
        enrichedContext.verificationUrl = `${process.env.API_URL}/email/track/${trackingId}/click?url=${encodeURIComponent(enrichedContext.verificationUrl)}`;
      }
      
      if (enrichedContext.resetUrl) {
        enrichedContext.resetUrl = `${process.env.API_URL}/email/track/${trackingId}/click?url=${encodeURIComponent(enrichedContext.resetUrl)}`;
      }
    }

    if (template) {
      await emailTemplates.send({
        template,
        message: {
          to,
          subject,
        },
        locals: enrichedContext
      });
    } else if (html) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@example.com',
        to,
        subject,
        html
      });
    } else {
      return failure({
        message: 'Either template or html must be provided',
        statusCode: 400
      });
    }

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

/**
 * Handle email bounce webhook
 */
export const handleBounce = async (data: BounceData): Promise<Result<boolean>> => {
  try {
    await bounceQueue.add({
      email: data.recipient,
      reason: data.error,
      category: data.category
    });

    return success(true);
  } catch (err) {
    logger.error('Failed to handle email bounce', { error: err });
    return failure({
      message: 'Failed to handle email bounce',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Handle email delivery webhook
 */
export const handleDelivery = async (data: DeliveryData): Promise<Result<boolean>> => {
  try {
    const job = await emailQueue.getJob(data.trackingId);
    
    if (job) {
      await job.update({ 
        delivered: true, 
        deliveredAt: new Date() 
      });
    }

    return success(true);
  } catch (err) {
    logger.error('Failed to handle email delivery', { error: err });
    return failure({
      message: 'Failed to handle email delivery',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};