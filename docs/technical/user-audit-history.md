# User Audit History Process

## Overview
This document details the technical implementation of retrieving audit history for users in the multi-tenant platform, including filtering, pagination, and access control.

## Process Flow

### 1. History Request
- **Endpoint**: `GET /api/users/:id/audit-history`
- **Authentication**: Required with audit:read scope
- **Query Parameters**:
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-02-22T00:00:00Z",
  "severity": "high",
  "event": "LOGIN_FAILED",
  "page": 1,
  "limit": 20,
  "sortOrder": "DESC"
}
```

### 2. Access Control

#### Permission Validation
```javascript
const hasAccess = await validateAuditAccess(req.user, userId);
if (!hasAccess) {
  throw new AppError('INSUFFICIENT_PERMISSIONS', 403);
}
```

#### Scope Requirements
- Basic history: audit:read
- Sensitive events: audit:read:sensitive
- System events: audit:read:system

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
  ...(severity && { severity }),
  ...(event && { event })
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
1. **Authentication Events**
   - Login attempts
   - Password changes
   - 2FA operations
   - Session management

2. **Security Events**
   - Permission changes
   - Role updates
   - IP restrictions
   - Security settings

3. **Resource Events**
   - Profile updates
   - File operations
   - Settings changes
   - Preference updates

#### Severity Levels
```javascript
const severityLevels = {
  low: ['PROFILE_UPDATED', 'PREFERENCES_CHANGED'],
  medium: ['PASSWORD_CHANGED', 'ROLE_UPDATED'],
  high: ['LOGIN_FAILED', 'PERMISSION_CHANGED'],
  critical: ['SECURITY_BREACH', 'ACCOUNT_COMPROMISED']
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
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    changes: {
      before: { /* ... */ },
      after: { /* ... */ }
    }
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
  { fields: ['userId', 'createdAt'] },
  { fields: ['event', 'severity'] },
  { fields: ['createdAt'] }
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
            WHEN event = 'LOGIN_FAILED' AND severity = 'high' 
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
const cacheKey = `audit:${userId}:${startDate}:${endDate}:${page}`;
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
   - Cross-tenant access
   - Rate limiting
   - Expired session

### Error Responses
```javascript
{
  error: 'AUDIT_ACCESS_DENIED',
  message: 'Insufficient permissions to view audit history',
  details: {
    requiredScope: 'audit:read',
    providedScope: 'user:read'
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
  event: 'AUDIT_HISTORY_ACCESSED',
  details: {
    targetUserId: userId,
    filters: {
      startDate,
      endDate,
      severity,
      event
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

### Get Audit History
```http
GET /api/users/:id/audit-history
Authorization: Bearer <token>
```

### Query Parameters
```typescript
interface AuditHistoryParams {
  startDate?: string;    // ISO date
  endDate?: string;      // ISO date
  severity?: 'low' | 'medium' | 'high' | 'critical';
  event?: string;
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
      "event": "LOGIN_FAILED",
      "severity": "high",
      "details": {
        "ipAddress": "192.168.1.1",
        "reason": "Invalid password"
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
- Security Audit Guide
- Access Control Guide
- Performance Optimization
- Data Retention Policies
