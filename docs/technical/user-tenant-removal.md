# User Removal from Tenant Process

## Overview
This document details the technical implementation of removing a user from a tenant in the multi-tenant platform, including validation, cleanup, and notification processes.

## Process Flow

### 1. Removal Request
- **Endpoint**: `DELETE /api/tenants/:tenantId/users/:userId`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "confirm": true
}
```

### 2. Pre-Removal Checks
1. **Validation**
   - Verify tenant exists
   - Verify user exists
   - Check admin permissions
   - Validate user membership

2. **Admin Check**
   ```javascript
   const adminCount = await TenantUser.count({
     where: {
       tenantId,
       roles: { [Op.contains]: ['admin'] }
     }
   });

   if (userRoles.includes('admin') && adminCount === 1) {
     throw new Error('Cannot remove last admin');
   }
   ```

### 3. Removal Process

#### Phase 1: Database Updates
```javascript
const t = await sequelize.transaction();
try {
  // Remove tenant user relationship
  await TenantUser.destroy({
    where: { tenantId, userId },
    transaction: t
  });

  // Create audit log
  await SecurityAuditLog.create({
    userId: adminUserId,
    event: 'USER_REMOVED_FROM_TENANT',
    details: {
      removedUserId: userId,
      tenantId,
      roles: userRoles
    },
    severity: 'medium'
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Resource Cleanup
1. **Access Management**
   - Revoke active sessions
   - Clear role assignments
   - Remove permissions
   - Update access records

2. **Data Cleanup**
   - Archive user files
   - Update references
   - Clean cache entries
   - Remove preferences

### 4. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: `Removed from ${tenant.name}`,
  template: 'user-removed',
  context: {
    name: user.name,
    tenantName: tenant.name,
    removedBy: admin.name,
    date: new Date().toLocaleDateString()
  }
});
```

#### System Notifications
1. **Admin Alerts**
   - Dashboard update
   - Activity log
   - Audit trail
   - Status change

2. **User Notifications**
   - Access revocation
   - Data export options
   - Support contact
   - Next steps

### 5. Post-Removal Tasks

#### Cache Management
```javascript
// Clear user-tenant specific cache
await redisClient.del(`user:${userId}:tenant:${tenantId}`);
await redisClient.del(`tenant:${tenantId}:users`);
```

#### Session Cleanup
1. **Token Revocation**
   ```javascript
   await OAuthToken.update(
     { revoked: true },
     { 
       where: { 
         userId,
         tenantId 
       }
     }
   );
   ```

2. **Session Store**
   - Clear session data
   - Update active sessions
   - Remove tenant context
   - Clean temporary data

## Implementation Details

### Database Operations
```javascript
// Remove user from tenant
await TenantUser.destroy({
  where: { 
    tenantId,
    userId 
  }
});

// Clear role assignments
await UserRole.destroy({
  where: { 
    userId,
    tenantId 
  }
});
```

### Access Cleanup
```javascript
// Revoke tenant-specific tokens
await OAuthToken.update(
  { revoked: true },
  { 
    where: { 
      userId,
      tenantId,
      revoked: false
    }
  }
);
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - User not found
   - Invalid tenant
   - Permission denied
   - Last admin check

2. **Resource Errors**
   - Database failure
   - Cache error
   - Token revocation
   - Notification error

### Recovery Procedures
1. **Transaction Rollback**
   ```javascript
   try {
     await t.commit();
   } catch (error) {
     await t.rollback();
     logger.error('User removal failed:', error);
   }
   ```

2. **Cleanup Verification**
   - Verify relationship removed
   - Check token revocation
   - Validate cache clear
   - Confirm notifications

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Removal duration
   - Resource cleanup
   - Cache operations
   - API latency

2. **Business Metrics**
   - Removed users
   - Role distribution
   - Access patterns
   - Error rates

### Audit Trail
```javascript
{
  event: 'USER_REMOVED_FROM_TENANT',
  severity: 'medium',
  details: {
    userId: 'uuid',
    tenantId: 'uuid',
    removedBy: 'admin-uuid',
    roles: ['role-names'],
    timestamp: 'ISO date'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Check constraints
   - Log all actions
   - Audit changes

2. **Data Protection**
   - Secure deletion
   - Token revocation
   - Session cleanup
   - Access verification

### Performance
1. **Resource Management**
   - Batch operations
   - Cache invalidation
   - Connection pooling
   - Transaction handling

2. **Optimization**
   - Query efficiency
   - Cache strategy
   - Parallel processing
   - Resource cleanup

## API Reference

### Remove User
```http
DELETE /api/tenants/:tenantId/users/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirm": true
}
```

### Response
```json
{
  "message": "User removed successfully",
  "removedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- User Management Guide
- Tenant Administration Guide
- Audit Log Guide
- Security Policies
