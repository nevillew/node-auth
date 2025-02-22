const express = require('express');
const router = express.Router();
const { trackDelivery, trackOpen, trackClick, getAnalytics } = require('../services/emailQueueService');
const emailService = require('../services/emailService');
const { authenticateHandler } = require('../middleware/auth');

// Tracking endpoints
router.get('/track/:trackingId/open', (req, res) => {
  trackOpen(req.params.trackingId);
  // Return 1x1 transparent pixel
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': 43
  });
  res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

router.get('/track/:trackingId/click', (req, res) => {
  trackClick(req.params.trackingId);
  res.redirect(req.query.url);
});

// Webhook endpoints
router.post('/webhooks/mailgun', async (req, res) => {
  const event = req.body['event-data'];
  
  switch (event.event) {
    case 'bounced':
      await emailService.handleBounce(event);
      break;
    case 'delivered':
      await emailService.handleDelivery(event);
      break;
  }
  
  res.sendStatus(200);
});

// Analytics endpoint
router.get('/analytics', authenticateHandler, (req, res) => {
  res.json(getAnalytics());
});

module.exports = router;
