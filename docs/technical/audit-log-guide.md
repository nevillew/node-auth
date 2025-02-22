# Audit Log Guide

## Overview
This document details the audit logging system implementation in the multi-tenant platform, including event types, severity levels, and best practices for logging security-relevant events.

## Audit Log Structure

### Event Format
```json
{
  "id": "uuid",
  "userId": "uuid",
  "event": "EVENT_TYPE",
  "details": {
    "field": "value",
    "changes": {
      "before": {},
      "after": {}
    }
  },
  "severity": "low|medium|high|critical",
  "ipAddress": "string",
  "userAgent": "string",
  "createdAt": "ISO date"
}
```

### Severity Levels
1. **Critical**
   - Security breaches
   - Data loss
   - System compromise
   - Unauthorized access

2. **High**
   - Permission changes
   - Role modifications
   - Security setting updates
   - User status changes

3. **Medium**
   - Resource creation
   - Configuration changes
   - Profile updates
   - Access attempts

4. **Low**
   - Read operations
   - Status checks
   - Regular activity
   - Routine events

## Event Categories

### Authentication Events
- `USER_LOGIN`: Successful login
- `LOGIN_FAILED`: Failed login attempt
- `PASSWORD_CHANGED`: Password update
- `PASSWORD_RESET_REQUESTED`: Reset request
- `TWO_FACTOR_ENABLED`: 2FA enabled
- `TWO_FACTOR_DISABLED`: 2FA disabled
- `PASSKEY_REGISTERED`: New passkey added
- `PASSKEY_REMOVED`: Passkey removed

### User Management
- `USER_CREATED`: New user account
- `USER_UPDATED`: Profile changes
- `USER_DELETED`: Account deletion
- `USER_SUSPENDED`: Account suspension
- `ROLE_ASSIGNED`: Role changes
- `PERMISSION_UPDATED`: Permission changes

### Tenant Events
- `TENANT_CREATED`: New tenant
- `TENANT_UPDATED`: Tenant changes
- `TENANT_SUSPENDED`: Tenant suspension
- `TENANT_DELETED`: Tenant removal
- `USER_ADDED_TO_TENANT`: User joined
- `USER_REMOVED_FROM_TENANT`: User removed

### Security Events
- `IP_RESTRICTIONS_UPDATED`: IP rules changed
- `SECURITY_POLICY_UPDATED`: Policy updates
- `SUSPICIOUS_ACTIVITY`: Unusual behavior
- `ACCESS_DENIED`: Permission denied
- `TOKEN_REVOKED`: Token invalidation
- `SESSION_EXPIRED`: Session timeout

## Implementation

### Creating Audit Logs
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'USER_UPDATED',
  details: {
    changes: {
      before: previousState,
      after: newState
    }
  },
  severity: 'medium',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});
```

### Querying Audit Logs
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

## Best Practices

### 1. Event Details
- Include relevant IDs
- Record before/after states
- Add context information
- Include IP and user agent

### 2. Performance
- Use async logging
- Batch write operations
- Index important fields
- Implement log rotation

### 3. Security
- Sanitize sensitive data
- Validate input fields
- Encrypt sensitive logs
- Control log access

### 4. Retention
- Define retention period
- Archive old logs
- Compress stored logs
- Maintain compliance

## Monitoring & Alerts

### Real-time Monitoring
1. **High-severity Events**
   - Immediate notifications
   - Admin dashboard alerts
   - Security team notices
   - Incident tracking

2. **Pattern Detection**
   - Failed login attempts
   - Permission violations
   - Unusual activity
   - Geographic anomalies

### Alert Configuration
```javascript
const alertConfig = {
  critical: {
    channels: ['email', 'slack', 'sms'],
    threshold: 1, // Immediate
    throttle: 0
  },
  high: {
    channels: ['email', 'slack'],
    threshold: 3,
    throttle: 300 // 5 minutes
  },
  medium: {
    channels: ['slack'],
    threshold: 10,
    throttle: 3600 // 1 hour
  }
};
```

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

### Password Change
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'PASSWORD_CHANGED',
  details: {
    method: 'self-service',
    requiresRelogin: true
  },
  severity: 'high'
});
```

### Role Assignment
```javascript
await SecurityAuditLog.create({
  userId: admin.id,
  event: 'ROLE_ASSIGNED',
  details: {
    targetUserId: user.id,
    roles: {
      added: ['admin'],
      removed: ['user']
    }
  },
  severity: 'high'
});
```

### Failed Login
```javascript
await SecurityAuditLog.create({
  userId: null,
  event: 'LOGIN_FAILED',
  details: {
    email: attemptedEmail,
    reason: 'invalid_password',
    attempts: failedAttempts
  },
  severity: 'medium'
});
```

## Related Documentation
- Security Policies
- User Management
- Tenant Management
- Access Control
