# Tenant Update Process

## Overview
This document details the technical implementation of tenant updates in the multi-tenant platform.

## Process Flow

### 1. Request Validation
- Endpoint: `PUT /api/tenants/:id`
- Authentication: Required with admin scope
- Request body:
```json
{
  "name": "Updated Name",
  "features": {
    "auth": ["password", "2fa", "passkey"],
    "storage": ["s3"]
  },
  "securityPolicy": {
    "passwordPolicy": {
      "minLength": 12,
      "requireSpecialChars": true
    },
    "sessionTimeout": 3600
  },
  "status": "active"
}
```

### 2. Update Process
1. **Validate Request**
   - Check required permissions
   - Validate input data
   - Verify tenant exists
   - Check update constraints

2. **Handle Logo Updates**
   ```javascript
   if (req.file) {
     const { key, signedUrl } = await uploadToS3(req.file, 'tenant-logos');
     updates.logo = key;
     updates.logoUrl = signedUrl;
   }
   ```

3. **Apply Updates**
   ```javascript
   const updates = {};
   if (name) updates.name = name;
   if (features) updates.features = { ...tenant.features, ...features };
   if (securityPolicy) {
     updates.securityPolicy = { 
       ...tenant.securityPolicy, 
       ...securityPolicy 
     };
   }
   ```

### 3. Security Policy Updates
1. **Password Policy**
   - Minimum length requirements
   - Character requirements
   - History restrictions
   - Expiry settings

2. **Session Management**
   ```javascript
   const sessionPolicy = {
     maxConcurrentSessions: 3,
     sessionTimeout: 3600,
     extendOnActivity: true,
     requireMFA: false
   };
   ```

3. **IP Restrictions**
   ```javascript
   const ipRestrictions = {
     enabled: true,
     allowedIPs: ["192.168.1.0/24"],
     allowedRanges: ["10.0.0.0/8"],
     blockList: ["1.2.3.4"]
   };
   ```

### 4. Feature Management
1. **Feature Flags**
   ```javascript
   const features = {
     auth: {
       password: true,
       passkey: true,
       oauth: ["google", "github"]
     },
     storage: {
       s3: true,
       local: false
     }
   };
   ```

2. **Integration Settings**
   - API configurations
   - Webhook endpoints
   - Third-party services

### 5. Database Updates
1. **Transaction Management**
   ```javascript
   const t = await sequelize.transaction();
   try {
     await tenant.update(updates, { transaction: t });
     await t.commit();
   } catch (error) {
     await t.rollback();
     throw error;
   }
   ```

2. **Audit Logging**
   ```javascript
   await SecurityAuditLog.create({
     userId: req.user.id,
     event: 'TENANT_UPDATED',
     details: {
       tenantId: tenant.id,
       updates,
       previousState: tenant.previous()
     },
     severity: 'medium'
   });
   ```

## Validation Rules

### Name Validation
- Required field
- Length: 2-100 characters
- Unique across platform
- No special characters

### Security Policy Validation
1. **Password Rules**
   ```javascript
   const passwordValidation = {
     minLength: {
       min: 8,
       max: 128
     },
     requireUppercase: true,
     requireNumbers: true,
     requireSpecialChars: true
   };
   ```

2. **Session Rules**
   - Timeout: 1-24 hours
   - Max sessions: 1-10
   - Remember device: 0-30 days

### Feature Validation
- Valid feature names
- Compatible combinations
- License restrictions
- Resource limits

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid input format
   - Missing required fields
   - Incompatible settings

2. **Security Errors**
   - Insufficient permissions
   - Invalid security policy
   - Restricted operations

### Recovery Procedures
1. **Transaction Rollback**
   - Revert database changes
   - Clean up resources
   - Log failure details

2. **Notification System**
   - Alert administrators
   - Notify affected users
   - Log system events

## Monitoring & Logging

### Audit Trail
```javascript
await SecurityAuditLog.create({
  event: 'TENANT_UPDATED',
  severity: 'medium',
  details: {
    tenantId,
    updatedBy: userId,
    changes: {
      before: previousState,
      after: newState
    }
  }
});
```

### Performance Metrics
- Update duration
- Resource usage
- Cache invalidation
- Database operations

## Post-Update Tasks

### 1. Cache Management
- Clear tenant cache
- Update Redis entries
- Refresh CDN cache
- Update search indices

### 2. Notification System
- Notify tenant admins
- Update status monitors
- Send audit reports
- Log changes

### 3. Integration Updates
- Update API tokens
- Refresh webhooks
- Sync external services
- Update DNS records

## Best Practices

### Security
1. Validate all inputs
2. Use transactions
3. Log all changes
4. Verify permissions

### Performance
1. Batch updates
2. Use caching
3. Optimize queries
4. Monitor resources

### Reliability
1. Use transactions
2. Implement retries
3. Handle failures
4. Maintain backups

## API Reference

### Update Tenant
```http
PUT /api/tenants/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "features": {
    "auth": ["password", "2fa"]
  },
  "securityPolicy": {
    "passwordPolicy": {
      "minLength": 12
    }
  }
}
```

### Response
```json
{
  "id": "uuid",
  "name": "Updated Name",
  "status": "active",
  "features": {
    "auth": ["password", "2fa"]
  },
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Tenant Creation Guide
- Security Policy Reference
- Feature Flag Documentation
- Audit Log Guide
