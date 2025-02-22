# Audit Logging Guide

## Overview
This document details the technical implementation of audit logging in the multi-tenant platform, including event types, severity levels, and retention policies.

## Event Structure

### Basic Event Format
```javascript
{
  id: 'uuid',
  event: 'EVENT_TYPE',
  severity: 'low|medium|high|critical',
  userId: 'uuid',
  tenantId: 'uuid',
  details: {
    // Event-specific details
  },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  createdAt: '2025-02-22T12:00:00Z'
}
```

### Event Categories

#### Authentication Events
1. **Login Activities**
   - LOGIN_SUCCESS
   - LOGIN_FAILED
   - PASSWORD_CHANGED
   - TWO_FACTOR_ENABLED
   - TWO_FACTOR_DISABLED
   - PASSKEY_REGISTERED
   - PASSKEY_REMOVED

2. **Session Management**
   - SESSION_CREATED
   - SESSION_EXPIRED
   - SESSION_REVOKED
   - TOKEN_ISSUED
   - TOKEN_REVOKED

#### User Management
1. **Account Changes**
   - USER_CREATED
   - USER_UPDATED
   - USER_DELETED
   - PROFILE_UPDATED
   - PREFERENCES_CHANGED

2. **Access Control**
   - ROLE_ASSIGNED
   - PERMISSION_GRANTED
   - PERMISSION_REVOKED
   - ACCESS_DENIED

#### Tenant Operations
1. **Configuration**
   - TENANT_CREATED
   - TENANT_UPDATED
   - TENANT_DELETED
   - FEATURE_ENABLED
   - FEATURE_DISABLED

2. **Security Settings**
   - SECURITY_POLICY_UPDATED
   - IP_RESTRICTION_ADDED
   - IP_RESTRICTION_REMOVED
   - PASSWORD_POLICY_CHANGED

## Implementation

### Event Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'USER_UPDATED',
  severity: 'medium',
  details: {
    changes: {
      before: previousState,
      after: newState
    }
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});
```

### Severity Levels
```javascript
const severityLevels = {
  low: {
    description: 'Informational events',
    retention: '90 days',
    events: ['PROFILE_UPDATED', 'PREFERENCES_CHANGED']
  },
  medium: {
    description: 'Important changes',
    retention: '1 year',
    events: ['USER_CREATED', 'ROLE_ASSIGNED']
  },
  high: {
    description: 'Security-related events',
    retention: '2 years',
    events: ['LOGIN_FAILED', 'PERMISSION_CHANGED']
  },
  critical: {
    description: 'System-level events',
    retention: '7 years',
    events: ['TENANT_DELETED', 'SECURITY_BREACH']
  }
};
```

### Event Details
```javascript
const eventDetails = {
  USER_UPDATED: {
    required: ['changes', 'userId'],
    optional: ['reason', 'metadata'],
    example: {
      changes: {
        before: { status: 'active' },
        after: { status: 'suspended' }
      },
      reason: 'Security violation',
      metadata: { ticketId: '123' }
    }
  }
};
```

## Storage & Retention

### Database Schema
```sql
CREATE TABLE security_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event VARCHAR(255) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_date ON security_audit_logs (tenant_id, created_at);
CREATE INDEX idx_audit_user_date ON security_audit_logs (user_id, created_at);
CREATE INDEX idx_audit_severity ON security_audit_logs (severity);
```

### Retention Policy
1. **Automated Cleanup**
   ```javascript
   async function cleanupAuditLogs() {
     const retentionPeriods = {
       low: '90 days',
       medium: '1 year',
       high: '2 years',
       critical: '7 years'
     };

     for (const [severity, period] of Object.entries(retentionPeriods)) {
       await SecurityAuditLog.destroy({
         where: {
           severity,
           createdAt: {
             [Op.lt]: new Date(Date.now() - ms(period))
           }
         }
       });
     }
   }
   ```

2. **Archival Process**
   ```javascript
   async function archiveAuditLogs() {
     const logs = await SecurityAuditLog.findAll({
       where: {
         createdAt: {
           [Op.lt]: new Date(Date.now() - ms('30 days'))
         },
         archived: false
       }
     });

     // Export to S3
     await s3.putObject({
       Bucket: process.env.AUDIT_ARCHIVE_BUCKET,
       Key: `audit-logs/${new Date().toISOString()}.json`,
       Body: JSON.stringify(logs)
     });
   }
   ```

## Access Control

### Permission Requirements
```javascript
const auditPermissions = {
  'audit:read': 'View audit logs',
  'audit:read:sensitive': 'View sensitive audit details',
  'audit:export': 'Export audit logs',
  'audit:delete': 'Delete audit logs'
};
```

### Access Validation
```javascript
async function validateAuditAccess(user, tenantId) {
  // Check basic read permission
  if (!user.hasPermission('audit:read')) {
    return false;
  }

  // Check tenant access
  const tenantUser = await TenantUser.findOne({
    where: { userId: user.id, tenantId }
  });

  return !!tenantUser;
}
```

## Monitoring & Alerts

### Alert Conditions
1. **Security Alerts**
   - Multiple failed logins
   - Permission changes
   - Security policy updates
   - Suspicious IP access

2. **System Alerts**
   - High event volume
   - Storage thresholds
   - Retention failures
   - Access violations

### Alert Configuration
```javascript
const alertConfig = {
  LOGIN_FAILED: {
    threshold: 5,
    window: '15m',
    action: 'notify-admin'
  },
  PERMISSION_CHANGED: {
    threshold: 1,
    window: '1h',
    action: 'notify-security'
  }
};
```

## Best Practices

### Security
1. **Data Protection**
   - Encrypt sensitive details
   - Mask personal data
   - Secure transmission
   - Access control

2. **Validation**
   - Sanitize input
   - Verify permissions
   - Check integrity
   - Monitor access

### Performance
1. **Optimization**
   - Batch writes
   - Index usage
   - Query efficiency
   - Cache strategy

2. **Resource Management**
   - Connection pooling
   - Storage quotas
   - Cleanup jobs
   - Archive process

## API Reference

### Get Audit Logs
```http
GET /api/audit-logs
Authorization: Bearer <token>
```

### Query Parameters
```typescript
interface AuditLogParams {
  startDate?: string;    // ISO date
  endDate?: string;      // ISO date
  severity?: 'low' | 'medium' | 'high' | 'critical';
  event?: string;
  userId?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
}
```

### Response
```json
{
  "logs": [
    {
      "id": "uuid",
      "event": "USER_UPDATED",
      "severity": "medium",
      "details": {
        "changes": {
          "before": { "status": "active" },
          "after": { "status": "suspended" }
        }
      },
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

## Related Documentation
- Security Policies Guide
- Data Retention Guide
- Access Control Guide
- Monitoring Guide
