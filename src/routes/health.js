const express = require('express');
const router = express.Router();
const { manager } = require('../config/database');

const rateLimit = require('express-rate-limit');

// Rate limit health checks
const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many health check requests'
});

/**
 * Basic health check endpoint to verify system status
 * @route GET /health
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Promise<void>} JSON response with health status
 */
router.get('/health', healthCheckLimiter, async (req, res) => {
  const startTime = Date.now();
  const services = {
    database: { status: 'unknown', latency: 0 },
    redis: { status: 'unknown', latency: 0 },
    redisReplica: { status: 'unknown', latency: 0 },
    cache: { status: 'unknown', latency: 0 }
  };
  let isHealthy = true;

  try {
    // Check database connection with timeout
    const dbStart = Date.now();
    try {
      await Promise.race([
        manager.sequelize.authenticate(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);
      services.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
        connections: {
          active: manager.sequelize.connectionManager.pool.size,
          idle: manager.sequelize.connectionManager.pool.idle,
          max: manager.sequelize.connectionManager.pool.max,
          waiting: manager.sequelize.connectionManager.pool.waiting
        },
        version: (await manager.sequelize.query('SELECT version()'))[0][0].version
      };
    } catch (error) {
      isHealthy = false;
      services.database = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - dbStart
      };
    }

    // Check Redis primary with timeout
    const redisStart = Date.now();
    try {
      const redisClient = await manager.getRedisClient();
      const [info, memory, clients] = await Promise.all([
        redisClient.info(),
        redisClient.info('memory'),
        redisClient.info('clients')
      ]);
      
      services.redis = {
        status: 'healthy',
        latency: Date.now() - redisStart,
        version: info.redis_version,
        memory: {
          used: memory.used_memory_human,
          peak: memory.used_memory_peak_human,
          fragmentation: memory.mem_fragmentation_ratio
        },
        clients: {
          connected: parseInt(clients.connected_clients),
          maxClients: parseInt(clients.maxclients),
          blockedClients: parseInt(clients.blocked_clients)
        },
        keyspace: {
          totalKeys: await redisClient.dbsize(),
          expires: info.expired_keys
        }
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

    // Enhanced system metrics
    const metrics = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        ...process.memoryUsage(),
        freeSystemMemory: require('os').freemem(),
        totalSystemMemory: require('os').totalmem()
      },
      cpu: {
        ...process.cpuUsage(),
        loadAvg: require('os').loadavg(),
        cpus: require('os').cpus().length
      },
      process: {
        pid: process.pid,
        ppid: process.ppid,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      },
      resourceUsage: process.resourceUsage(),
      responseTime: Date.now() - startTime
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
