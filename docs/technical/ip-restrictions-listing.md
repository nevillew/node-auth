# IP Restrictions Listing Process

## Overview
This document details the technical implementation of listing IP address restrictions for tenant access in the multi-tenant platform.

## Process Flow

### 1. List Request
- **Endpoint**: `GET /api/tenants/:id/ip-restrictions`
- **Authentication**: Required with admin scope
- **Response Format**:
```json
{
  "enabled": true,
  "allowedIPs": ["192.168.1.0/24"],
  "allowedRanges": ["10.0.0.0/8"],
  "blockList": ["1.2.3.4"]
}
```

### 2. Validation Process
1. **Permission Check**
   ```javascript
   const hasPermission = req.user.roles.some(role => 
     role.permissions.includes('tenants:read')
   );
   ```

2. **Tenant Validation**
   - Verify tenant exists
   - Check admin access
   - Validate tenant status
   - Verify read permissions

### 3. Data Retrieval

#### Phase 1: Database Query
```javascript
const tenant = await Tenant.findByPk(req.params.id);

if (!tenant) {
  throw new AppError('Tenant not found', 404);
}

const ipRestrictions = tenant.securityPolicy?.ipRestrictions || {
  enabled: false,
  allowedIPs: [],
  allowedRanges: [],
  blockList: []
};
```

#### Phase 2: Cache Management
```javascript
// Cache IP restrictions for future requests
const cacheKey = `tenant:${tenantId}:ip-restrictions`;
await redisClient.set(
  cacheKey,
  JSON.stringify(ipRestrictions),
  { EX: 3600 } // 1 hour cache
);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'IP_RESTRICTIONS_VIEWED',
  details: {
    tenantId: tenant.id,
    ipAddress: req.ip
  },
  severity: 'low'
});
```

#### Access Control
1. **Permission Validation**
   - Verify read access
   - Check tenant membership
   - Validate scope access
   - Monitor patterns

2. **Rate Limiting**
   - Track request frequency
   - Implement cooldown
   - Monitor abuse
   - Alert on threshold

## Implementation Details

### Cache Strategy
```javascript
async function getIPRestrictions(tenantId) {
  const cacheKey = `tenant:${tenantId}:ip-restrictions`;
  
  // Try cache first
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database if not cached
  const tenant = await Tenant.findByPk(tenantId);
  const restrictions = tenant.securityPolicy?.ipRestrictions || {
    enabled: false,
    allowedIPs: [],
    allowedRanges: [],
    blockList: []
  };

  // Cache for future requests
  await redisClient.set(
    cacheKey,
    JSON.stringify(restrictions),
    { EX: 3600 }
  );

  return restrictions;
}
```

### Response Formatting
```javascript
function formatIPRestrictions(restrictions) {
  return {
    enabled: restrictions.enabled || false,
    allowedIPs: restrictions.allowedIPs || [],
    allowedRanges: restrictions.allowedRanges || [],
    blockList: restrictions.blockList || []
  };
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Tenant not found
   - Permission denied
   - Invalid tenant ID
   - Cache failure

2. **Processing Errors**
   - Database connection
   - Cache retrieval
   - Format error
   - Timeout

### Error Responses
```json
{
  "error": "IP_RESTRICTIONS_ERROR",
  "message": "Failed to retrieve IP restrictions",
  "details": {
    "reason": "Tenant not found"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Response time
   - Cache hit rate
   - Database latency
   - Error frequency

2. **Security Metrics**
   - Access patterns
   - Error rates
   - Cache efficiency
   - Request volume

### Audit Trail
```javascript
{
  event: 'IP_RESTRICTIONS_VIEWED',
  severity: 'low',
  details: {
    tenantId: 'uuid',
    ipAddress: 'string',
    cacheHit: boolean,
    responseTime: 'number'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify permissions
   - Validate tenant access
   - Monitor patterns
   - Rate limit requests

2. **Data Protection**
   - Cache management
   - Input validation
   - Output sanitization
   - Error handling

### Performance
1. **Cache Strategy**
   - Implement caching
   - Set TTL
   - Handle invalidation
   - Monitor hit rate

2. **Resource Management**
   - Connection pooling
   - Query optimization
   - Memory usage
   - Response size

## API Reference

### List IP Restrictions
```http
GET /api/tenants/:id/ip-restrictions
Authorization: Bearer <token>
```

### Response
```json
{
  "enabled": true,
  "allowedIPs": ["192.168.1.0/24"],
  "allowedRanges": ["10.0.0.0/8"],
  "blockList": ["1.2.3.4"]
}
```

## Related Documentation
- IP Restrictions Setup Guide
- IP Restrictions Update Guide
- Tenant Security Guide
- Access Control Guide
