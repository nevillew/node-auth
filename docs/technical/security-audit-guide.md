# Security Audit Guide

## Overview
This document details the security audit implementation in the multi-tenant platform, including event logging, monitoring, and compliance requirements.

## Audit Events

### Authentication Events
```json
{
  "authentication": {
    "login": {
      "success": "USER_LOGIN",
      "failed": "LOGIN_FAILED",
      "reason": "Invalid credentials|Account locked|2FA required"
    },
    "logout": "USER_LOGOUT",
    "passwordChange": "PASSWORD_CHANGED",
    "passwordReset": "PASSWORD_RESET_REQUESTED",
    "twoFactor": {
      "enabled": "TWO_FACTOR_ENABLED",
      "disabled": "TWO_FACTOR_DISABLED",
      "verified": "TWO_FACTOR_VERIFIED",
      "failed": "TWO_FACTOR_FAILED"
    }
  }
}
```

### User Events
```json
{
  "user": {
    "created": "USER_CREATED",
    "updated": "USER_UPDATED",
    "deleted": "USER_DELETED",
    "suspended": "USER_SUSPENDED",
    "roleChanged": "USER_ROLE_CHANGED",
    "permissionUpdated": "USER_PERMISSIONS_UPDATED"
  }
}
```

### Tenant Events
```json
{
  "tenant": {
    "created": "TENANT_CREATED",
    "updated": "TENANT_UPDATED",
    "deleted": "TENANT_DELETED",
    "suspended": "TENANT_SUSPENDED",
    "userAdded": "USER_ADDED_TO_TENANT",
    "userRemoved": "USER_REMOVED_FROM_TENANT",
    "configChanged": "TENANT_CONFIG_UPDATED"
  }
}
```

## Severity Levels

### Critical Events
- Security breaches
- Unauthorized access attempts
- System compromise
- Data loss incidents
- Multiple failed login attempts

### High Severity
- Permission changes
- Role modifications
- Security policy updates
- User status changes
- Password resets

### Medium Severity
- Configuration changes
- Resource creation/deletion
- Profile updates
- Login attempts
- Token generation

### Low Severity
- Read operations
- Status checks
- Preference updates
- Notification settings

## Implementation

### Audit Log Creation
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'USER_LOGIN',
  details: {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    location: geoLocation,
    method: 'password|2fa|passkey'
  },
  severity: 'medium'
});
```

### Log Retrieval
```javascript
const logs = await SecurityAuditLog.findAll({
  where: {
    createdAt: {
      [Op.gte]: startDate,
      [Op.lte]: endDate
    },
    severity: severity,
    event: event
  },
  include: [{
    model: User,
    attributes: ['email', 'name']
  }],
  order: [['createdAt', 'DESC']]
});
```

## Monitoring & Alerts

### Real-time Monitoring
1. **Critical Events**
   - Immediate notification
   - Security team alert
   - Admin dashboard update
   - Incident tracking

2. **Pattern Detection**
   - Failed login attempts
   - Permission violations
   - Suspicious activity
   - Geographic anomalies

### Alert Configuration
```javascript
const alertConfig = {
  critical: {
    channels: ['email', 'slack', 'sms'],
    threshold: 1,
    throttle: 0
  },
  high: {
    channels: ['email', 'slack'],
    threshold: 3,
    throttle: 300
  },
  medium: {
    channels: ['slack'],
    threshold: 10,
    throttle: 3600
  }
};
```

## Retention & Compliance

### Retention Periods
1. **Security Events**
   - Critical events: 7 years
   - High severity: 3 years
   - Medium severity: 1 year
   - Low severity: 90 days

2. **User Activity**
   - Login history: 90 days
   - Access logs: 30 days
   - Session data: 7 days
   - Failed attempts: 30 days

### Compliance Requirements
1. **Data Privacy**
   - GDPR compliance
   - Data minimization
   - Purpose limitation
   - Storage limitation

2. **Security Standards**
   - Access controls
   - Encryption
   - Audit trails
   - Incident response

## Best Practices

### Logging
1. **Event Details**
   - Include relevant IDs
   - Record timestamps
   - Log IP addresses
   - Track user agents

2. **Data Protection**
   - Sanitize sensitive data
   - Encrypt logs
   - Secure transmission
   - Access control

### Performance
1. **Optimization**
   - Async logging
   - Batch processing
   - Index management
   - Cache utilization

2. **Resource Management**
   - Log rotation
   - Storage monitoring
   - Archive strategy
   - Cleanup jobs

## API Reference

### Get Audit Logs
```http
GET /api/audit-logs
Authorization: Bearer <token>
Query Parameters:
  - startDate: ISO date
  - endDate: ISO date
  - severity: string
  - event: string
  - page: number
  - limit: number
```

### Get User Audit History
```http
GET /api/users/:id/audit-history
Authorization: Bearer <token>
Query Parameters:
  - startDate: ISO date
  - endDate: ISO date
  - severity: string
  - event: string
```

### Get Tenant Audit History
```http
GET /api/tenants/:id/audit-history
Authorization: Bearer <token>
Query Parameters:
  - startDate: ISO date
  - endDate: ISO date
  - severity: string
  - event: string
```

## Example Scenarios

### Failed Login Attempt
```javascript
await SecurityAuditLog.create({
  userId: null,
  event: 'LOGIN_FAILED',
  details: {
    email: attemptedEmail,
    reason: 'invalid_password',
    attempts: failedAttempts,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  },
  severity: 'medium'
});
```

### Permission Change
```javascript
await SecurityAuditLog.create({
  userId: adminId,
  event: 'USER_PERMISSIONS_UPDATED',
  details: {
    targetUserId: userId,
    changes: {
      added: ['permission1'],
      removed: ['permission2']
    }
  },
  severity: 'high'
});
```

### Security Policy Update
```javascript
await SecurityAuditLog.create({
  userId: adminId,
  event: 'TENANT_CONFIG_UPDATED',
  details: {
    tenantId: tenant.id,
    changes: {
      before: previousPolicy,
      after: newPolicy
    },
    component: 'securityPolicy'
  },
  severity: 'high'
});
```

## Related Documentation
- Security Policies
- Access Control Guide
- Compliance Guide
- Incident Response
