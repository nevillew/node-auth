import { Result, success, failure, ErrorCode } from '../utils/errors';
import logger from '../config/logger';
import * as fallbackCache from './fallbackCache';
import { createRedisClient, releaseRedisClient } from '../config/redis';

// Create a properly typed Redis client
const getRedisClient = async () => {
  return await createRedisClient();
};

// Initialize Redis client
let redisClient: Awaited<ReturnType<typeof createRedisClient>> | null = null;

// Get Redis client with lazy initialization
const getOrCreateRedisClient = async (): Promise<Awaited<ReturnType<typeof createRedisClient>>> => {
  if (!redisClient) {
    redisClient = await createRedisClient();
  }
  return redisClient;
};

// Types for the service
interface TokenIntrospection {
  active: boolean;
  client_id?: string;
  client_name?: string;
  client_type?: string;
  username?: string;
  user_id?: string;
  user_status?: string;
  scope?: string;
  exp?: number;
  iat?: number;
}

// Models (will need proper types later)
// For now, use require for models
const { OAuthToken, User, OAuthClient } = require('../models');

// Cache TTL (1 hour)
const CACHE_TTL = 3600;

/**
 * Get cached token introspection data
 */
const getCachedIntrospection = async (token: string): Promise<Result<TokenIntrospection | null>> => {
  try {
    const cacheKey = `token:${token}:introspection`;
    let cached: string | null = null;
    
    try {
      const redisClient = await getOrCreateRedisClient();
      cached = await redisClient.get(cacheKey);
    } catch (redisError) {
      logger.warn('Redis cache read failed, using fallback:', { error: redisError });
      
      // Try fallback cache
      const fallbackResult = await fallbackCache.get<string>(cacheKey);
      if (fallbackResult.ok && fallbackResult.value) {
        cached = fallbackResult.value;
      }
    }
    
    if (cached) {
      const introspection = JSON.parse(cached) as TokenIntrospection;
      
      // Check if cached introspection is still valid
      if (introspection.exp && introspection.exp * 1000 > Date.now()) {
        return success(introspection);
      }
      
      // Remove expired cache entry
      try {
        await redisClient.del(cacheKey);
      } catch (redisError) {
        logger.warn('Redis delete failed, using fallback:', { error: redisError });
        await fallbackCache.del(cacheKey);
      }
    }
    
    return success(null);
  } catch (err) {
    logger.error('Error getting cached token introspection:', { error: err });
    return failure({
      message: 'Error retrieving cached token introspection',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Cache token introspection data
 */
const cacheIntrospection = async (
  token: string, 
  introspection: TokenIntrospection
): Promise<Result<boolean>> => {
  try {
    const cacheKey = `token:${token}:introspection`;
    
    try {
      const redisClient = await getOrCreateRedisClient();
      await redisClient.set(
        cacheKey,
        JSON.stringify(introspection),
        'EX',
        CACHE_TTL
      );
    } catch (redisError) {
      logger.warn('Redis cache write failed, using fallback:', { error: redisError });
      
      // Use fallback cache
      await fallbackCache.set(
        cacheKey,
        introspection,
        CACHE_TTL
      );
    }
    
    return success(true);
  } catch (err) {
    logger.error('Error caching token introspection:', { error: err });
    return failure({
      message: 'Error caching token introspection',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Introspect a token to get its information
 */
export const introspectToken = async (token: string): Promise<Result<TokenIntrospection>> => {
  try {
    // Check cache first
    const cachedResult = await getCachedIntrospection(token);
    if (cachedResult.ok && cachedResult.value) {
      return success(cachedResult.value);
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
      return success({ active: false });
    }

    const introspection: TokenIntrospection = {
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
    await cacheIntrospection(token, introspection);

    return success(introspection);
  } catch (err) {
    logger.error('Token introspection failed:', { error: err });
    return failure({
      message: 'Token introspection failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Revoke a token
 */
export const revokeToken = async (token: string): Promise<Result<boolean>> => {
  try {
    // Remove from cache
    const cacheKey = `token:${token}:introspection`;
    
    try {
      const redisClient = await getOrCreateRedisClient();
      await redisClient.del(cacheKey);
    } catch (redisError) {
      logger.warn('Redis delete failed, using fallback:', { error: redisError });
    }
    
    await fallbackCache.del(cacheKey);

    // Update database
    await OAuthToken.update(
      { revoked: true },
      { where: { accessToken: token } }
    );
    
    return success(true);
  } catch (err) {
    logger.error('Token revocation failed:', { error: err });
    return failure({
      message: 'Token revocation failed',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};
