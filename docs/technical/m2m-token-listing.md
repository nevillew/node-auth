# Machine-to-Machine Token Listing Process

## Overview
This document details the technical implementation of listing machine-to-machine (M2M) tokens in the multi-tenant platform, including filtering, pagination, and security measures.

## Process Flow

### 1. List Request
- **Endpoint**: `GET /auth/m2m/tokens`
- **Authentication**: Required with admin scope
- **Query Parameters**:
```json
{
  "clientId": "optional_client_id",
  "active": true,
  "page": 1,
  "limit": 20
}
```

### 2. Validation Process
1. **Permission Check**
   ```javascript
   const hasPermission = req.user.roles.some(role => 
     role.permissions.includes('tokens:read')
   );
   ```

2. **Query Validation**
   - Valid client ID
   - Valid page number
   - Valid limit range
   - Active status boolean

### 3. Query Construction

#### Phase 1: Base Query
```javascript
const where = { 
  type: 'm2m',
  revoked: !active
};

if (clientId) {
  where['$OAuthClient.clientId$'] = clientId;
}
```

#### Phase 2: Include Relations
```javascript
const include = [{
  model: OAuthClient,
  attributes: ['clientId', 'name']
}];
```

### 4. Data Retrieval

#### Database Query
```javascript
const tokens = await OAuthToken.findAll({
  where,
  include,
  attributes: [
    'id',
    'accessToken',
    'createdAt',
    'expiresAt',
    'tenantId',
    'scopes'
  ],
  order: [['createdAt', 'DESC']],
  limit: parseInt(limit),
  offset: (page - 1) * limit
});
```

### 5. Response Format
```json
{
  "tokens": [
    {
      "id": "uuid",
      "clientId": "client_id",
      "clientName": "Client Name",
      "tenantId": "tenant_uuid",
      "scopes": ["read:users", "write:data"],
      "createdAt": "2025-02-22T12:00:00Z",
      "expiresAt": "2025-02-22T13:00:00Z",
      "active": true
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
function buildTokenQuery(params) {
  const where = { type: 'm2m' };
  
  if (params.active !== undefined) {
    where.revoked = !params.active;
  }

  if (params.clientId) {
    where['$OAuthClient.clientId$'] = params.clientId;
  }

  return {
    where,
    order: [['createdAt', 'DESC']],
    limit: parseInt(params.limit) || 20,
    offset: ((parseInt(params.page) || 1) - 1) * (parseInt(params.limit) || 20)
  };
}
```

### Token Status Check
```javascript
function isTokenActive(token) {
  return new Date() < new Date(token.expiresAt) && !token.revoked;
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid client ID
   - Invalid page number
   - Invalid limit
   - Permission denied

2. **Processing Errors**
   - Database connection
   - Query timeout
   - Cache issues
   - Memory limits

### Error Responses
```json
{
  "error": "TOKEN_LIST_ERROR",
  "message": "Failed to retrieve tokens",
  "details": {
    "reason": "Invalid client ID"
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
   - Active tokens
   - Token distribution
   - Client usage
   - Expiry patterns

### Audit Trail
```javascript
{
  event: 'M2M_TOKENS_LISTED',
  severity: 'low',
  details: {
    filters: {
      clientId: 'string',
      active: boolean
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
   - Mask token values
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
   - Memory usage
   - Response size
   - Query timeout

## API Reference

### List M2M Tokens
```http
GET /auth/m2m/tokens?clientId=client_id&active=true&page=1&limit=20
Authorization: Bearer <token>
```

### Response
```json
{
  "tokens": [
    {
      "id": "uuid",
      "clientId": "client_id",
      "clientName": "API Client",
      "tenantId": "tenant_uuid",
      "scopes": ["read:users"],
      "createdAt": "2025-02-22T12:00:00Z",
      "expiresAt": "2025-02-22T13:00:00Z",
      "active": true
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

## Related Documentation
- M2M Token Creation Guide
- Token Revocation Guide
- Audit Log Guide
- Security Policies
