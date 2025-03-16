import express, { Router, Request, Response } from 'express';
import { manager } from '../config/database';
import rateLimit from 'express-rate-limit';
import os from 'os';
import { authenticateHandler } from '../middleware';

/**
 * Create rate limiter for health checks (pure factory function)
 */
const createHealthCheckLimiter = () => rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many health check requests'
});

/**
 * Service check result interface
 */
interface ServiceCheck {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  responseTime?: number;
  error?: string;
  [key: string]: any;
}

/**
 * Health check response interface
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  services: Record<string, ServiceCheck>;
  metrics?: any;
  error?: string;
}

/**
 * Check database health with timeout (pure async function)
 */
const checkDatabaseHealth = async (): Promise<ServiceCheck> => {
  const dbStart = Date.now();
  try {
    await Promise.race([
      manager.sequelize.authenticate(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      )
    ]);
    
    const versionResult = await manager.sequelize.query('SELECT version()');
    const version = versionResult[0][0].version;
    
    return {
      status: 'healthy',
      latency: Date.now() - dbStart,
      connections: {
        active: manager.sequelize.connectionManager.pool.size,
        idle: manager.sequelize.connectionManager.pool.idle,
        max: manager.sequelize.connectionManager.pool.max,
        waiting: manager.sequelize.connectionManager.pool.waiting
      },
      version
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      responseTime: Date.now() - dbStart
    };
  }
};

/**
 * Check Redis primary health (pure async function)
 */
const checkRedisHealth = async (): Promise<ServiceCheck> => {
  const redisStart = Date.now();
  try {
    const redisClient = await manager.getRedisClient();
    const [info, memory, clients] = await Promise.all([
      redisClient.info(),
      redisClient.info('memory'),
      redisClient.info('clients')
    ]);
    
    return {
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
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      responseTime: Date.now() - redisStart
    };
  }
};

/**
 * Check Redis replica health if configured (pure async function)
 */
const checkRedisReplicaHealth = async (): Promise<ServiceCheck | null> => {
  if (!process.env.REDIS_REPLICA_URL) {
    return null;
  }
  
  const replicaStart = Date.now();
  try {
    const replica = await manager.getRedisReplica();
    const info = await replica.info();
    return {
      status: 'healthy',
      responseTime: Date.now() - replicaStart,
      replicationLag: info.master_repl_offset - info.slave_repl_offset,
      syncStatus: info.master_sync_in_progress === '0' ? 'in-sync' : 'syncing'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Redis replica error',
      responseTime: Date.now() - replicaStart
    };
  }
};

/**
 * Generate system metrics (pure function)
 */
const generateSystemMetrics = (startTime: number) => {
  return {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      ...process.memoryUsage(),
      freeSystemMemory: os.freemem(),
      totalSystemMemory: os.totalmem()
    },
    cpu: {
      ...process.cpuUsage(),
      loadAvg: os.loadavg(),
      cpus: os.cpus().length
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
};

/**
 * Basic health check handler function (using composed pure functions)
 */
const healthCheckHandler = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const services: Record<string, ServiceCheck> = {
    database: { status: 'unknown' },
    redis: { status: 'unknown' }
  };
  
  let isHealthy = true;

  try {
    // Check database health
    services.database = await checkDatabaseHealth();
    isHealthy = isHealthy && services.database.status === 'healthy';

    // Check Redis primary health
    services.redis = await checkRedisHealth();
    isHealthy = isHealthy && services.redis.status === 'healthy';

    // Check Redis replica health if configured
    const replicaHealth = await checkRedisReplicaHealth();
    if (replicaHealth) {
      services.redisReplica = replicaHealth;
      isHealthy = isHealthy && replicaHealth.status === 'healthy';
    }

    // Generate system metrics
    const metrics = generateSystemMetrics(startTime);

    // Send response with appropriate status code
    const statusCode = isHealthy ? 200 : 503;
    const response: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      services,
      metrics
    };
    
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      services
    });
  }
};

/**
 * Detailed health check handler function
 */
const detailedHealthCheckHandler = async (req: Request, res: Response): Promise<void> => {
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
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    });
  }
};

/**
 * Create and configure health check router (factory function)
 */
const createHealthRouter = (): Router => {
  const router = express.Router();
  const healthCheckLimiter = createHealthCheckLimiter();

  /**
   * Basic health check endpoint to verify system status
   * @route GET /health
   */
  router.get('/health', healthCheckLimiter, healthCheckHandler);

  /**
   * Detailed health check endpoint for internal monitoring
   * @route GET /health/details
   */
  router.get('/health/details', authenticateHandler, detailedHealthCheckHandler);

  return router;
};

// Create and export the router
export default createHealthRouter();