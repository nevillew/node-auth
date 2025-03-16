import express, { Router, Request, Response } from 'express';
import { trackDelivery, trackOpen, trackClick, getAnalytics } from '../services/emailQueueService';
import emailService from '../services/emailService';
import { authenticateHandler } from '../middleware';

/**
 * Send tracking pixel for email open (pure function)
 */
const handleTrackOpen = (req: Request, res: Response): void => {
  const trackingId = req.params.trackingId;
  
  // Track the open event
  trackOpen(trackingId);
  
  // Return 1x1 transparent pixel
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': 43
  });
  res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
};

/**
 * Handle click tracking and redirect (pure function)
 */
const handleTrackClick = (req: Request, res: Response): void => {
  const trackingId = req.params.trackingId;
  const url = req.query.url as string;
  
  // Track the click event
  trackClick(trackingId);
  
  // Redirect to the target URL
  res.redirect(url);
};

/**
 * Handle email provider webhooks (async function)
 */
const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const event = req.body['event-data'];
  
  if (!event || !event.event) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }
  
  try {
    switch (event.event) {
      case 'bounced':
        await emailService.handleBounce(event);
        break;
      case 'delivered':
        await emailService.handleDelivery(event);
        break;
      // Add more event types as needed
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

/**
 * Get email analytics (pure function)
 */
const getEmailAnalytics = (_req: Request, res: Response): void => {
  res.json(getAnalytics());
};

/**
 * Create and configure email routes (factory function)
 */
const createEmailRouter = (): Router => {
  const router = express.Router();

  // Tracking endpoints
  router.get('/track/:trackingId/open', handleTrackOpen);
  router.get('/track/:trackingId/click', handleTrackClick);

  // Webhook endpoints
  router.post('/webhooks/mailgun', handleWebhook);

  // Analytics endpoint
  router.get('/analytics', authenticateHandler, getEmailAnalytics);

  return router;
};

// Create and export the router
export default createEmailRouter();