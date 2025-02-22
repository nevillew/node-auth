const express = require('express');
const router = express.Router();
const { manager } = require('../config/database');

/**
 * Health check endpoint to verify system status
 * @route GET /health
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Promise<void>} JSON response with health status
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await manager.sequelize.authenticate();
    
    // Check Redis connection
    const redisClient = await manager.getRedisClient();
    await redisClient.ping();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'Service Unavailable',
      error: error.message
    });
  }
});

module.exports = router;
