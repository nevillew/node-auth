# Role Management Guide

## Overview
This document provides a comprehensive guide for managing roles in the multi-tenant platform, including creation, updates, assignments, and best practices.

## Role Structure

### Basic Properties
```json
{
  "id": "uuid",
  "name": "Role Name",
  "description": "Role description",
  "scopes": ["users:read", "users:write"],
  "isDefault": false,
  "permissions": ["uuid1", "uuid2"],
  "tenantId": "tenant-uuid"
}
```

### Default Roles
1. **Admin**
   ```json
   {
     "name": "Admin",
     "description": "Full system access",
     "scopes": ["*"],
     "isDefault": true
   }
   ```

2. **Member**
   ```json
   {
     "name": "Member",
     "description": "Standard access",
     "scopes": ["users:read", "data:write"],
     "isDefault": true
   }
   ```

3. **Viewer**
   ```json
   {
     "name": "Viewer",
     "description": "Read-only access",
     "scopes": ["users:read", "data:read"],
     "isDefault": true
   }
   ```

## Role Operations

### Creating Roles
1. **API Request**
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

2. **Validation**
   - Unique name within tenant
   - Valid scopes
   - Valid permissions
   - Admin access required

### Updating Roles
1. **API Request**
   ```http
   PUT /api/roles/:id
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "name": "Updated Name",
     "description": "Updated description",
     "scopes": ["users:read", "tickets:write"],
     "permissions": ["uuid1", "uuid2"]
   }
   ```

2. **Change Management**
   - Track changes
   - Update user sessions
   - Notify affected users
   - Log modifications

### Deleting Roles
1. **Pre-deletion Checks**
   - Not a default role
   - No dependent users
   - Admin confirmation
   - Valid permissions

2. **Cleanup Tasks**
   - Remove assignments
   - Clear permissions
   - Update sessions
   - Notify users

## Role Assignment

### Assigning to Users
1. **API Request**
   ```http
   PUT /api/users/:id/roles
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "roleIds": ["uuid1", "uuid2"]
   }
   ```

2. **Validation**
   - Valid roles
   - User exists
   - Tenant access
   - Permission check

### Bulk Operations
1. **API Request**
   ```http
   POST /api/users/bulk/update
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "userIds": ["uuid1", "uuid2"],
     "updates": {
       "roleIds": ["role1", "role2"]
     }
   }
   ```

2. **Processing**
   - Batch updates
   - Transaction safety
   - Error handling
   - Audit logging

## Permission Management

### Role Permissions
1. **Structure**
   ```javascript
   const permissionTypes = {
     create: 'Create new resources',
     read: 'View existing resources',
     update: 'Modify existing resources',
     delete: 'Remove existing resources',
     manage: 'Full resource control'
   };
   ```

2. **Resource Types**
   ```javascript
   const resourceTypes = {
     users: 'User management',
     roles: 'Role management',
     tenants: 'Tenant management',
     settings: 'System settings'
   };
   ```

### Scope Hierarchy
```javascript
const SCOPE_HIERARCHY = {
  'admin': ['*'],
  'users:manage': ['users:read', 'users:write', 'users:delete'],
  'tenants:manage': ['tenants:read', 'tenants:write', 'tenants:delete'],
  'roles:manage': ['roles:read', 'roles:write', 'roles:delete']
};
```

## Security Considerations

### Access Control
1. **Permission Checks**
   - Validate admin rights
   - Check tenant access
   - Verify scope access
   - Monitor patterns

2. **Audit Logging**
   - Track changes
   - Log access
   - Monitor usage
   - Alert on issues

### Best Practices
1. **Role Design**
   - Least privilege
   - Clear naming
   - Document purpose
   - Regular review

2. **Assignment Process**
   - Verify needs
   - Document reasons
   - Review regularly
   - Monitor usage

## Monitoring & Alerts

### Metrics Collection
1. **Role Metrics**
   - Creation rate
   - Update frequency
   - Assignment patterns
   - Usage statistics

2. **Security Metrics**
   - Permission changes
   - Access patterns
   - Error rates
   - Alert triggers

### Audit Trail
```javascript
{
  event: 'ROLE_UPDATED',
  severity: 'medium',
  details: {
    roleId: 'uuid',
    changes: {
      name: { from: 'Old', to: 'New' },
      permissions: { added: [], removed: [] }
    },
    updatedBy: 'admin-uuid'
  }
}
```

## Troubleshooting

### Common Issues
1. **Permission Errors**
   - Invalid scope
   - Missing permission
   - Role conflict
   - Access denied

2. **Assignment Issues**
   - Role not found
   - User not found
   - Invalid tenant
   - Duplicate assignment

### Resolution Steps
1. **Permission Problems**
   - Check role configuration
   - Verify permissions
   - Review scopes
   - Check inheritance

2. **Access Issues**
   - Verify tenant access
   - Check user status
   - Validate tokens
   - Review logs

## API Reference

### List Roles
```http
GET /api/roles
Authorization: Bearer <token>
Query Parameters:
  - page: number
  - limit: number
  - search: string
  - isDefault: boolean
```

### Get Role Details
```http
GET /api/roles/:id
Authorization: Bearer <token>
```

### Create Role
```http
POST /api/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Role Name",
  "description": "Description",
  "scopes": ["scope1", "scope2"],
  "permissions": ["uuid1", "uuid2"]
}
```

### Update Role
```http
PUT /api/roles/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "scopes": ["scope1", "scope2"],
  "permissions": ["uuid1", "uuid2"]
}
```

### Delete Role
```http
DELETE /api/roles/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirm": true
}
```

## Related Documentation
- Access Control Guide
- Permission Management Guide
- Audit Log Guide
- Security Policies
