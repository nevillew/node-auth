# Role Assignment Process

## Overview
This document details the technical implementation of assigning roles to users in the multi-tenant platform, including validation, security measures, and notification processes.

## Process Flow

### 1. Assignment Request
- **Endpoint**: `PUT /api/users/:id/roles`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "roleIds": ["uuid1", "uuid2"]
}
```

### 2. Validation Process
1. **Input Validation**
   ```javascript
   const schema = Joi.object({
     roleIds: Joi.array()
       .items(Joi.string().uuid())
       .min(1)
       .required()
       .messages({
         'array.min': 'At least one role must be assigned',
         'array.base': 'Role IDs must be an array',
         'string.guid': 'Invalid role ID format'
       })
   });
   ```

2. **Role Validation**
   - Verify roles exist
   - Check admin rights
   - Validate tenant access
   - Check role constraints

### 3. Assignment Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  const user = await User.findByPk(userId, {
    include: [Role],
    transaction: t
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify all roles exist
  const roles = await Role.findAll({
    where: { id: roleIds },
    transaction: t
  });

  if (roles.length !== roleIds.length) {
    throw new AppError('One or more roles not found', 400);
  }

  // Check if removing admin role and user is last admin
  const currentRoles = user.Roles;
  const isLosingAdmin = currentRoles.some(r => 
    r.name === 'admin' && !roleIds.includes(r.id)
  );

  if (isLosingAdmin) {
    const adminCount = await UserRole.count({
      where: { roleId: currentRoles.find(r => r.name === 'admin').id },
      transaction: t
    });

    if (adminCount === 1) {
      throw new AppError('Cannot remove last admin role', 400);
    }
  }

  // Remove existing roles
  await UserRole.destroy({
    where: { userId },
    transaction: t
  });

  // Assign new roles
  await UserRole.bulkCreate(
    roleIds.map(roleId => ({
      userId,
      roleId
    })),
    { transaction: t }
  );

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Cache Management
```javascript
// Clear role cache
await redisClient.del(`user:${userId}:roles`);
await redisClient.del(`tenant:${tenantId}:user-roles`);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'ROLES_ASSIGNED',
  details: {
    targetUserId: userId,
    previousRoles: currentRoles.map(r => ({ id: r.id, name: r.name })),
    newRoles: roles.map(r => ({ id: r.id, name: r.name }))
  },
  severity: 'medium'
});
```

#### Session Management
1. **Token Updates**
   - Revoke active sessions
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
await notificationService.sendSystemNotification(
  userId,
  `Your roles have been updated by ${req.user.name}`
);
```

#### Admin Alerts
1. **Dashboard Updates**
   - Role change alert
   - User impact
   - Permission changes
   - Scope modifications

2. **Audit Trail**
   - Change details
   - Admin responsible
   - Timestamp
   - Impact assessment

## Implementation Details

### Role Assignment
```javascript
async function assignRolesToUser(userId, roleIds, assignedBy) {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, {
      include: [Role],
      transaction: t
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify all roles exist
    const roles = await Role.findAll({
      where: { id: roleIds },
      transaction: t
    });

    if (roles.length !== roleIds.length) {
      throw new AppError('One or more roles not found', 400);
    }

    // Remove existing roles
    await UserRole.destroy({
      where: { userId },
      transaction: t
    });

    // Assign new roles
    await UserRole.bulkCreate(
      roleIds.map(roleId => ({
        userId,
        roleId
      })),
      { transaction: t }
    );

    await t.commit();
    return roles;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}
```

### Cache Management
```javascript
async function clearRoleCache(userId, tenantId) {
  const keys = [
    `user:${userId}:roles`,
    `tenant:${tenantId}:user-roles`,
    `user:${userId}:permissions`
  ];
  await redisClient.del(keys);
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid role IDs
   - Missing roles
   - Permission denied
   - Last admin check

2. **Processing Errors**
   - Database failure
   - Cache error
   - Session error
   - Notification failure

### Error Responses
```json
{
  "error": "ROLE_ASSIGNMENT_ERROR",
  "message": "Failed to assign roles",
  "details": {
    "roleIds": ["Invalid role ID"],
    "adminCheck": "Cannot remove last admin role"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Assignment duration
   - Cache operations
   - Database latency
   - API response time

2. **Business Metrics**
   - Role changes
   - Admin ratio
   - Error rates
   - User impact

### Audit Trail
```javascript
{
  event: 'ROLES_ASSIGNED',
  severity: 'medium',
  details: {
    userId: 'uuid',
    assignedBy: 'admin-uuid',
    changes: {
      added: ['role-ids'],
      removed: ['role-ids']
    }
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Check constraints
   - Log all changes
   - Monitor patterns

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

### Assign Roles
```http
PUT /api/users/:id/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleIds": ["uuid1", "uuid2"]
}
```

### Response
```json
{
  "message": "Roles assigned successfully",
  "roles": [
    {
      "id": "uuid1",
      "name": "Admin",
      "scopes": ["admin"]
    },
    {
      "id": "uuid2",
      "name": "Editor",
      "scopes": ["write"]
    }
  ]
}
```

## Related Documentation
- Role Creation Guide
- User Management Guide
- Audit Log Guide
- Security Policies
