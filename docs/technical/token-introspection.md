# Token Introspection Guide

## Overview
This document details the technical implementation of token introspection in the multi-tenant platform, including validation, caching, and security measures.

## Process Flow

### 1. Introspection Request
- **Endpoint**: `POST /auth/introspect`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "token": "access_token_string"
}
```

### 2. Token Validation

#### Phase 1: Cache Check
```javascript
const cached = await getCachedIntrospection(token);
if (cached) {
  // Check if cached introspection is still valid
  if (cached.exp * 1000 > Date.now()) {
    return cached;
  }
  // Remove expired cache entry
  await redisClient.del(`token:${token}:introspection`);
}
```

#### Phase 2: Database Lookup
```javascript
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
```

### 3. Response Format
```json
{
  "active": true,
  "client_id": "client_uuid",
  "client_name": "API Client",
  "client_type": "confidential",
  "username": "user@example.com",
  "user_id": "user_uuid",
  "user_status": "active",
  "scope": "read:users write:data",
  "exp": 1708617600,
  "iat": 1708614000
}
```

## Implementation Details

### Cache Management
```javascript
class TokenIntrospectionService {
  constructor() {
    this.cacheTTL = 3600; // 1 hour cache
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
}
```

### Token Validation
```javascript
async function validateToken(token) {
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

  return {
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
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Token not found
   - Invalid format
   - Cache failure
   - Database error

2. **Security Errors**
   - Permission denied
   - Rate limit exceeded
   - Invalid client
   - Revoked token

### Error Responses
```json
{
  "error": "TOKEN_INTROSPECTION_ERROR",
  "message": "Failed to introspect token",
  "details": {
    "reason": "Token not found or invalid"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Response time
   - Cache hit rate
   - Database latency
   - Error frequency

2. **Security Metrics**
   - Invalid attempts
   - Revoked tokens
   - Client patterns
   - User activity

### Audit Trail
```javascript
{
  event: 'TOKEN_INTROSPECTED',
  severity: 'low',
  details: {
    tokenId: 'uuid',
    clientId: 'string',
    active: boolean,
    cacheHit: boolean
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Rate limiting
   - Audit logging
   - Monitor patterns

2. **Data Protection**
   - Cache security
   - Token validation
   - Client verification
   - User status check

### Performance
1. **Cache Strategy**
   - Short TTL
   - Fallback cache
   - Batch operations
   - Cache invalidation

2. **Resource Management**
   - Connection pooling
   - Query optimization
   - Memory usage
   - Error handling

## API Reference

### Introspect Token
```http
POST /auth/introspect
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "access_token_string"
}
```

### Response
```json
{
  "active": true,
  "client_id": "client_uuid",
  "username": "user@example.com",
  "scope": "read:users write:data",
  "exp": 1708617600
}
```

## Related Documentation
- OAuth 2.0 Configuration
- Token Management Guide
- Security Policies
- Caching Strategy
