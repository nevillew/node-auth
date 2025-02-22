# Tenant Listing Process

## Overview
This document details the technical implementation of listing tenants in the multi-tenant platform, including filtering, pagination, and security measures.

## Process Flow

### 1. List Request
- **Endpoint**: `GET /api/tenants`
- **Authentication**: Required with admin scope
- **Query Parameters**:
```json
{
  "status": "active|suspended|pending_deletion",
  "search": "search term",
  "page": 1,
  "limit": 20,
  "sortBy": "name",
  "sortOrder": "ASC"
}
```

### 2. Validation Process
1. **Permission Check**
   ```javascript
   const hasPermission = req.user.roles.some(role => 
     role.permissions.includes('tenants:read')
   );
   ```

2. **Query Validation**
   - Valid status values
   - Page number > 0
   - Limit between 1-100
   - Valid sort fields
   - Valid sort order

### 3. Query Construction

#### Phase 1: Base Query
```javascript
const where = {};

if (status) {
  where.status = status;
}

if (search) {
  where[Op.or] = [
    { name: { [Op.iLike]: `%${search}%` } },
    { slug: { [Op.iLike]: `%${search}%` } }
  ];
}
```

#### Phase 2: Pagination & Sorting
```javascript
const options = {
  where,
  order: [[sortBy, sortOrder]],
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  attributes: [
    'id', 
    'name',
    'slug',
    'status',
    'logo',
    'onboardingStatus',
    'createdAt'
  ]
};
```

### 4. Data Retrieval

#### Database Query
```javascript
const tenants = await Tenant.findAndCountAll(options);
```

#### Logo URL Generation
```javascript
const tenantsWithSignedUrls = await Promise.all(
  tenants.rows.map(async (tenant) => {
    const tenantData = tenant.toJSON();
    if (tenantData.logo) {
      tenantData.logoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: tenantData.logo
        }),
        { expiresIn: 24 * 60 * 60 }
      );
    }
    return tenantData;
  })
);
```

### 5. Response Format
```json
{
  "tenants": [
    {
      "id": "uuid",
      "name": "Tenant Name",
      "slug": "tenant-slug",
      "status": "active",
      "logo": "path/to/logo",
      "logoUrl": "signed-s3-url",
      "onboardingStatus": "completed",
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
function buildTenantQuery(params) {
  const where = {};
  
  // Status filter
  if (params.status) {
    where.status = params.status;
  }

  // Search filter
  if (params.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { slug: { [Op.iLike]: `%${params.search}%` } }
    ];
  }

  return {
    where,
    order: [[params.sortBy || 'name', params.sortOrder || 'ASC']],
    limit: parseInt(params.limit) || 20,
    offset: ((parseInt(params.page) || 1) - 1) * (parseInt(params.limit) || 20)
  };
}
```

### Logo URL Management
```javascript
async function generateLogoUrl(logoKey) {
  if (!logoKey) return null;
  
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: logoKey
    }),
    { expiresIn: 24 * 60 * 60 }
  );
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid status
   - Invalid page number
   - Invalid limit
   - Invalid sort field

2. **Processing Errors**
   - Database connection
   - S3 access
   - Cache issues
   - Permission denied

### Error Responses
```json
{
  "error": "TENANT_LIST_ERROR",
  "message": "Failed to retrieve tenants",
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
   - Total tenants
   - Status distribution
   - Creation rate
   - Active tenants

### Audit Trail
```javascript
{
  event: 'TENANTS_LISTED',
  severity: 'low',
  details: {
    filters: {
      status: 'string',
      search: 'string'
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

### List Tenants
```http
GET /api/tenants?status=active&page=1&limit=20
Authorization: Bearer <token>
```

### Response
```json
{
  "tenants": [
    {
      "id": "uuid",
      "name": "Tenant Name",
      "slug": "tenant-slug",
      "status": "active",
      "logoUrl": "signed-url",
      "onboardingStatus": "completed",
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

## Related Documentation
- Tenant Creation Guide
- Logo Management Guide
- Pagination Guide
- Security Policies
