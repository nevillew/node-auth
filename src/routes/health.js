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
  const services = {
    database: { status: 'unknown' },
    redis: { status: 'unknown' },
    redisReplica: { status: 'unknown' }
  };
  let isHealthy = true;

  try {
    // Check database connection
    const dbStart = Date.now();
    try {
      await manager.sequelize.authenticate();
      services.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        connections: manager.sequelize.connectionManager.pool.size,
        maxConnections: manager.sequelize.connectionManager.pool.max
      };
    } catch (error) {
      isHealthy = false;
      services.database = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - dbStart
      };
    }

    // Check Redis primary
    const redisStart = Date.now();
    try {
      const redisClient = await manager.getRedisClient();
      const info = await redisClient.info();
      services.redis = {
        status: 'healthy',
        responseTime: Date.now() - redisStart,
        version: info.redis_version,
        usedMemory: info.used_memory_human,
        connectedClients: info.connected_clients
      };
    } catch (error) {
      isHealthy = false;
      services.redis = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - redisStart
      };
    }

    // Check Redis replica if configured
    if (process.env.REDIS_REPLICA_URL) {
      const replicaStart = Date.now();
      try {
        const replica = await manager.getRedisReplica();
        const info = await replica.info();
        services.redisReplica = {
          status: 'healthy',
          responseTime: Date.now() - replicaStart,
          replicationLag: info.master_repl_offset - info.slave_repl_offset,
          syncStatus: info.master_sync_in_progress === '0' ? 'in-sync' : 'syncing'
        };
      } catch (error) {
        isHealthy = false;
        services.redisReplica = {
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - replicaStart
        };
      }
    } else {
      delete services.redisReplica;
    }

    // System metrics
    const metrics = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      services,
      metrics
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      services
    });
  }
});

/**
 * Detailed health check endpoint for internal monitoring
 * @route GET /health/details
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Promise<void>} JSON response with detailed health status
 */
router.get('/health/details', authenticateHandler, async (req, res) => {
  try {
    const dbStats = await manager.sequelize.query(`
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active_connections,
        count(*) filter (where state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = $1
    `, {
      bind: [process.env.DB_NAME],
      type: manager.sequelize.QueryTypes.SELECT
    });

    const redisClient = await manager.getRedisClient();
    const redisInfo = await redisClient.info();

    const tenantStats = await manager.sequelize.models.Tenant.findAll({
      attributes: [
        'status',
        [manager.sequelize.fn('count', manager.sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    res.json({
      database: {
        connections: dbStats[0],
        poolConfig: manager.sequelize.connectionManager.pool.config,
        queryStats: await manager.sequelize.query('SELECT * FROM pg_stat_statements LIMIT 5')
      },
      redis: {
        info: redisInfo,
        commandStats: await redisClient.info('commandstats'),
        keyspace: await redisClient.info('keyspace')
      },
      application: {
        tenants: tenantStats,
        activeUsers: await manager.sequelize.models.User.count({ where: { status: 'active' } }),
        processStats: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          resourceUsage: process.resourceUsage(),
          uptime: process.uptime()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
