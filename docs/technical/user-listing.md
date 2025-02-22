# User Listing Process

## Overview
This document details the technical implementation of user listing in the multi-tenant platform, including filtering, pagination, and security measures.

## Process Flow

### 1. List Request
- **Endpoint**: `GET /api/users`
- **Authentication**: Required with users:read scope
- **Query Parameters**:
```json
{
  "query": "search term",
  "status": "active|inactive|suspended",
  "role": "role name",
  "tenant": "tenant-id",
  "lastLoginStart": "2025-01-01",
  "lastLoginEnd": "2025-02-01",
  "page": 1,
  "limit": 20,
  "sortBy": "createdAt",
  "sortOrder": "DESC"
}
```

### 2. Validation Process
1. **Permission Check**
   ```javascript
   const hasPermission = req.user.roles.some(role => 
     role.permissions.includes('users:read')
   );
   ```

2. **Query Validation**
   ```javascript
   const schema = Joi.object({
     query: Joi.string().allow(''),
     status: Joi.string().valid('active', 'inactive', 'suspended'),
     role: Joi.string(),
     tenant: Joi.string().uuid(),
     lastLoginStart: Joi.date().iso(),
     lastLoginEnd: Joi.date().iso().min(Joi.ref('lastLoginStart')),
     page: Joi.number().integer().min(1),
     limit: Joi.number().integer().min(1).max(100),
     sortBy: Joi.string().valid('createdAt', 'email', 'name', 'lastLoginAt'),
     sortOrder: Joi.string().valid('ASC', 'DESC')
   });
   ```

### 3. Query Construction

#### Phase 1: Base Query
```javascript
const where = {};

if (query) {
  where[Op.or] = [
    { email: { [Op.iLike]: `%${query}%` } },
    { name: { [Op.iLike]: `%${query}%` } }
  ];
}

if (status) where.status = status;
if (tenant) where.tenantId = tenant;

if (lastLoginStart || lastLoginEnd) {
  where.lastLoginAt = {};
  if (lastLoginStart) where.lastLoginAt[Op.gte] = new Date(lastLoginStart);
  if (lastLoginEnd) where.lastLoginAt[Op.lte] = new Date(lastLoginEnd);
}
```

#### Phase 2: Include Relations
```javascript
const include = [{
  model: Role,
  where: role ? { name: role } : undefined,
  required: !!role
}, {
  model: Tenant,
  through: { attributes: ['roles'] }
}];
```

### 4. Data Retrieval

#### Database Query
```javascript
const users = await User.findAndCountAll({
  where,
  include,
  order: [[sortBy, sortOrder]],
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  attributes: { 
    exclude: ['password', 'resetToken', 'verificationToken']
  }
});
```

#### Avatar URL Generation
```javascript
const usersWithSignedUrls = await Promise.all(
  users.rows.map(async (user) => {
    const userData = user.toJSON();
    if (userData.avatar) {
      userData.avatarUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: userData.avatar
        }),
        { expiresIn: 24 * 60 * 60 }
      );
    }
    return userData;
  })
);
```

### 5. Response Format
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "status": "active",
      "avatar": "path/to/avatar",
      "avatarUrl": "signed-s3-url",
      "roles": ["admin", "user"],
      "lastLoginAt": "2025-02-22T12:00:00Z",
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
function buildUserQuery(params) {
  const where = {};
  
  // Search filter
  if (params.query) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${params.query}%` } },
      { name: { [Op.iLike]: `%${params.query}%` } }
    ];
  }

  // Status filter
  if (params.status) {
    where.status = params.status;
  }

  // Date range filter
  if (params.lastLoginStart || params.lastLoginEnd) {
    where.lastLoginAt = {};
    if (params.lastLoginStart) {
      where.lastLoginAt[Op.gte] = new Date(params.lastLoginStart);
    }
    if (params.lastLoginEnd) {
      where.lastLoginAt[Op.lte] = new Date(params.lastLoginEnd);
    }
  }

  return {
    where,
    order: [[params.sortBy || 'createdAt', params.sortOrder || 'DESC']],
    limit: parseInt(params.limit) || 20,
    offset: ((parseInt(params.page) || 1) - 1) * (parseInt(params.limit) || 20)
  };
}
```

### Avatar Management
```javascript
async function generateAvatarUrl(avatarKey) {
  if (!avatarKey) return null;
  
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: avatarKey
    }),
    { expiresIn: 24 * 60 * 60 }
  );
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid status value
   - Invalid date range
   - Invalid page number
   - Invalid sort field

2. **Processing Errors**
   - Database connection
   - S3 access
   - Cache issues
   - Permission denied

### Error Responses
```json
{
  "error": "USER_LIST_ERROR",
  "message": "Failed to retrieve users",
  "details": {
    "reason": "Invalid status value"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Query duration
   - S3 operations
   - Response time
   - Cache hits/misses

2. **Business Metrics**
   - Total users
   - Status distribution
   - Role distribution
   - Active users

### Audit Trail
```javascript
{
  event: 'USERS_LISTED',
  severity: 'low',
  details: {
    filters: {
      status: 'string',
      role: 'string',
      query: 'string'
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
   - Filter sensitive data
   - Validate tenant access
   - Rate limiting

2. **Data Protection**
   - Secure URLs
   - Cache management
   - Input validation
   - Output sanitization

### Performance
1. **Query Optimization**
   - Efficient indexing
   - Selective attributes
   - Batch processing
   - Cache strategy

2. **Resource Management**
   - Connection pooling
   - S3 optimization
   - Memory usage
   - Response size

## API Reference

### List Users
```http
GET /api/users?status=active&page=1&limit=20
Authorization: Bearer <token>
```

### Response
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "status": "active",
      "avatarUrl": "signed-url",
      "roles": ["admin"],
      "lastLoginAt": "2025-02-22T12:00:00Z",
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

## Related Documentation
- User Creation Guide
- Role Management Guide
- Pagination Guide
- Security Policies
