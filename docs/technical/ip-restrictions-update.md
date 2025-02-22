# Tenant IP Restrictions Update Process

## Overview
This document details the technical implementation of updating IP address restrictions for tenant access in the multi-tenant platform.

## Process Flow

### 1. Update Request
- **Endpoint**: `PUT /api/tenants/:id/ip-restrictions`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "ipRestrictions": {
    "enabled": true,
    "allowedIPs": ["192.168.1.0/24"],
    "allowedRanges": ["10.0.0.0/8"],
    "blockList": ["1.2.3.4"]
  }
}
```

### 2. Validation Process
1. **Input Validation**
   ```javascript
   const schema = Joi.object({
     ipRestrictions: Joi.object({
       enabled: Joi.boolean().required(),
       allowedIPs: Joi.array().items(Joi.string()).unique(),
       allowedRanges: Joi.array().items(Joi.string()).unique(),
       blockList: Joi.array().items(Joi.string()).unique()
     }).required()
   });
   ```

2. **IP Format Validation**
   - Validate individual IP addresses
   - Validate CIDR ranges
   - Check for overlaps
   - Verify uniqueness

### 3. Update Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Get current config
  const tenant = await Tenant.findByPk(tenantId, { transaction: t });
  
  // Update IP restrictions
  await tenant.update({
    securityPolicy: {
      ...tenant.securityPolicy,
      ipRestrictions: {
        enabled,
        allowedIPs,
        allowedRanges,
        blockList
      }
    }
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Cache Management
```javascript
// Clear tenant config cache
await redisClient.del(`tenant:${tenantId}:config`);
await redisClient.del(`tenant:${tenantId}:ip-restrictions`);
```

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'IP_RESTRICTIONS_UPDATED',
  details: {
    tenantId,
    changes: {
      before: currentRestrictions,
      after: newRestrictions
    }
  },
  severity: 'high'
});
```

#### Active Session Management
1. **Session Validation**
   - Check active sessions
   - Validate IP addresses
   - Revoke invalid sessions
   - Update session store

2. **Connection Management**
   - Monitor active connections
   - Track connection attempts
   - Log blocked requests
   - Update metrics

### 5. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: adminEmail,
  subject: 'IP Restrictions Updated',
  template: 'ip-restrictions-updated',
  context: {
    tenantName: tenant.name,
    updatedBy: admin.name,
    changes: {
      allowedIPs: {
        added: addedIPs,
        removed: removedIPs
      },
      allowedRanges: {
        added: addedRanges,
        removed: removedRanges
      },
      blockList: {
        added: addedBlocks,
        removed: removedBlocks
      }
    },
    timestamp: new Date()
  }
});
```

## Implementation Details

### IP Validation Functions
```javascript
function validateIPAddress(ip) {
  try {
    const addr = ipaddr.parse(ip);
    return addr.kind() === 'ipv4' || addr.kind() === 'ipv6';
  } catch (error) {
    return false;
  }
}

function validateCIDRRange(range) {
  try {
    const [addr, bits] = ipaddr.parseCIDR(range);
    return true;
  } catch (error) {
    return false;
  }
}
```

### Overlap Detection
```javascript
function detectOverlaps(ranges) {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (doRangesOverlap(ranges[i], ranges[j])) {
        return true;
      }
    }
  }
  return false;
}
```

### Cache Management
```javascript
async function updateIPCache(tenantId, restrictions) {
  const cacheKey = `tenant:${tenantId}:ip-restrictions`;
  await redisClient.set(cacheKey, JSON.stringify(restrictions), {
    EX: 3600 // 1 hour cache
  });
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid IP format
   - Invalid CIDR range
   - Range overlaps
   - Duplicate entries

2. **Processing Errors**
   - Database failure
   - Cache error
   - Session error
   - Notification failure

### Error Responses
```json
{
  "error": "IP_VALIDATION_ERROR",
  "message": "Invalid IP address format",
  "details": {
    "invalidIPs": ["1.2.3.256"]
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Update duration
   - Cache operations
   - Database latency
   - Session updates

2. **Security Metrics**
   - Blocked attempts
   - Access patterns
   - Session revocations
   - Error rates

### Audit Trail
```javascript
{
  event: 'IP_RESTRICTIONS_UPDATED',
  severity: 'high',
  details: {
    tenantId: 'uuid',
    adminId: 'uuid',
    changes: {
      allowedIPs: ['added', 'removed'],
      allowedRanges: ['added', 'removed'],
      blockList: ['added', 'removed']
    }
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify admin rights
   - Validate changes
   - Log all updates
   - Monitor patterns

2. **Data Protection**
   - Validate input
   - Prevent overlaps
   - Secure storage
   - Audit changes

### Performance
1. **Resource Management**
   - Cache updates
   - Connection pooling
   - Session handling
   - Queue notifications

2. **Optimization**
   - Batch updates
   - Efficient validation
   - Quick lookups
   - Smart caching

## API Reference

### Update IP Restrictions
```http
PUT /api/tenants/:id/ip-restrictions
Authorization: Bearer <token>
Content-Type: application/json

{
  "ipRestrictions": {
    "enabled": true,
    "allowedIPs": ["192.168.1.0/24"],
    "allowedRanges": ["10.0.0.0/8"],
    "blockList": ["1.2.3.4"]
  }
}
```

### Response
```json
{
  "message": "IP restrictions updated successfully",
  "updatedAt": "2025-02-22T12:00:00Z",
  "changes": {
    "allowedIPs": {
      "added": ["192.168.1.0/24"],
      "removed": []
    },
    "allowedRanges": {
      "added": ["10.0.0.0/8"],
      "removed": []
    },
    "blockList": {
      "added": ["1.2.3.4"],
      "removed": []
    }
  }
}
```

## Related Documentation
- Tenant Security Guide
- Access Control Guide
- Audit Log Guide
- Network Security
