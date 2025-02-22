# Tenant Audit History Process

## Overview
This document details the technical implementation of retrieving audit history for tenants in the multi-tenant platform, including filtering, pagination, and access control.

## Process Flow

### 1. History Request
- **Endpoint**: `GET /api/tenants/:id/audit-history`
- **Authentication**: Required with tenant:audit:read scope
- **Query Parameters**:
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-02-22T00:00:00Z",
  "severity": "high",
  "event": "USER_REMOVED",
  "userId": "uuid",
  "page": 1,
  "limit": 20,
  "sortOrder": "DESC"
}
```

### 2. Access Control

#### Permission Validation
```javascript
const hasAccess = await validateTenantAuditAccess(req.user, tenantId);
if (!hasAccess) {
  throw new AppError('INSUFFICIENT_PERMISSIONS', 403);
}
```

#### Scope Requirements
- Basic history: tenant:audit:read
- Sensitive events: tenant:audit:read:sensitive
- System events: tenant:audit:read:system

### 3. Data Retrieval

#### Query Construction
```javascript
const where = {
  tenantId,
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
  ...(severity && { severity }),
  ...(event && { event }),
  ...(userId && { userId })
};
```

#### Pagination Setup
```javascript
const options = {
  where,
  order: [['createdAt', sortOrder]],
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  include: [{
    model: User,
    attributes: ['email', 'name']
  }]
};
```

### 4. Data Processing

#### Event Categorization
1. **User Events**
   - User added/removed
   - Role changes
   - Permission updates
   - Status changes

2. **Security Events**
   - Policy changes
   - IP restrictions
   - Authentication settings
   - Access controls

3. **Resource Events**
   - Feature changes
   - Quota updates
   - Integration changes
   - Configuration updates

#### Severity Levels
```javascript
const severityLevels = {
  low: ['CONFIG_UPDATED', 'FEATURE_TOGGLED'],
  medium: ['USER_ADDED', 'USER_REMOVED'],
  high: ['SECURITY_POLICY_CHANGED', 'ROLE_DELETED'],
  critical: ['TENANT_SUSPENDED', 'DATA_BREACH']
};
```

### 5. Response Format

#### Audit Entry Structure
```javascript
{
  id: 'uuid',
  event: 'EVENT_TYPE',
  severity: 'high',
  details: {
    // Event-specific details
    userId: 'uuid',
    changes: {
      before: { /* ... */ },
      after: { /* ... */ }
    }
  },
  user: {
    email: 'user@example.com',
    name: 'John Doe'
  },
  createdAt: '2025-02-22T12:00:00Z'
}
```

#### Pagination Info
```javascript
{
  logs: [/* audit entries */],
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
  { fields: ['tenantId', 'createdAt'] },
  { fields: ['event', 'severity'] },
  { fields: ['userId'] }
];

// Efficient querying
const queryOptions = {
  ...options,
  separate: true,
  attributes: {
    include: [
      [
        sequelize.literal(`
          CASE 
            WHEN severity = 'critical' OR
                 (event LIKE 'SECURITY_%' AND severity = 'high')
            THEN true 
            ELSE false 
          END
        `),
        'requiresAttention'
      ]
    ]
  }
};
```

### Cache Management
```javascript
const cacheKey = `tenant:${tenantId}:audit:${startDate}:${endDate}:${page}`;
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
   - Unknown event type
   - Invalid severity
   - Bad pagination

2. **Access Errors**
   - Insufficient permissions
   - Invalid tenant
   - Rate limiting
   - Expired session

### Error Responses
```javascript
{
  error: 'TENANT_AUDIT_ACCESS_DENIED',
  message: 'Insufficient permissions to view tenant audit history',
  details: {
    requiredScope: 'tenant:audit:read',
    providedScope: 'tenant:read'
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
  event: 'TENANT_AUDIT_HISTORY_ACCESSED',
  details: {
    tenantId,
    filters: {
      startDate,
      endDate,
      severity,
      event,
      userId
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
   - Mask sensitive data
   - Respect privacy settings
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

### Get Tenant Audit History
```http
GET /api/tenants/:id/audit-history
Authorization: Bearer <token>
```

### Query Parameters
```typescript
interface TenantAuditHistoryParams {
  startDate?: string;    // ISO date
  endDate?: string;      // ISO date
  severity?: 'low' | 'medium' | 'high' | 'critical';
  event?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}
```

### Response
```json
{
  "logs": [
    {
      "id": "uuid",
      "event": "USER_REMOVED",
      "severity": "medium",
      "details": {
        "userId": "uuid",
        "roles": ["admin"],
        "removedBy": "uuid"
      },
      "user": {
        "email": "user@example.com",
        "name": "John Doe"
      },
      "createdAt": "2025-02-22T12:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

## Related Documentation
- [Access Control Guide](../technical/access-control-guide.md)
- [Data Retention Policies](../technical/data-retention-policies.md)
- [Security Policies](../security-policies.md)
