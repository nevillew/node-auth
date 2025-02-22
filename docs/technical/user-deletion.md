# User Deletion Process

## Overview
This document details the technical implementation of user deletion in the multi-tenant platform, including validation, data cleanup, and notification processes.

## Process Flow

### 1. Deletion Request
- **Endpoint**: `DELETE /api/users/:id`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "confirm": true
}
```

### 2. Pre-Deletion Checks
1. **Validation**
   - Verify user exists
   - Check admin permissions
   - Require explicit confirmation
   - Validate user status

2. **Role Verification**
   ```javascript
   // Check if user is last admin in any tenants
   const tenantAdmins = await TenantUser.findAll({
     where: {
       userId,
       roles: { [Op.contains]: ['admin'] }
     },
     include: [Tenant]
   });

   for (const tenantAdmin of tenantAdmins) {
     const adminCount = await TenantUser.count({
       where: {
         tenantId: tenantAdmin.tenantId,
         roles: { [Op.contains]: ['admin'] }
       }
     });

     if (adminCount === 1) {
       throw new Error(`Cannot delete last admin for tenant ${tenantAdmin.Tenant.name}`);
     }
   }
   ```

### 3. Deletion Process

#### Phase 1: Soft Delete
```javascript
await user.update({
  status: 'deleted',
  deletedAt: new Date(),
  deletedBy: deleterId
});
```

#### Phase 2: Session Management
1. **Token Revocation**
   ```javascript
   await OAuthToken.update(
     { revoked: true },
     { where: { userId } }
   );
   ```

2. **Session Cleanup**
   - Clear active sessions
   - Revoke refresh tokens
   - Update session store
   - Clean cache entries

#### Phase 3: Resource Cleanup
1. **File Storage**
   - Archive user files
   - Remove avatars
   - Clean uploads
   - Export data

2. **Database Records**
   - Remove role assignments
   - Clear permissions
   - Archive activity logs
   - Update references

3. **External Services**
   - Revoke API tokens
   - Remove webhooks
   - Clean integrations
   - Update indexes

### 4. Notification System

#### Email Notifications
1. **Admin Notifications**
   ```javascript
   await notificationService.sendEmail({
     to: admin.email,
     subject: `User ${user.email} deleted`,
     template: 'user-deleted',
     context: {
       name: admin.name,
       deletedUser: user.email,
       deletedBy: req.user.email,
       date: new Date().toLocaleDateString()
     }
   });
   ```

2. **System Notifications**
   - Slack alerts
   - Admin dashboard
   - Audit logs
   - Status updates

#### Audit Trail
```javascript
await SecurityAuditLog.create({
  userId: deleterId,
  event: 'USER_DELETED',
  details: {
    deletedUserId: userId,
    email: user.email,
    tenants: tenantAdmins.map(t => t.tenantId)
  },
  severity: 'high'
});
```

### 5. Cleanup Tasks

#### Data Retention
1. **Retained Data**
   - Audit logs: 1 year
   - Activity history: 90 days
   - System logs: 30 days
   - Legal records: 7 years

2. **Immediate Deletion**
   - Personal data
   - Access tokens
   - Session data
   - Cache entries

#### Resource Recovery
1. **System Resources**
   - User quotas
   - Storage allocation
   - API limits
   - License seats

2. **Service Cleanup**
   - OAuth applications
   - Email subscriptions
   - Notification settings
   - Integration tokens

## Implementation Details

### Database Operations
```javascript
const t = await sequelize.transaction();
try {
  // Soft delete user
  await user.update({
    status: 'deleted',
    deletedAt: new Date(),
    deletedBy: deleterId
  }, { transaction: t });

  // Remove role assignments
  await UserRole.destroy({
    where: { userId },
    transaction: t
  });

  // Archive activity logs
  await ActivityLog.update(
    { archived: true },
    { 
      where: { userId },
      transaction: t 
    }
  );

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

### File Cleanup
```javascript
// Remove user files from S3
const objects = await s3.listObjects({
  Bucket: process.env.AWS_BUCKET_NAME,
  Prefix: `users/${userId}/`
});

await Promise.all(
  objects.Contents.map(obj =>
    s3.deleteObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: obj.Key
    })
  )
);
```

### Cache Invalidation
```javascript
// Clear user-specific cache
const keys = await redisClient.keys(`user:${userId}:*`);
if (keys.length > 0) {
  await redisClient.del(keys);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - User not found
   - Permission denied
   - Role constraints
   - Status conflicts

2. **Resource Errors**
   - File deletion failed
   - Token revocation failed
   - Cache clear failed
   - Database errors

### Recovery Procedures
1. **Transaction Rollback**
   ```javascript
   try {
     await t.commit();
   } catch (error) {
     await t.rollback();
     logger.error('User deletion failed:', error);
   }
   ```

2. **Cleanup Verification**
   - Verify soft delete
   - Check file removal
   - Validate cache clear
   - Confirm notifications

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Deletion duration
   - Resource cleanup time
   - Network operations
   - Cache operations

2. **Business Metrics**
   - Deleted users
   - Data volume
   - Storage freed
   - Token revocations

### Audit Trail
```javascript
{
  event: 'USER_DELETION_COMPLETED',
  severity: 'high',
  details: {
    userId: 'uuid',
    email: 'user@example.com',
    deletedBy: 'admin-uuid',
    tenants: ['tenant-ids'],
    duration: 'time in ms'
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
   - Data export
   - Audit logging
   - Privacy compliance

### Performance
1. **Resource Management**
   - Batch operations
   - Parallel processing
   - Connection pooling
   - Rate limiting

2. **Optimization**
   - Cache management
   - Index updates
   - Query efficiency
   - Transaction handling

## API Reference

### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirm": true
}
```

### Response
```json
{
  "message": "User deleted successfully",
  "deletedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- User Creation Guide
- Role Management Guide
- Audit Log Guide
- Security Policies
