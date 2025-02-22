const { redisClient } = require('../config/redis');
const fallbackCache = require('./fallbackCache');
const logger = require('../config/logger');

class TokenIntrospectionService {
  constructor() {
    this.cacheTTL = 3600; // 1 hour cache
  }

  async introspectToken(token) {
    try {
      // Check cache first
      const cached = await this.getCachedIntrospection(token);
      if (cached) {
        return cached;
      }

      // Get token details from database
      const tokenRecord = await OAuthToken.findOne({
        where: { accessToken: token },
        include: [
          { 
            model: User,
            attributes: ['id', 'email', 'status']
          },
          {
            model: OAuthClient,
            attributes: ['id', 'name', 'type']
          }
        ]
      });

      if (!tokenRecord) {
        return { active: false };
      }

      const introspection = {
        active: !tokenRecord.revoked && new Date() < tokenRecord.expiresAt,
        client_id: tokenRecord.OAuthClient.id,
        client_name: tokenRecord.OAuthClient.name,
        client_type: tokenRecord.OAuthClient.type,
        username: tokenRecord.User?.email,
        user_id: tokenRecord.User?.id,
        user_status: tokenRecord.User?.status,
        scope: tokenRecord.scopes?.join(' '),
        exp: Math.floor(tokenRecord.expiresAt.getTime() / 1000),
        iat: Math.floor(tokenRecord.createdAt.getTime() / 1000)
      };

      // Cache the result
      await this.cacheIntrospection(token, introspection);

      return introspection;
    } catch (error) {
      logger.error('Token introspection failed:', error);
      throw error;
    }
  }

  async getCachedIntrospection(token) {
    try {
      const cacheKey = `token:${token}:introspection`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        const introspection = JSON.parse(cached);
        // Check if cached introspection is still valid
        if (introspection.exp * 1000 > Date.now()) {
          return introspection;
        }
        // Remove expired cache entry
        await redisClient.del(cacheKey);
      }
      return null;
    } catch (error) {
      logger.warn('Redis cache read failed, using fallback:', error);
      return fallbackCache.get(`token:${token}:introspection`);
    }
  }

  async cacheIntrospection(token, introspection) {
    const cacheKey = `token:${token}:introspection`;
    try {
      await redisClient.set(
        cacheKey,
        JSON.stringify(introspection),
        'EX',
        this.cacheTTL
      );
    } catch (error) {
      logger.warn('Redis cache write failed, using fallback:', error);
      await fallbackCache.set(
        cacheKey,
        introspection,
        this.cacheTTL
      );
    }
  }

  async revokeToken(token) {
    try {
      // Remove from cache
      const cacheKey = `token:${token}:introspection`;
      await redisClient.del(cacheKey);
      await fallbackCache.del(cacheKey);

      // Update database
      await OAuthToken.update(
        { revoked: true },
        { where: { accessToken: token } }
      );
    } catch (error) {
      logger.error('Token revocation failed:', error);
      throw error;
    }
  }
}

module.exports = new TokenIntrospectionService();
