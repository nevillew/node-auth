# Two-Factor Authentication Removal Process

## Overview
This document details the technical implementation of Two-Factor Authentication (2FA) removal in the multi-tenant platform, including validation, security measures, and notification processes.

## Process Flow

### 1. Removal Request
- **Endpoint**: `POST /auth/2fa/disable`
- **Authentication**: Required
- **Request Body**:
```json
{
  "currentPassword": "current-password",
  "token": "123456"  // Current 2FA token
}
```

### 2. Pre-Removal Checks
1. **Validation**
   - Verify current password
   - Validate 2FA token
   - Check tenant policies
   - Confirm user permissions

2. **Policy Check**
   ```javascript
   // Check if 2FA is mandatory for tenant
   const tenant = await Tenant.findByPk(user.tenantId);
   if (tenant.securityPolicy?.twoFactor?.required) {
     throw new Error('2FA removal not allowed by tenant policy');
   }
   ```

### 3. Removal Process

#### Phase 1: Verification
```javascript
// Verify current password
const validPassword = await bcrypt.compare(
  currentPassword, 
  user.password
);

// Verify 2FA token
const validToken = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: 'base32',
  token,
  window: 2
});
```

#### Phase 2: Database Updates
```javascript
await user.update({
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
  twoFactorLastVerifiedAt: null
});
```

### 4. Security Measures

#### Session Management
1. **Token Revocation**
   - Revoke remembered devices
   - Clear 2FA sessions
   - Update security context
   - Reset verification status

2. **Access Control**
   - Update permissions
   - Modify access levels
   - Adjust security flags
   - Review device trust

### 5. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: '2FA Disabled on Your Account',
  template: '2fa-disabled',
  context: {
    name: user.name,
    timestamp: new Date(),
    deviceInfo: req.userAgent,
    location: req.geoip
  }
});
```

#### Security Alerts
1. **User Notifications**
   - In-app alert
   - Security reminder
   - Recovery options
   - Support contact

2. **Admin Notifications**
   - Security dashboard
   - Audit logs
   - Activity monitoring
   - Risk assessment

### 6. Audit Trail
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'TWO_FACTOR_DISABLED',
  details: {
    method: 'TOTP',
    deviceInfo: req.userAgent,
    location: req.geoip,
    previousSettings: {
      enabled: true,
      lastVerified: user.twoFactorLastVerifiedAt
    }
  },
  severity: 'high'
});
```

## Implementation Details

### Validation Process
```javascript
async function validateDisableRequest(user, password, token) {
  // Check if 2FA is enabled
  if (!user.twoFactorEnabled) {
    throw new Error('2FA is not enabled');
  }

  // Verify password
  const validPassword = await bcrypt.compare(
    password,
    user.password
  );
  if (!validPassword) {
    throw new Error('Invalid password');
  }

  // Verify 2FA token
  const validToken = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2
  });
  if (!validToken) {
    throw new Error('Invalid 2FA token');
  }
}
```

### Session Cleanup
```javascript
async function cleanupSessions(user) {
  // Revoke remembered devices
  await RememberedDevice.update(
    { revoked: true },
    { where: { userId: user.id } }
  );

  // Clear 2FA verification cache
  await redisClient.del(`2fa:${user.id}:verified`);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid password
   - Invalid 2FA token
   - Policy restrictions
   - Missing permissions

2. **Processing Errors**
   - Database failure
   - Cache error
   - Session cleanup
   - Notification error

### Recovery Procedures
```javascript
try {
  await disable2FA(user, password, token);
} catch (error) {
  logger.error('2FA disable failed:', error);
  await SecurityAuditLog.create({
    userId: user.id,
    event: 'TWO_FACTOR_DISABLE_FAILED',
    details: { error: error.message },
    severity: 'high'
  });
  throw error;
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Disable duration
   - Session cleanup
   - Cache operations
   - API latency

2. **Security Metrics**
   - Disable attempts
   - Failed validations
   - Policy overrides
   - Risk scores

### Audit Trail
```javascript
{
  event: 'TWO_FACTOR_DISABLED',
  severity: 'high',
  details: {
    userId: 'uuid',
    deviceInfo: {
      userAgent: 'string',
      ip: 'string',
      location: 'string'
    },
    timestamp: 'ISO date'
  }
}
```

## Best Practices

### Security
1. **Validation**
   - Verify current password
   - Require 2FA token
   - Check policies
   - Log attempts

2. **Session Management**
   - Clear all sessions
   - Update security context
   - Revoke remembered devices
   - Monitor activity

### User Experience
1. **Clear Communication**
   - Explain implications
   - Confirm actions
   - Provide recovery options
   - Offer support contact

2. **Recovery Options**
   - Document process
   - Save recovery codes
   - Backup methods
   - Account security

## API Reference

### Disable 2FA
```http
POST /auth/2fa/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "password",
  "token": "123456"
}
```

### Response
```json
{
  "message": "2FA disabled successfully",
  "disabledAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Two-Factor Setup Guide
- Security Policies
- Account Recovery Guide
- Audit Logging Guide
