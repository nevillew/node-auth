# Passkey Revocation Process

## Overview
This document details the technical implementation of passkey revocation in the multi-tenant platform, including validation, security measures, and notification processes.

## Process Flow

### 1. Revocation Request
- **Endpoint**: `DELETE /auth/passkey/authenticators/:id`
- **Authentication**: Required
- **Rate Limiting**: 5 attempts per hour
- **Request Body**:
```json
{
  "reason": "Optional revocation reason"
}
```

### 2. Pre-Revocation Checks
1. **Validation**
   ```javascript
   const authenticator = await Authenticator.findOne({
     where: {
       id: authenticatorId,
       userId: req.user.id
     }
   });

   if (!authenticator) {
     throw new Error('Authenticator not found');
   }
   ```

2. **Security Checks**
   - Verify user owns authenticator
   - Check minimum authenticator count
   - Validate user session
   - Verify 2FA if required

### 3. Revocation Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Delete authenticator record
  await authenticator.destroy({ transaction: t });

  // Update user record
  if (userAuthenticators.length === 1) {
    await user.update({ 
      passKeyEnabled: false 
    }, { transaction: t });
  }

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Session Management
1. **Token Revocation**
   - Revoke active sessions
   - Clear session cache
   - Update token store
   - Log session changes

2. **Security Updates**
   - Update user status
   - Clear cached data
   - Update security flags
   - Track changes

### 4. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: 'Passkey Removed',
  template: 'passkey-removed',
  context: {
    name: user.name,
    authenticatorName: authenticator.friendlyName,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  }
});
```

#### Security Logging
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'PASSKEY_REVOKED',
  details: {
    authenticatorId: authenticator.id,
    friendlyName: authenticator.friendlyName,
    lastUsedAt: authenticator.lastUsedAt,
    reason,
    ipAddress: req.ip
  },
  severity: 'high'
});
```

### 5. Post-Revocation Tasks

#### Cache Management
1. **Clear User Cache**
   ```javascript
   await redisClient.del(`user:${userId}:authenticators`);
   await redisClient.del(`user:${userId}:security`);
   ```

2. **Update Security State**
   - Clear challenge cache
   - Update security flags
   - Reset counters
   - Clear temporary data

## Implementation Details

### Database Operations
```javascript
// Find authenticator with user check
const authenticator = await Authenticator.findOne({
  where: {
    id: authenticatorId,
    userId: req.user.id
  },
  transaction: t
});

// Get remaining authenticator count
const remainingCount = await Authenticator.count({
  where: { 
    userId: req.user.id,
    id: { [Op.ne]: authenticatorId }
  },
  transaction: t
});
```

### Security Measures
1. **Rate Limiting**
   ```javascript
   const revokeRateLimiter = rateLimit({
     windowMs: 60 * 60 * 1000, // 1 hour
     max: 5, // 5 attempts per hour
     message: 'Too many revocation attempts'
   });
   ```

2. **Session Handling**
   - Revoke affected sessions
   - Clear session cache
   - Update security state
   - Track changes

## Error Handling

### Common Errors
1. **Validation Errors**
   - Authenticator not found
   - Permission denied
   - Invalid session
   - Rate limit exceeded

2. **Processing Errors**
   - Database failure
   - Cache error
   - Session error
   - Notification failure

### Error Responses
```json
{
  "error": "Revocation failed",
  "code": "PASSKEY_REVOCATION_ERROR",
  "details": "Cannot remove last authenticator"
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Response time
   - Cache operations
   - Database latency
   - Email delivery

2. **Security Metrics**
   - Revocation rate
   - Error rate
   - Session updates
   - Cache invalidations

### Audit Trail
```javascript
{
  event: 'PASSKEY_REVOKED',
  severity: 'high',
  details: {
    authenticatorId: 'uuid',
    userId: 'uuid',
    reason: 'string',
    ipAddress: 'string',
    remainingAuthenticators: number
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify ownership
   - Check permissions
   - Validate session
   - Rate limit requests

2. **Data Protection**
   - Secure deletion
   - Audit logging
   - Session management
   - Cache invalidation

### Performance
1. **Resource Management**
   - Transaction handling
   - Cache management
   - Connection pooling
   - Email queuing

2. **Optimization**
   - Batch operations
   - Cache strategy
   - Query efficiency
   - Log rotation

## API Reference

### Revoke Passkey
```http
DELETE /auth/passkey/authenticators/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Lost device"
}
```

### Response
```json
{
  "message": "Passkey revoked successfully",
  "remainingAuthenticators": 2
}
```

## Related Documentation
- Passkey Registration Guide
- Security Policies
- Authentication Guide
- Audit Logging Guide
