# Role Creation Process

## Overview
This document details the technical implementation of role creation in the multi-tenant platform, including validation, permission assignment, and audit processes.

## Process Flow

### 1. Creation Request
- **Endpoint**: `POST /api/roles`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "name": "Support Agent",
  "description": "Customer support team member",
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
       .required(),
     description: Joi.string()
       .max(200)
       .optional(),
     scopes: Joi.array()
       .items(Joi.string())
       .min(1)
       .required(),
     permissions: Joi.array()
       .items(Joi.string().uuid())
       .optional()
   });
   ```

2. **Scope Validation**
   ```javascript
   const { validateScopes } = require('../auth/scopes');
   if (!validateScopes(scopes)) {
     throw new Error('One or more invalid scopes provided');
   }
   ```

### 3. Creation Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Create role
  const role = await Role.create({
    name,
    description,
    scopes,
    tenantId: req.tenant.id
  }, { transaction: t });

  // Assign permissions if provided
  if (permissions?.length > 0) {
    await RolePermission.bulkCreate(
      permissions.map(permissionId => ({
        roleId: role.id,
        permissionId
      })),
      { transaction: t }
    );
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
await redisClient.del(`tenant:${tenantId}:roles`);
await redisClient.del(`role:${role.id}`);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'ROLE_CREATED',
  details: {
    roleId: role.id,
    name,
    scopes,
    permissions
  },
  severity: 'medium'
});
```

#### Permission Validation
1. **Scope Check**
   - Validate scope hierarchy
   - Check for conflicts
   - Verify admin rights
   - Validate inheritance

2. **Permission Check**
   - Verify permission exists
   - Check access levels
   - Validate combinations
   - Check constraints

### 5. Notification System

#### Admin Notifications
```javascript
await notificationService.sendSystemNotification(
  adminUserId,
  `New role "${role.name}" created by ${req.user.name}`
);
```

## Implementation Details

### Role Creation
```javascript
const roleDefaults = {
  isDefault: false,
  status: 'active',
  createdBy: req.user.id,
  tenantId: req.tenant.id
};

const role = await Role.create({
  ...roleDefaults,
  name,
  description,
  scopes
});
```

### Permission Assignment
```javascript
async function assignPermissions(role, permissions, transaction) {
  // Validate permissions exist
  const validPermissions = await Permission.findAll({
    where: { id: permissions },
    transaction
  });

  if (validPermissions.length !== permissions.length) {
    throw new Error('One or more invalid permissions');
  }

  // Create role-permission associations
  await RolePermission.bulkCreate(
    permissions.map(permissionId => ({
      roleId: role.id,
      permissionId
    })),
    { transaction }
  );
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid name format
   - Invalid scopes
   - Missing required fields
   - Permission not found

2. **Processing Errors**
   - Database failure
   - Transaction error
   - Cache error
   - Notification failure

### Error Responses
```json
{
  "error": "ROLE_CREATION_ERROR",
  "message": "Failed to create role",
  "details": {
    "name": "Name already exists",
    "scopes": ["Invalid scope: users:invalid"]
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Creation time
   - Cache operations
   - Transaction duration
   - API latency

2. **Business Metrics**
   - Roles created
   - Permission counts
   - Usage patterns
   - Error rates

### Audit Trail
```javascript
{
  event: 'ROLE_CREATED',
  severity: 'medium',
  details: {
    roleId: 'uuid',
    name: 'string',
    scopes: ['array'],
    permissions: ['array'],
    createdBy: 'uuid'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Validate permissions
   - Check constraints
   - Audit changes
   - Monitor patterns

2. **Data Protection**
   - Validate input
   - Secure storage
   - Cache management
   - Transaction safety

### Performance
1. **Resource Management**
   - Connection pooling
   - Cache strategy
   - Transaction handling
   - Batch operations

2. **Optimization**
   - Query efficiency
   - Cache usage
   - Index utilization
   - Bulk operations

## API Reference

### Create Role
```http
POST /api/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Support Agent",
  "description": "Customer support role",
  "scopes": ["users:read", "tickets:write"],
  "permissions": ["uuid1", "uuid2"]
}
```

### Response
```json
{
  "id": "uuid",
  "name": "Support Agent",
  "description": "Customer support role",
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
  "createdAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Permission Management Guide
- Scope Configuration Guide
- Audit Log Guide
- Security Policies
