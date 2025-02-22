# Token Revocation Guide

## Overview
This document details the technical implementation of token revocation in the multi-tenant platform, including OAuth tokens, refresh tokens, and session management.

## Process Flow

### 1. Revocation Request
- **Endpoint**: `POST /auth/token/revoke`
- **Authentication**: Required
- **Request Body**:
```json
{
  "token": "token-to-revoke",
  "type": "access_token",
  "allSessions": false
}
```

### 2. Token Validation

#### Access Token Validation
```javascript
const tokenRecord = await OAuthToken.findOne({
  where: { 
    accessToken: token,
    revoked: false
  },
  include: [{
    model: User,
    attributes: ['id', 'email']
  }]
});
```

#### Permission Check
```javascript
// Check if user has permission to revoke token
const canRevoke = 
  req.user.id === tokenRecord.userId || // Own token
  req.user.hasScope('tokens:revoke');   // Admin scope
```

### 3. Revocation Process

#### Single Token Revocation
```javascript
await OAuthToken.update(
  { revoked: true },
  { 
    where: { 
      accessToken: token,
      revoked: false
    }
  }
);
```

#### All Sessions Revocation
```javascript
await OAuthToken.update(
  { revoked: true },
  { 
    where: { 
      userId,
      revoked: false
    }
  }
);
```

### 4. Cache Management

#### Token Cache Cleanup
```javascript
// Clear token from cache
await redisClient.del(`token:${token}`);

// Clear user sessions
await redisClient.del(`user:${userId}:sessions`);
```

#### Session Store Cleanup
```javascript
// Remove from session store
await sessionStore.destroy(sessionId);

// Clear remember-me tokens
await RememberToken.destroy({
  where: { userId }
});
```

### 5. Security Measures

#### Rate Limiting
```javascript
const revocationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 revocations per window
  message: 'Too many revocation attempts'
});
```

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'TOKEN_REVOKED',
  details: {
    tokenId: tokenRecord.id,
    allSessions,
    revokedUserId: tokenRecord.userId
  },
  severity: 'medium'
});
```

## Implementation Details

### Token Storage
```javascript
// Token record structure
interface TokenRecord {
  id: string;
  accessToken: string;
  refreshToken?: string;
  userId: string;
  clientId: string;
  scope: string[];
  type: 'access' | 'refresh';
  revoked: boolean;
  expiresAt: Date;
}
```

### Revocation Types
1. **Single Token**
   - Revoke specific access token
   - Optionally revoke refresh token
   - Update token record
   - Clear from cache

2. **User Sessions**
   - Revoke all user tokens
   - Clear all sessions
   - Update login status
   - Notify user

### Cache Management
```javascript
async function invalidateTokenCache(token, userId) {
  const keys = await redisClient.keys(`user:${userId}:token:*`);
  await Promise.all([
    redisClient.del(`token:${token}`),
    ...keys.map(key => redisClient.del(key))
  ]);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid token
   - Token not found
   - Already revoked
   - Permission denied

2. **Processing Errors**
   - Database error
   - Cache error
   - Session error
   - Rate limit exceeded

### Error Responses
```javascript
{
  error: 'TOKEN_REVOCATION_ERROR',
  message: 'Failed to revoke token',
  details: {
    reason: 'Token not found or already revoked',
    token: 'partial-token-id'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Revocation time
   - Cache operations
   - Database updates
   - API latency

2. **Security Metrics**
   - Revocation rate
   - Failed attempts
   - Permission checks
   - Session cleanup

### Audit Trail
```javascript
{
  event: 'TOKEN_REVOKED',
  severity: 'medium',
  details: {
    tokenId: 'uuid',
    userId: 'uuid',
    reason: 'user_request',
    allSessions: false
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Immediate revocation
   - Proper validation
   - Permission checks
   - Audit logging

2. **Session Handling**
   - Clear all caches
   - Update databases
   - Notify services
   - Monitor activity

### Performance
1. **Resource Management**
   - Batch operations
   - Cache efficiency
   - Connection pooling
   - Rate limiting

2. **Optimization**
   - Quick validation
   - Efficient cleanup
   - Parallel processing
   - Background tasks

## API Reference

### Revoke Token
```http
POST /auth/token/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "token-to-revoke",
  "type": "access_token",
  "allSessions": false
}
```

### Response
```json
{
  "message": "Token revoked successfully",
  "revokedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- OAuth Configuration Guide
- Session Management Guide
- Security Policies
- Audit Logging Guide
