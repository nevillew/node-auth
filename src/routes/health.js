const express = require('express');
const router = express.Router();
const { manager } = require('../config/database');

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
