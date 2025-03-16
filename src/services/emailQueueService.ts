import Queue from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { User } from '../models';
import logger from '../config/logger';
import * as emailService from './emailService';
import { Result, success, failure } from '../utils/errors';

// Types for email queue
interface EmailJob {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
  trackingId?: string;
}

interface BounceJob {
  email: string;
  reason: string;
  category: string;
}

interface EmailAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complaints: number;
}

// Create queues
export const emailQueue = new Queue<EmailJob>('email', process.env.REDIS_URL || '');
export const bounceQueue = new Queue<BounceJob>('bounce', process.env.REDIS_URL || '');

// Setup Bull Board
export const serverAdapter = new ExpressAdapter();
export const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [new BullAdapter(emailQueue), new BullAdapter(bounceQueue)],
  serverAdapter: serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');

// Email analytics storage
const analytics: EmailAnalytics = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complaints: 0
};

// Process email jobs
emailQueue.process(async (job) => {
  const { to, subject, template, context } = job.data;
  
  try {
    const result = await emailService.sendEmail({
      to,
      subject,
      template,
      context,
      trackingId: job.id
    });

    analytics.sent++;
    return result;
  } catch (error) {
    logger.error('Email sending failed:', { error });
    throw error;
  }
});

// Handle bounces
bounceQueue.process(async (job) => {
  const { email, reason, category } = job.data;
  
  try {
    analytics.bounced++;
    
    // Update user record
    await User.update(
      { emailBounced: true, emailBounceReason: reason },
      { where: { email } }
    );

    // Log bounce
    logger.warn('Email bounce:', { email, reason, category });
    
    return { processed: true };
  } catch (error) {
    logger.error('Bounce processing failed:', { error });
    throw error;
  }
});

/**
 * Get email analytics
 */
export const getAnalytics = (): EmailAnalytics => ({ ...analytics });

/**
 * Track email delivery
 */
export const trackDelivery = async (trackingId: string): Promise<Result<boolean>> => {
  try {
    analytics.delivered++;
    const job = await emailQueue.getJob(trackingId);
    
    if (job) {
      await job.update({ 
        delivered: true, 
        deliveredAt: new Date() 
      });
    }
    
    return success(true);
  } catch (err) {
    logger.error('Failed to track email delivery', { error: err });
    return failure({
      message: 'Failed to track email delivery',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Track email open
 */
export const trackOpen = async (trackingId: string): Promise<Result<boolean>> => {
  try {
    analytics.opened++;
    const job = await emailQueue.getJob(trackingId);
    
    if (job) {
      await job.update({ 
        opened: true, 
        openedAt: new Date() 
      });
    }
    
    return success(true);
  } catch (err) {
    logger.error('Failed to track email open', { error: err });
    return failure({
      message: 'Failed to track email open',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Track email click
 */
export const trackClick = async (trackingId: string): Promise<Result<boolean>> => {
  try {
    analytics.clicked++;
    const job = await emailQueue.getJob(trackingId);
    
    if (job) {
      await job.update({ 
        clicked: true, 
        clickedAt: new Date() 
      });
    }
    
    return success(true);
  } catch (err) {
    logger.error('Failed to track email click', { error: err });
    return failure({
      message: 'Failed to track email click',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};