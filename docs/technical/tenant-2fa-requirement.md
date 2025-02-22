# Tenant-Wide 2FA Requirement Process

## Overview
This document details the technical implementation of enforcing Two-Factor Authentication (2FA) across all users within a tenant, including grace periods, enforcement, and notification processes.

## Process Flow

### 1. Enable Requirement
- **Endpoint**: `POST /api/tenants/:id/security/2fa/require`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "gracePeriodDays": 7,
  "graceLogins": 3,
  "allowRememberDevice": false,
  "allowBackupCodes": true
}
```

### 2. Configuration Process

#### Phase 1: Policy Update
```javascript
await tenant.update({
  securityPolicy: {
    ...tenant.securityPolicy,
    twoFactor: {
      required: true,
      gracePeriodDays: 7,
      graceLogins: 3,
      allowBackupCodes: true,
      allowRememberDevice: false
    }
  }
});
```

#### Phase 2: User Assessment
1. **Audit Current State**
   - Count users without 2FA
   - Calculate grace periods
   - Track login attempts
   - Monitor compliance

2. **Exemption Management**
   - Handle special cases
   - Document exceptions
   - Set custom deadlines
   - Track overrides

### 3. Enforcement Process

#### Phase 1: Grace Period
- Start date recorded per user
- Configurable duration
- Login attempt tracking
- Proactive notifications

#### Phase 2: Strict Enforcement
- Block non-compliant logins
- Require immediate setup
- Track failed attempts
- Log enforcement actions

### 4. Notification System

#### User Communications
1. **Initial Notice**
   - Policy change announcement
   - Setup instructions
   - Deadline information
   - Support contacts

2. **Reminder Sequence**
   ```javascript
   const reminderSchedule = [
     { days: 7, type: 'initial' },
     { days: 3, type: 'warning' },
     { days: 1, type: 'urgent' }
   ];
   ```

#### Admin Notifications
1. **Progress Updates**
   - Compliance statistics
   - Setup tracking
   - Failed attempts
   - Exception reports

2. **Security Alerts**
   - Policy violations
   - Multiple failures
   - System bypasses
   - Suspicious activity

### 5. Monitoring & Enforcement

#### Compliance Tracking
```javascript
const complianceStats = {
  totalUsers: 100,
  compliantUsers: 75,
  inGracePeriod: 20,
  nonCompliant: 5,
  exemptions: 0
};
```

#### Access Control
1. **Session Management**
   - Validate 2FA status
   - Track grace logins
   - Enforce deadlines
   - Handle exceptions

2. **API Access**
   - Check compliance
   - Enforce restrictions
   - Log violations
   - Rate limiting

## Implementation Details

### Policy Configuration
```javascript
const defaultPolicy = {
  twoFactor: {
    required: true,
    gracePeriodDays: 7,
    graceLogins: 3,
    allowBackupCodes: true,
    allowRememberDevice: false,
    exemptRoles: [],
    enforcementDate: new Date()
  }
};
```

### Grace Period Management
```javascript
function calculateGracePeriod(user, policy) {
  const deadline = new Date(user.createdAt.getTime() + 
    (policy.gracePeriodDays * 24 * 60 * 60 * 1000));
  
  return {
    deadline,
    remainingLogins: policy.graceLogins - (user.loginCount || 0),
    expired: new Date() > deadline
  };
}
```

### Enforcement Logic
```javascript
async function enforce2FAPolicy(user, tenant) {
  const { twoFactor } = tenant.securityPolicy;
  
  if (!user.twoFactorEnabled) {
    const grace = calculateGracePeriod(user, twoFactor);
    
    if (grace.expired && grace.remainingLogins <= 0) {
      throw new Error('2FA required - grace period expired');
    }
    
    // Track login attempt
    await user.increment('loginCount');
    
    // Notify if approaching limit
    if (grace.remainingLogins <= 3) {
      await notifyUser2FARequired(user, grace);
    }
  }
}
```

## Error Handling

### Common Errors
1. **Configuration Errors**
   - Invalid grace period
   - Policy conflicts
   - Role exceptions
   - Setup failures

2. **Enforcement Errors**
   - Access denied
   - Grace expired
   - Setup failed
   - System errors

### Error Responses
```javascript
{
  error: 'TWO_FACTOR_REQUIRED',
  message: 'Two-factor authentication required',
  details: {
    gracePeriodEnds: '2025-03-01T00:00:00Z',
    remainingLogins: 2
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Compliance Metrics**
   - Setup rate
   - Grace usage
   - Failed attempts
   - Exception rate

2. **Performance Metrics**
   - Setup time
   - Verification speed
   - API latency
   - Error rates

### Audit Trail
```javascript
{
  event: 'TWO_FACTOR_POLICY_ENABLED',
  severity: 'high',
  details: {
    tenantId: 'uuid',
    enabledBy: 'admin-uuid',
    policy: {
      gracePeriodDays: 7,
      graceLogins: 3
    },
    affectedUsers: 100
  }
}
```

## Best Practices

### Security
1. **Policy Management**
   - Clear documentation
   - Regular reviews
   - Exception tracking
   - Audit logging

2. **User Experience**
   - Clear communication
   - Setup assistance
   - Grace periods
   - Support access

### Implementation
1. **Enforcement**
   - Gradual rollout
   - Monitor impact
   - Handle edge cases
   - Review exceptions

2. **Monitoring**
   - Track compliance
   - Alert on issues
   - Review metrics
   - Update policies

## API Reference

### Enable 2FA Requirement
```http
POST /api/tenants/:id/security/2fa/require
Authorization: Bearer <token>
Content-Type: application/json

{
  "gracePeriodDays": 7,
  "graceLogins": 3,
  "allowRememberDevice": false
}
```

### Response
```json
{
  "enabled": true,
  "policy": {
    "gracePeriodDays": 7,
    "graceLogins": 3,
    "allowRememberDevice": false
  },
  "affectedUsers": 100,
  "enforcementDate": "2025-03-01T00:00:00Z"
}
```

## Related Documentation
- Two-Factor Setup Guide
- Security Policies
- User Management Guide
- Compliance Guide
