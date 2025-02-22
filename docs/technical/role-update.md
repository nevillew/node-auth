# Role Update Process

## Overview
This document details the technical implementation of role updates in the multi-tenant platform, including validation, permission changes, and audit processes.

## Process Flow

### 1. Update Request
- **Endpoint**: `PUT /api/roles/:id`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "name": "Updated Role Name",
  "description": "Updated description",
  "scopes": ["users:read", "tickets:write"],
  "permissions": ["uuid1", "uuid2"]
}
```

### 2. Validation Process
1. **Input Validation**
   ```javascript
   const schema = Joi.object({
     name: Joi.string()
       .min(2)
       .max(50)
       .optional(),
     description: Joi.string()
       .max(200)
       .optional(),
     scopes: Joi.array()
       .items(Joi.string())
       .min(1)
       .optional(),
     permissions: Joi.array()
       .items(Joi.string().uuid())
       .optional()
   }).min(1);
   ```

2. **Role Validation**
   - Verify role exists
   - Check admin rights
   - Validate tenant access
   - Check default role status

### 3. Update Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Track changes for audit
  const changes = {};
  if (name && name !== role.name) changes.name = { from: role.name, to: name };
  if (description && description !== role.description) {
    changes.description = { from: role.description, to: description };
  }
  if (scopes) changes.scopes = { from: role.scopes, to: scopes };

  // Update role
  await role.update({
    name: name || role.name,
    description: description || role.description,
    scopes: scopes || role.scopes
  }, { transaction: t });

  // Update permissions if provided
  if (permissions) {
    await RolePermission.destroy({
      where: { roleId: role.id },
      transaction: t
    });

    if (permissions.length > 0) {
      await RolePermission.bulkCreate(
        permissions.map(permissionId => ({
          roleId: role.id,
          permissionId
        })),
        { transaction: t }
      );
    }
  }

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
  event: 'ROLE_UPDATED',
  details: {
    roleId: role.id,
    changes,
    affectedUsers: role.Users.length
  },
  severity: 'medium'
});
```

#### User Session Management
1. **Token Updates**
   - Check affected users
   - Update active sessions
   - Refresh permissions
   - Clear user caches

2. **Access Control**
   - Validate new permissions
   - Check scope changes
   - Update access tokens
   - Refresh user rights

### 5. Notification System

#### User Notifications
```javascript
// Notify affected users
await Promise.all(role.Users.map(user => 
  notificationService.sendSystemNotification(
    user.id,
    `The role "${role.name}" has been updated by ${req.user.name}`
  )
));
```

#### Admin Alerts
1. **Dashboard Updates**
   - Role change alert
   - Affected users count
   - Permission changes
   - Scope modifications

2. **Audit Trail**
   - Change details
   - Admin responsible
   - Timestamp
   - Impact assessment

## Implementation Details

### Permission Updates
```javascript
async function updatePermissions(role, permissions, transaction) {
  // Remove existing permissions
  await RolePermission.destroy({
    where: { roleId: role.id },
    transaction
  });

  // Add new permissions
  if (permissions.length > 0) {
    await RolePermission.bulkCreate(
      permissions.map(permissionId => ({
        roleId: role.id,
        permissionId
      })),
      { transaction }
    );
  }
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
   - Invalid role name
   - Invalid permissions
   - Missing fields
   - Duplicate name

2. **Processing Errors**
   - Database failure
   - Cache error
   - Permission error
   - Transaction failure

### Error Responses
```json
{
  "error": "ROLE_UPDATE_ERROR",
  "message": "Failed to update role",
  "details": {
    "name": "Name already exists",
    "permissions": ["Invalid permission ID"]
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Update duration
   - Cache operations
   - Database latency
   - API response time

2. **Business Metrics**
   - Update frequency
   - Permission changes
   - User impact
   - Error rates

### Audit Trail
```javascript
{
  event: 'ROLE_UPDATED',
  severity: 'medium',
  details: {
    roleId: 'uuid',
    changes: {
      name: { from: 'Old Name', to: 'New Name' },
      permissions: { added: ['uuid1'], removed: ['uuid2'] }
    },
    affectedUsers: 5
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Validate changes
   - Log updates
   - Monitor impact

2. **Data Protection**
   - Transaction safety
   - Cache management
   - Session handling
   - Audit logging

### Performance
1. **Resource Management**
   - Batch updates
   - Cache strategy
   - Connection pooling
   - Transaction handling

2. **Optimization**
   - Query efficiency
   - Cache usage
   - Bulk operations
   - Index utilization

## API Reference

### Update Role
```http
PUT /api/roles/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Role",
  "description": "Updated description",
  "scopes": ["users:read", "tickets:write"],
  "permissions": ["uuid1", "uuid2"]
}
```

### Response
```json
{
  "id": "uuid",
  "name": "Updated Role",
  "description": "Updated description",
  "scopes": ["users:read", "tickets:write"],
  "permissions": [
    {
      "id": "uuid1",
      "name": "Read Users"
    },
    {
      "id": "uuid2",
      "name": "Write Tickets"
    }
  ],
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Role Creation Guide
- Permission Management Guide
- Audit Log Guide
- Security Policies
