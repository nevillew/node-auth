# Access Control Guide

## Overview
This document details the access control system implementation in the multi-tenant platform, including role-based access control (RBAC), permission management, and scope-based authorization.

## Access Control Model

### 1. Role-Based Access Control (RBAC)
```javascript
const roleStructure = {
  admin: {
    name: 'Admin',
    description: 'Full system access',
    scopes: ['*'],
    isDefault: false
  },
  member: {
    name: 'Member',
    description: 'Standard user access',
    scopes: ['users:read', 'data:write'],
    isDefault: true
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    scopes: ['users:read', 'data:read'],
    isDefault: false
  }
};
```

### 2. Permission System
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

### 3. Scope Hierarchy
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

## Implementation

### 1. Role Assignment
```javascript
async function assignRolesToUser(userId, roleIds, assignedBy) {
  const t = await sequelize.transaction();
  try {
    // Verify roles exist
    const roles = await Role.findAll({
      where: { id: roleIds },
      transaction: t
    });

    // Check admin role changes
    const isLosingAdmin = currentRoles.some(r => 
      r.name === 'admin' && !roleIds.includes(r.id)
    );

    if (isLosingAdmin) {
      const adminCount = await countAdminUsers(t);
      if (adminCount === 1) {
        throw new Error('Cannot remove last admin');
      }
    }

    // Update roles
    await UserRole.destroy({ where: { userId }, transaction: t });
    await UserRole.bulkCreate(
      roleIds.map(roleId => ({ userId, roleId })),
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

### 3. Access Control Middleware
```javascript
const authenticateHandler = async (req, res, next) => {
  try {
    // Validate token
    const token = await verifyToken(req.headers.authorization);
    
    // Check required scopes
    const requiredScopes = req.route?.scopes || [];
    if (requiredScopes.length > 0) {
      const hasScope = validateScope(token.scopes, requiredScopes);
      if (!hasScope) {
        throw new Error('Insufficient permissions');
      }
    }

    // Add user to request
    req.user = token.user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

## Security Features

### 1. Token-Based Authentication
- JWT tokens with short expiry
- Refresh token rotation
- Token revocation support
- Session management

### 2. Permission Inheritance
- Role-based inheritance
- Scope-based inheritance
- Resource-level permissions
- Tenant isolation

### 3. Access Monitoring
- Failed attempt tracking
- Permission change logs
- Access pattern analysis
- Security alerts

## Best Practices

### 1. Role Management
- Use principle of least privilege
- Regular access reviews
- Role templates
- Clear naming conventions

### 2. Permission Assignment
- Granular permissions
- Resource-level control
- Audit all changes
- Regular validation

### 3. Security Measures
- Rate limiting
- Input validation
- Output sanitization
- Error handling

## Implementation Examples

### 1. Role Creation
```javascript
// Create admin role
await Role.create({
  name: 'Admin',
  description: 'Full system access',
  scopes: ['*'],
  isDefault: false,
  tenantId
});

// Create member role
await Role.create({
  name: 'Member',
  description: 'Standard access',
  scopes: ['users:read', 'data:write'],
  isDefault: true,
  tenantId
});
```

### 2. Permission Check
```javascript
// Check user permission
const canAccessResource = async (userId, resourceId, action) => {
  const user = await User.findByPk(userId, {
    include: [Role]
  });

  return user.Roles.some(role => 
    role.permissions.includes(`${resourceId}:${action}`) ||
    role.permissions.includes('admin')
  );
};
```

### 3. Scope Validation
```javascript
// Validate API scope
const validateApiScope = (userScopes, endpoint) => {
  const requiredScope = endpoint.scope;
  return validateScope(userScopes, requiredScope);
};
```

## API Reference

### Role Management
```http
# Create role
POST /api/roles
Content-Type: application/json
{
  "name": "Editor",
  "description": "Content editor",
  "scopes": ["content:write", "content:read"]
}

# Assign role
PUT /api/users/:id/roles
Content-Type: application/json
{
  "roleIds": ["role-uuid-1", "role-uuid-2"]
}
```

### Permission Management
```http
# Update permissions
PUT /api/roles/:id/permissions
Content-Type: application/json
{
  "permissions": ["permission-uuid-1", "permission-uuid-2"]
}

# Check permission
GET /api/permissions/check/:resourceId/:action
```

## Error Handling

### Common Errors
1. **Permission Denied**
   ```json
   {
     "error": "PERMISSION_DENIED",
     "message": "Insufficient permissions",
     "requiredScope": "users:write"
   }
   ```

2. **Role Assignment Error**
   ```json
   {
     "error": "ROLE_ASSIGNMENT_ERROR",
     "message": "Cannot remove last admin",
     "details": {
       "userId": "uuid",
       "roles": ["admin"]
     }
   }
   ```

### Recovery Procedures
1. **Permission Escalation**
   - Request temporary access
   - Admin override
   - Emergency access protocol
   - Audit logging

2. **Role Conflicts**
   - Role hierarchy check
   - Permission validation
   - Scope resolution
   - Conflict logging

## Monitoring & Logging

### Security Events
1. **Access Events**
   - Permission checks
   - Role changes
   - Access attempts
   - Pattern analysis

2. **Audit Trail**
   ```javascript
   {
     event: 'PERMISSION_CHANGE',
     severity: 'high',
     details: {
       userId: 'uuid',
       roleId: 'uuid',
       changes: {
         added: ['permission1'],
         removed: ['permission2']
       }
     }
   }
   ```

## Related Documentation
- Authentication Guide
- Role Management Guide
- Audit Log Guide
- Security Policies
