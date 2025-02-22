# Tenant IP Restrictions

## Overview
This document details the technical implementation of IP address restrictions for tenant access in the multi-tenant platform.

## Process Flow

### 1. Configuration Request
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
   - Valid IP addresses
   - Valid CIDR ranges
   - Non-overlapping ranges
   - Unique entries

2. **Security Checks**
   ```javascript
   // Validate IP format
   if (!isValidIP(ip)) {
     throw new Error(`Invalid IP address: ${ip}`);
   }

   // Validate CIDR range
   if (!isValidCIDR(range)) {
     throw new Error(`Invalid CIDR range: ${range}`);
   }
   ```

### 3. Implementation

#### Phase 1: Database Update
```javascript
await tenant.update({
  securityPolicy: {
    ...tenant.securityPolicy,
    ipRestrictions: {
      enabled: true,
      allowedIPs,
      allowedRanges,
      blockList
    }
  }
});
```

#### Phase 2: Access Control
1. **Request Validation**
   ```javascript
   const clientIP = req.ip;
   const { allowedIPs, allowedRanges, blockList } = 
     tenant.securityPolicy.ipRestrictions;

   // Check block list first
   if (blockList.includes(clientIP)) {
     throw new Error('IP address is blocked');
   }

   // Check if IP is allowed
   const isAllowed = allowedIPs.includes(clientIP) || 
     allowedRanges.some(range => isIPInRange(clientIP, range));

   if (!isAllowed) {
     throw new Error('IP address not allowed');
   }
   ```

2. **Security Measures**
   - Block listed IPs
   - Validate allowed ranges
   - Log access attempts
   - Monitor patterns

### 4. Notification System

#### Email Notifications
1. **Access Denied**
   ```javascript
   await emailService.sendEmail({
     to: admin.email,
     subject: 'IP Access Denied',
     template: 'ip-access-denied',
     context: {
       name: admin.name,
       tenantName: tenant.name,
       ipAddress: clientIP,
       timestamp: new Date()
     }
   });
   ```

2. **New IP Detection**
   ```javascript
   await emailService.sendEmail({
     to: admin.email,
     subject: 'New IP Access Detected',
     template: 'new-ip-detected',
     context: {
       name: admin.name,
       tenantName: tenant.name,
       ipAddress: clientIP,
       location: geoLocation,
       timestamp: new Date()
     }
   });
   ```

#### Audit Trail
```javascript
await SecurityAuditLog.create({
  userId: req.user?.id,
  event: 'IP_ACCESS_DENIED',
  details: {
    ip: clientIP,
    tenantId,
    reason: 'IP not in allowed list'
  },
  severity: 'medium'
});
```

## Implementation Details

### IP Validation
```javascript
function isValidIP(ip) {
  try {
    ipaddr.parse(ip);
    return true;
  } catch (error) {
    return false;
  }
}

function isValidCIDR(range) {
  try {
    ipaddr.parseCIDR(range);
    return true;
  } catch (error) {
    return false;
  }
}
```

### Range Checking
```javascript
function isIPInRange(ip, range) {
  const addr = ipaddr.parse(ip);
  const [rangeAddr, bits] = ipaddr.parseCIDR(range);
  return addr.match(rangeAddr, bits);
}
```

### Cache Management
```javascript
// Cache successful IP checks
const cacheKey = `ip:${clientIP}:tenant:${tenantId}`;
await redisClient.set(cacheKey, '1', { EX: 86400 }); // 24 hours
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid IP format
   - Invalid CIDR range
   - Overlapping ranges
   - Configuration errors

2. **Access Errors**
   - IP not allowed
   - IP blocked
   - Cache failure
   - Validation error

### Error Responses
```json
{
  "error": "IP_ACCESS_DENIED",
  "message": "IP address not allowed",
  "details": {
    "ip": "1.2.3.4",
    "tenant": "tenant-id"
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Access Metrics**
   - Denied attempts
   - New IPs
   - Cache hits
   - Response time

2. **Security Metrics**
   - Block rate
   - Allow rate
   - Pattern detection
   - Geographic data

### Audit Trail
```javascript
{
  event: 'IP_RESTRICTION_UPDATED',
  severity: 'high',
  details: {
    tenantId: 'uuid',
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
1. **IP Management**
   - Regular review
   - Audit changes
   - Monitor patterns
   - Geographic analysis

2. **Access Control**
   - Default deny
   - Explicit allows
   - Block malicious
   - Log all changes

### Performance
1. **Optimization**
   - Cache results
   - Batch updates
   - Quick lookups
   - Efficient storage

2. **Resource Management**
   - Cache TTL
   - Log rotation
   - Metric aggregation
   - Pattern analysis

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
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Tenant Security Guide
- Access Control Guide
- Audit Log Guide
- Network Security
