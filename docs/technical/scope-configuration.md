# Scope Configuration Guide

## Overview
This document details the technical implementation of scope configuration in the multi-tenant platform, including hierarchy, validation, and enforcement.

## Scope Structure

### Scope Hierarchy
```javascript
const SCOPE_HIERARCHY = {
  // Admin scope includes all other scopes
  'admin': ['*'],

  // Resource management scopes
  'users:manage': ['users:read', 'users:write', 'users:delete'],
  'tenants:manage': ['tenants:read', 'tenants:write', 'tenants:delete'],
  'roles:manage': ['roles:read', 'roles:write', 'roles:delete'],

  // Read scopes
  'users:read': ['users:profile:read', 'users:activity:read'],
  'tenants:read': ['tenants:settings:read', 'tenants:audit:read'],
  'roles:read': ['roles:permissions:read'],

  // Write scopes
  'users:write': ['users:profile:write', 'users:settings:write'],
  'tenants:write': ['tenants:settings:write', 'tenants:config:write'],
  'roles:write': ['roles:permissions:write'],

  // Security scopes
  'security:manage': [
    'security:audit:read',
    'security:settings:write',
    'security:auth:manage'
  ]
};
```

### Scope Naming Convention
1. **Resource-Based**
   - Format: `resource:action`
   - Example: `users:read`
   - Granularity: `users:profile:read`

2. **Action Types**
   - read: Read access
   - write: Create/Update access
   - delete: Delete access
   - manage: Full access

3. **Special Scopes**
   - admin: Full system access
   - *: Wildcard access
   - resource:*: All actions on resource

## Implementation

### Scope Validation
```javascript
function validateScopes(scopes) {
  if (!Array.isArray(scopes)) return false;
  
  return scopes.every(scope => {
    // Check if scope exists in hierarchy
    return FLAT_SCOPES.has(scope) || 
           scope === '*' ||
           scope.endsWith(':*');
  });
}
```

### Scope Expansion
```javascript
function expandScope(scope) {
  if (scope === '*') return Array.from(FLAT_SCOPES);
  
  const expanded = new Set([scope]);
  const children = SCOPE_HIERARCHY[scope] || [];
  
  children.forEach(child => {
    if (child === '*') {
      Array.from(FLAT_SCOPES).forEach(s => expanded.add(s));
    } else {
      expanded.add(child);
      const grandChildren = expandScope(child);
      grandChildren.forEach(s => expanded.add(s));
    }
  });
  
  return Array.from(expanded);
}
```

### Permission Checking
```javascript
function hasRequiredScopes(userScopes, requiredScopes) {
  const expandedUserScopes = new Set(
    userScopes.flatMap(scope => expandScope(scope))
  );
  
  return requiredScopes.every(scope => 
    expandedUserScopes.has(scope) || 
    expandedUserScopes.has('*') ||
    (scope.includes(':') && expandedUserScopes.has(scope.split(':')[0] + ':*'))
  );
}
```

## Usage Examples

### Route Protection
```javascript
router.get('/users', 
  authenticateHandler,
  (req, res, next) => {
    req.route = { scopes: ['users:read'] };
    next();
  },
  userController.list
);
```

### Token Generation
```javascript
const token = await oauth2Server.generateToken({
  client,
  scope: requestedScopes.join(' '),
  type: 'm2m',
  expiresIn: 3600
});
```

### Role Configuration
```javascript
const adminRole = {
  name: 'Admin',
  scopes: ['admin']
};

const viewerRole = {
  name: 'Viewer',
  scopes: ['users:read', 'tenants:read']
};
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid scope format
   - Unknown scope
   - Circular dependency
   - Missing required scope

2. **Permission Errors**
   - Insufficient scopes
   - Scope mismatch
   - Invalid hierarchy
   - Token expired

### Error Responses
```javascript
{
  error: 'INSUFFICIENT_SCOPES',
  message: 'Missing required scopes',
  details: {
    required: ['users:write'],
    provided: ['users:read']
  }
}
```

## Best Practices

### Security
1. **Scope Design**
   - Follow least privilege
   - Clear naming convention
   - Proper hierarchy
   - Regular review

2. **Implementation**
   - Validate all scopes
   - Cache expansions
   - Audit access
   - Monitor usage

### Performance
1. **Optimization**
   - Cache scope trees
   - Efficient validation
   - Quick lookups
   - Minimal expansion

2. **Resource Usage**
   - Memory efficient
   - CPU efficient
   - Cache strategy
   - Clean hierarchy

## API Reference

### Validate Scopes
```javascript
// Check if scopes are valid
const valid = validateScopes(['users:read', 'tenants:write']);

// Expand scope hierarchy
const expanded = expandScope('users:manage');

// Check required scopes
const hasAccess = hasRequiredScopes(
  userScopes,
  ['users:read', 'tenants:write']
);
```

### Response Format
```json
{
  "scopes": ["users:read", "tenants:write"],
  "expanded": ["users:read", "users:profile:read", "..."],
  "valid": true
}
```

## Related Documentation
- [OAuth 2.0 Configuration](../technical/oauth2-configuration.md)
- [Role Management Guide](../technical/role-management-guide.md)
- [Security Policies](../security-policies.md)
- [Access Control Guide](../technical/access-control-guide.md)
