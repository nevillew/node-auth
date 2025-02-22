# Permission Management Guide

## Overview
This document details the technical implementation of permission management in the multi-tenant platform, including role-based access control (RBAC), permission inheritance, and audit processes.

## Permission Structure

### 1. Basic Components
```javascript
const permissionTypes = {
  create: 'Create new resources',
  read: 'View existing resources',
  update: 'Modify existing resources',
  delete: 'Remove existing resources',
  manage: 'Full resource control'
};

const resourceTypes = {
  users: 'User management',
  roles: 'Role management',
  tenants: 'Tenant management',
  settings: 'System settings'
};
```

### 2. Permission Format
```json
{
  "id": "uuid",
  "name": "users:read",
  "description": "View user details",
  "resource": "users",
  "action": "read",
  "constraints": {
    "tenant": "required",
    "scope": "tenant"
  }
}
```

## Implementation

### 1. Permission Assignment
```javascript
async function assignPermissions(roleId, permissions) {
  const t = await sequelize.transaction();
  try {
    // Remove existing permissions
    await RolePermission.destroy({
      where: { roleId },
      transaction: t
    });

    // Add new permissions
    await RolePermission.bulkCreate(
      permissions.map(permissionId => ({
        roleId,
        permissionId
      })),
      { transaction: t }
    );

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
}
```

### 2. Permission Validation
```javascript
function hasPermission(user, permission) {
  return user.roles.some(role =>
    role.permissions.includes(permission) ||
    role.permissions.includes('admin')
  );
}

function validateScope(userScopes, requiredScope) {
  if (userScopes.includes('*')) return true;
  
  const expandedScopes = userScopes.reduce((acc, scope) => {
    return [...acc, ...expandScope(scope)];
  }, []);

  return expandedScopes.includes(requiredScope);
}
```

## Permission Hierarchy

### 1. Scope-Based Inheritance
```javascript
const SCOPE_HIERARCHY = {
  // Admin scope includes all others
  'admin': ['*'],

  // Resource management
  'users:manage': ['users:read', 'users:write', 'users:delete'],
  'tenants:manage': ['tenants:read', 'tenants:write', 'tenants:delete'],
  'roles:manage': ['roles:read', 'roles:write', 'roles:delete'],

  // Feature-specific
  'settings:manage': ['settings:read', 'settings:write'],
  'audit:manage': ['audit:read', 'audit:write']
};
```

### 2. Role-Based Inheritance
```javascript
const DEFAULT_ROLES = {
  admin: {
    name: 'Admin',
    scopes: ['*'],
    isDefault: true
  },
  member: {
    name: 'Member',
    scopes: ['users:read', 'data:write'],
    isDefault: true
  },
  viewer: {
    name: 'Viewer',
    scopes: ['users:read', 'data:read'],
    isDefault: true
  }
};
```

## Access Control

### 1. Middleware Implementation
```javascript
const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (!hasPermission(req.user, permission)) {
      throw new AppError('INSUFFICIENT_PERMISSIONS', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};

const requireScope = (scope) => async (req, res, next) => {
  try {
    if (!validateScope(req.user.scopes, scope)) {
      throw new AppError('INVALID_SCOPE', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
```

### 2. Route Protection
```javascript
router.get('/users',
  requireScope('users:read'),
  userController.list
);

router.post('/users',
  requirePermission('users:create'),
  userController.create
);
```

## Security Measures

### 1. Permission Validation
```javascript
function validatePermissions(permissions) {
  return permissions.every(permission => {
    // Check permission format
    if (!permission.match(/^[a-z]+:[a-z]+$/)) {
      return false;
    }

    // Check resource exists
    const [resource] = permission.split(':');
    if (!Object.keys(resourceTypes).includes(resource)) {
      return false;
    }

    return true;
  });
}
```

### 2. Audit Logging
```javascript
async function logPermissionChange(userId, roleId, changes) {
  await SecurityAuditLog.create({
    userId,
    event: 'PERMISSIONS_UPDATED',
    details: {
      roleId,
      changes: {
        added: changes.added,
        removed: changes.removed
      }
    },
    severity: 'high'
  });
}
```

## Best Practices

### 1. Permission Design
- Use descriptive names
- Follow consistent patterns
- Document constraints
- Regular review

### 2. Security
- Principle of least privilege
- Regular audits
- Monitor changes
- Log access attempts

### 3. Performance
- Cache permissions
- Batch updates
- Efficient validation
- Monitor usage

## API Reference

### Assign Permissions
```http
PUT /api/roles/:id/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permissions": ["uuid1", "uuid2"]
}
```

### Check Permission
```http
GET /api/permissions/check/:resource/:action
Authorization: Bearer <token>

Response:
{
  "allowed": true,
  "scope": "tenant"
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   ```json
   {
     "error": "INVALID_PERMISSION",
     "message": "Invalid permission format",
     "details": {
       "permission": "invalid:format"
     }
   }
   ```

2. **Access Errors**
   ```json
   {
     "error": "INSUFFICIENT_PERMISSIONS",
     "message": "Missing required permission",
     "required": "users:write"
   }
   ```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Validation time
   - Cache hits/misses
   - Update frequency
   - Error rates

2. **Security Metrics**
   - Permission changes
   - Access patterns
   - Failed attempts
   - Role updates

### Audit Trail
```javascript
{
  event: 'PERMISSION_CHANGE',
  severity: 'high',
  details: {
    roleId: 'uuid',
    userId: 'uuid',
    changes: {
      added: ['permission1'],
      removed: ['permission2']
    }
  }
}
```

## Related Documentation
- Role Management Guide
- Access Control Guide
- Audit Log Guide
- Security Policies
