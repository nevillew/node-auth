const Queue = require('bull');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const logger = require('../config/logger');
const emailService = require('./emailService');

// Create queues
const emailQueue = new Queue('email', process.env.REDIS_URL);
const bounceQueue = new Queue('bounce', process.env.REDIS_URL);

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [new BullAdapter(emailQueue), new BullAdapter(bounceQueue)],
  serverAdapter: serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');

// Email analytics storage
const analytics = {
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
    logger.error('Email sending failed:', error);
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
    logger.error('Bounce processing failed:', error);
    throw error;
  }
});

// Analytics methods
const getAnalytics = () => ({ ...analytics });

const trackDelivery = (trackingId) => {
  analytics.delivered++;
  emailQueue.getJob(trackingId).then(job => {
    job.update({ delivered: true, deliveredAt: new Date() });
  });
};

const trackOpen = (trackingId) => {
  analytics.opened++;
  emailQueue.getJob(trackingId).then(job => {
    job.update({ opened: true, openedAt: new Date() });
  });
};

const trackClick = (trackingId) => {
  analytics.clicked++;
  emailQueue.getJob(trackingId).then(job => {
    job.update({ clicked: true, clickedAt: new Date() });
  });
};

module.exports = {
  emailQueue,
  bounceQueue,
  serverAdapter,
  getAnalytics,
  trackDelivery,
  trackOpen,
  trackClick
};
