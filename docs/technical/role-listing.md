# Role Listing Process

## Overview
This document details the technical implementation of role listing in the multi-tenant platform, including filtering, pagination, and security measures.

## Process Flow

### 1. List Request
- **Endpoint**: `GET /api/roles`
- **Authentication**: Required with roles:read scope
- **Query Parameters**:
```json
{
  "page": 1,
  "limit": 20,
  "sortBy": "name",
  "sortOrder": "ASC",
  "search": "search term",
  "isDefault": true
}
```

### 2. Validation Process
1. **Permission Check**
   ```javascript
   const hasPermission = req.user.roles.some(role => 
     role.permissions.includes('roles:read')
   );
   ```

2. **Query Validation**
   - Valid page number
   - Valid limit (1-100)
   - Valid sort fields
   - Valid sort order

### 3. Query Construction

#### Phase 1: Base Query
```javascript
const where = { tenantId: req.tenant.id };

if (search) {
  where[Op.or] = [
    { name: { [Op.iLike]: `%${search}%` } },
    { description: { [Op.iLike]: `%${search}%` } }
  ];
}

if (isDefault !== undefined) {
  where.isDefault = isDefault === 'true';
}
```

#### Phase 2: Include Relations
```javascript
const include = [{
  model: Permission,
  through: { attributes: [] }
}, {
  model: User,
  attributes: ['id'],
  through: { attributes: [] }
}];
```

### 4. Data Retrieval

#### Database Query
```javascript
const roles = await Role.findAndCountAll({
  where,
  include,
  order: [[sortBy, sortOrder]],
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  distinct: true
});
```

### 5. Response Format
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "Role Name",
      "description": "Role description",
      "scopes": ["users:read", "users:write"],
      "isDefault": false,
      "permissions": [
        {
          "id": "uuid",
          "name": "Permission Name"
        }
      ],
      "userCount": 5,
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

## Implementation Details

### Query Building
```javascript
function buildRoleQuery(params) {
  const where = { tenantId };
  
  // Search filter
  if (params.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { description: { [Op.iLike]: `%${params.search}%` } }
    ];
  }

  // Default role filter
  if (params.isDefault !== undefined) {
    where.isDefault = params.isDefault === 'true';
  }

  return {
    where,
    order: [[params.sortBy || 'name', params.sortOrder || 'ASC']],
    limit: parseInt(params.limit) || 20,
    offset: ((parseInt(params.page) || 1) - 1) * (parseInt(params.limit) || 20)
  };
}
```

### Permission Handling
```javascript
function formatPermissions(permissions) {
  return permissions.map(permission => ({
    id: permission.id,
    name: permission.name,
    description: permission.description
  }));
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid page number
   - Invalid limit
   - Invalid sort field
   - Permission denied

2. **Processing Errors**
   - Database connection
   - Query timeout
   - Cache issues
   - Memory limits

### Error Responses
```json
{
  "error": "ROLE_LIST_ERROR",
  "message": "Failed to retrieve roles",
  "details": {
    "reason": "Invalid sort field"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Query duration
   - Response time
   - Cache hits/misses
   - Result count

2. **Business Metrics**
   - Total roles
   - Default roles
   - User distribution
   - Permission counts

### Audit Trail
```javascript
{
  event: 'ROLES_LISTED',
  severity: 'low',
  details: {
    filters: {
      search: 'string',
      isDefault: boolean
    },
    resultCount: number,
    page: number
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Validate tenant access
   - Filter sensitive data
   - Rate limiting

2. **Data Protection**
   - Cache management
   - Input validation
   - Output sanitization
   - Query limits

### Performance
1. **Query Optimization**
   - Efficient indexing
   - Selective attributes
   - Batch processing
   - Cache strategy

2. **Resource Management**
   - Connection pooling
   - Memory usage
   - Response size
   - Query timeout

## API Reference

### List Roles
```http
GET /api/roles?page=1&limit=20&sortBy=name&sortOrder=ASC
Authorization: Bearer <token>
```

### Response
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "Admin",
      "description": "Administrator role",
      "scopes": ["admin"],
      "permissions": [
        {
          "id": "uuid",
          "name": "Full Access"
        }
      ],
      "userCount": 5,
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

## Related Documentation
- Role Creation Guide
- Permission Management Guide
- Pagination Guide
- Security Policies
