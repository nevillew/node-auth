# Machine-to-Machine Token Revocation Process

## Overview
This document details the technical implementation of revoking machine-to-machine (M2M) tokens in the multi-tenant platform, including validation, security measures, and audit processes.

## Process Flow

### 1. Revocation Request
- **Endpoint**: `POST /auth/m2m/token/revoke`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "token": "token_string",
  "clientId": "client_id"
}
```

### 2. Validation Process
1. **Token Validation**
   ```javascript
   const tokenRecord = await OAuthToken.findOne({
     where: { 
       accessToken: token,
       type: 'm2m'
     },
     include: [{
       model: OAuthClient,
       where: { clientId }
     }]
   });
   ```

2. **Security Checks**
   - Verify token exists
   - Validate client ID
   - Check admin rights
   - Verify tenant access

### 3. Revocation Process

#### Phase 1: Database Update
```javascript
const t = await sequelize.transaction();
try {
  // Mark token as revoked
  await tokenRecord.update({ 
    revoked: true,
    revokedAt: new Date(),
    revokedBy: adminUserId
  }, { transaction: t });

  // Create audit log
  await SecurityAuditLog.create({
    userId: adminUserId,
    event: 'M2M_TOKEN_REVOKED',
    details: {
      clientId,
      tokenId: tokenRecord.id,
      scopes: tokenRecord.scopes,
      tenantId: tokenRecord.tenantId
    },
    severity: 'medium'
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Cache Management
```javascript
// Clear token from cache
await redisClient.del(`token:${token}:introspection`);
await redisClient.del(`client:${clientId}:tokens`);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: adminUserId,
  event: 'M2M_TOKEN_REVOKED',
  details: {
    clientId,
    tokenId: tokenRecord.id,
    reason,
    ipAddress: req.ip
  },
  severity: 'medium'
});
```

#### Access Control
1. **Token Invalidation**
   - Immediate revocation
   - Clear from cache
   - Update token store
   - Block new requests

2. **Client Management**
   - Update token count
   - Monitor patterns
   - Track usage
   - Alert on issues

### 5. Notification System

#### Admin Notifications
```javascript
await notificationService.sendSystemNotification(
  adminUserId,
  `M2M token revoked for client ${clientId}`
);
```

#### Metrics Update
1. **Token Metrics**
   - Active tokens
   - Revocation rate
   - Usage patterns
   - Error rates

2. **Client Metrics**
   - Token count
   - Revocation history
   - Usage trends
   - Security events

## Implementation Details

### Token Validation
```javascript
async function validateToken(token, clientId) {
  const tokenRecord = await OAuthToken.findOne({
    where: { 
      accessToken: token,
      type: 'm2m',
      revoked: false
    },
    include: [{
      model: OAuthClient,
      where: { clientId }
    }]
  });

  if (!tokenRecord) {
    throw new Error('Token not found or already revoked');
  }

  return tokenRecord;
}
```

### Cache Management
```javascript
async function clearTokenCache(token, clientId) {
  const keys = [
    `token:${token}:introspection`,
    `client:${clientId}:tokens`,
    `tenant:${tenantId}:m2m-tokens`
  ];
  await redisClient.del(keys);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Token not found
   - Invalid client
   - Already revoked
   - Permission denied

2. **Processing Errors**
   - Database failure
   - Cache error
   - Audit log error
   - Notification failure

### Error Responses
```json
{
  "error": "TOKEN_REVOCATION_ERROR",
  "message": "Failed to revoke token",
  "details": {
    "reason": "Token not found or invalid client"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Revocation time
   - Cache operations
   - Database latency
   - API response time

2. **Security Metrics**
   - Revocation rate
   - Client patterns
   - Error frequency
   - Access attempts

### Audit Trail
```javascript
{
  event: 'M2M_TOKEN_REVOKED',
  severity: 'medium',
  details: {
    clientId: 'string',
    tokenId: 'uuid',
    revokedBy: 'admin-uuid',
    reason: 'string'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Validate tokens
   - Check client access
   - Monitor patterns

2. **Data Protection**
   - Secure deletion
   - Audit logging
   - Rate limiting
   - Cache management

### Performance
1. **Resource Management**
   - Cache invalidation
   - Connection pooling
   - Transaction handling
   - Batch operations

2. **Optimization**
   - Quick validation
   - Efficient logging
   - Cache strategy
   - Error handling

## API Reference

### Revoke Token
```http
POST /auth/m2m/token/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "token_string",
  "clientId": "client_id"
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
- M2M Token Creation Guide
- OAuth Client Management
- Audit Log Guide
- Security Policies
