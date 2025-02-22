# Role Deletion Process

## Overview
This document details the technical implementation of role deletion in the multi-tenant platform, including validation, cleanup, and notification processes.

## Process Flow

### 1. Deletion Request
- **Endpoint**: `DELETE /api/roles/:id`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "confirm": true
}
```

### 2. Pre-Deletion Checks
1. **Validation**
   ```javascript
   const role = await Role.findByPk(roleId, {
     include: [
       {
         model: User,
         attributes: ['id', 'email', 'name']
       },
       Permission
     ]
   });

   if (role.isDefault) {
     throw new Error('Cannot delete default role');
   }
   ```

2. **User Impact Assessment**
   - Check assigned users
   - Verify role dependencies
   - Assess permission impact
   - Calculate scope changes

### 3. Deletion Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Remove role permissions
  await RolePermission.destroy({
    where: { roleId: role.id },
    transaction: t
  });

  // Remove role from users
  await UserRole.destroy({
    where: { roleId: role.id },
    transaction: t
  });

  // Delete the role
  await role.destroy({ transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Cache Management
```javascript
// Clear role cache
await redisClient.del(`role:${role.id}`);
await redisClient.del(`tenant:${role.tenantId}:roles`);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'ROLE_DELETED',
  details: {
    roleId: role.id,
    name: role.name,
    permissions: role.Permissions.map(p => p.name),
    affectedUsers: role.Users.length
  },
  severity: 'high'
});
```

#### User Session Management
1. **Token Updates**
   - Revoke affected sessions
   - Update access tokens
   - Clear user caches
   - Refresh permissions

2. **Access Control**
   - Update user rights
   - Recalculate scopes
   - Refresh ACLs
   - Update role counts

### 5. Notification System

#### User Notifications
```javascript
// Notify affected users
await Promise.all(role.Users.map(user =>
  notificationService.sendSystemNotification(
    user.id,
    `The role "${role.name}" you were assigned to has been deleted by ${req.user.name}`
  )
));
```

#### Admin Alerts
1. **Dashboard Updates**
   - Role deletion alert
   - Affected users count
   - Permission changes
   - Scope modifications

2. **Audit Trail**
   - Deletion details
   - Admin responsible
   - Timestamp
   - Impact assessment

## Implementation Details

### Permission Cleanup
```javascript
async function cleanupPermissions(roleId, transaction) {
  // Remove role permissions
  await RolePermission.destroy({
    where: { roleId },
    transaction
  });

  // Remove role from users
  await UserRole.destroy({
    where: { roleId },
    transaction
  });
}
```

### Cache Management
```javascript
async function clearRoleCache(roleId, tenantId) {
  const keys = [
    `role:${roleId}`,
    `tenant:${tenantId}:roles`,
    `tenant:${tenantId}:permissions`
  ];
  await redisClient.del(keys);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Role not found
   - Default role deletion
   - Permission denied
   - Missing confirmation

2. **Processing Errors**
   - Database failure
   - Cache error
   - Session error
   - Notification failure

### Error Responses
```json
{
  "error": "ROLE_DELETION_ERROR",
  "message": "Cannot delete default role",
  "details": {
    "roleId": "uuid",
    "name": "Admin",
    "isDefault": true
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Deletion duration
   - Cache operations
   - Database latency
   - API response time

2. **Business Metrics**
   - Roles deleted
   - Users affected
   - Permission changes
   - Error rates

### Audit Trail
```javascript
{
  event: 'ROLE_DELETED',
  severity: 'high',
  details: {
    roleId: 'uuid',
    name: 'string',
    permissions: ['array'],
    affectedUsers: number,
    deletedBy: 'admin-uuid'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Check constraints
   - Log all actions
   - Monitor impact

2. **Data Protection**
   - Transaction safety
   - Cache management
   - Session handling
   - Audit logging

### Performance
1. **Resource Management**
   - Batch operations
   - Cache strategy
   - Connection pooling
   - Transaction handling

2. **Optimization**
   - Query efficiency
   - Cache usage
   - Bulk operations
   - Index utilization

## API Reference

### Delete Role
```http
DELETE /api/roles/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirm": true
}
```

### Response
```json
{
  "message": "Role deleted successfully",
  "deletedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Role Creation Guide
- Role Update Guide
- Audit Log Guide
- Security Policies
