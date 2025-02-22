# User Login History Process

## Overview
This document details the technical implementation of retrieving login history for users in the multi-tenant platform, including filtering, pagination, and access control.

## Process Flow

### 1. History Request
- **Endpoint**: `GET /api/users/:id/login-history`
- **Authentication**: Required with users:activity:read scope
- **Query Parameters**:
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-02-22T00:00:00Z",
  "status": "success",
  "ipAddress": "192.168.1.1",
  "page": 1,
  "limit": 20,
  "sortOrder": "DESC"
}
```

### 2. Access Control

#### Permission Validation
```javascript
const hasAccess = await validateActivityAccess(req.user, userId);
if (!hasAccess) {
  throw new AppError('INSUFFICIENT_PERMISSIONS', 403);
}
```

#### Scope Requirements
- Basic history: users:activity:read
- Sensitive details: users:activity:read:sensitive
- IP information: users:activity:read:ip

### 3. Data Retrieval

#### Query Construction
```javascript
const where = {
  userId,
  ...(startDate && {
    createdAt: {
      [Op.gte]: new Date(startDate)
    }
  }),
  ...(endDate && {
    createdAt: {
      [Op.lte]: new Date(endDate)
    }
  }),
  ...(status && { status }),
  ...(ipAddress && { ipAddress })
};
```

#### Pagination Setup
```javascript
const options = {
  where,
  order: [['createdAt', sortOrder]],
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  attributes: [
    'id',
    'ipAddress',
    'userAgent',
    'location',
    'status',
    'failureReason',
    'createdAt'
  ]
};
```

### 4. Data Processing

#### Event Types
1. **Success Events**
   - Normal login
   - 2FA verification
   - Passkey authentication
   - OAuth login

2. **Failure Events**
   - Invalid password
   - Failed 2FA
   - Invalid token
   - Account locked

3. **Location Data**
   - IP address
   - Geographic location
   - ISP information
   - Device details

### 5. Response Format

#### Login Entry Structure
```javascript
{
  id: 'uuid',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  location: {
    country: 'US',
    city: 'New York',
    coordinates: [-73.935242, 40.730610]
  },
  status: 'success',
  createdAt: '2025-02-22T12:00:00Z'
}
```

#### Pagination Info
```javascript
{
  history: [/* login entries */],
  total: 150,
  page: 1,
  totalPages: 8,
  hasMore: true
}
```

## Implementation Details

### Query Optimization
```javascript
// Index usage
const indexes = [
  { fields: ['userId', 'createdAt'] },
  { fields: ['status', 'ipAddress'] },
  { fields: ['createdAt'] }
];

// Efficient querying
const queryOptions = {
  ...options,
  include: [{
    model: User,
    attributes: ['email', 'name']
  }]
};
```

### Cache Management
```javascript
const cacheKey = `login-history:${userId}:${startDate}:${endDate}:${page}`;
const cacheTTL = 300; // 5 minutes

// Get from cache or database
const results = await redisClient.get(cacheKey) || 
  await fetchFromDatabase(options);

// Update cache
await redisClient.set(cacheKey, results, 'EX', cacheTTL);
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid date range
   - Unknown status
   - Invalid IP format
   - Bad pagination

2. **Access Errors**
   - Insufficient permissions
   - Cross-tenant access
   - Rate limiting
   - Expired session

### Error Responses
```javascript
{
  error: 'LOGIN_HISTORY_ACCESS_DENIED',
  message: 'Insufficient permissions to view login history',
  details: {
    requiredScope: 'users:activity:read',
    providedScope: 'users:read'
  }
}
```

## Monitoring & Logging

### Performance Metrics
1. **Query Performance**
   - Response time
   - Cache hit rate
   - Query complexity
   - Result size

2. **Usage Metrics**
   - Access frequency
   - Popular filters
   - Export requests
   - Error rates

### Access Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'LOGIN_HISTORY_ACCESSED',
  details: {
    targetUserId: userId,
    filters: {
      startDate,
      endDate,
      status,
      ipAddress
    }
  },
  severity: 'low'
});
```

## Best Practices

### Security
1. **Access Control**
   - Validate permissions
   - Check tenant context
   - Rate limit requests
   - Log access attempts

2. **Data Protection**
   - Mask IP addresses
   - Limit location precision
   - Follow retention policy
   - Secure transmission

### Performance
1. **Query Optimization**
   - Use proper indexes
   - Implement caching
   - Paginate results
   - Limit response size

2. **Resource Management**
   - Connection pooling
   - Cache management
   - Background processing
   - Rate limiting

## API Reference

### Get Login History
```http
GET /api/users/:id/login-history
Authorization: Bearer <token>
```

### Query Parameters
```typescript
interface LoginHistoryParams {
  startDate?: string;    // ISO date
  endDate?: string;      // ISO date
  status?: 'success' | 'failed';
  ipAddress?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}
```

### Response
```json
{
  "history": [
    {
      "id": "uuid",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "location": {
        "country": "US",
        "city": "New York"
      },
      "status": "success",
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

## Related Documentation
- User Management Guide
- Security Policies
- Data Privacy Guide
- Access Control Guide
