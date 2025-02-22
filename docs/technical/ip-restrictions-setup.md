# IP Restrictions Setup Guide

## Overview
This document details the technical implementation of IP restrictions in the multi-tenant platform, including configuration, validation, and monitoring processes.

## Process Flow

### 1. Configuration Request
- **Endpoint**: `PUT /api/tenants/:id/security/ip-restrictions`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "enabled": true,
  "allowedIPs": ["192.168.1.0/24"],
  "allowedRanges": ["10.0.0.0/8"],
  "blockList": ["1.2.3.4"]
}
```

### 2. Validation Process

#### IP Format Validation
```javascript
function validateIPConfig(config) {
  const { allowedIPs, allowedRanges, blockList } = config;
  
  // Validate individual IPs
  if (!allowedIPs.every(ip => isValidIP(ip))) {
    throw new Error('Invalid IP address format');
  }

  // Validate CIDR ranges
  if (!allowedRanges.every(range => isValidCIDR(range))) {
    throw new Error('Invalid CIDR range format');
  }

  // Validate blocklist
  if (!blockList.every(ip => isValidIP(ip))) {
    throw new Error('Invalid blocklist IP format');
  }
}
```

#### Conflict Detection
```javascript
function detectConflicts(config) {
  const { allowedIPs, allowedRanges, blockList } = config;
  
  // Check for IPs in both allow and block lists
  const conflicts = allowedIPs.filter(ip => 
    blockList.includes(ip)
  );

  // Check for IPs in blocked ranges
  const rangeConflicts = allowedIPs.filter(ip =>
    allowedRanges.some(range => isIPInRange(ip, range))
  );

  return [...conflicts, ...rangeConflicts];
}
```

### 3. Implementation

#### Database Updates
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

#### Cache Management
```javascript
// Cache IP configuration for quick access
const cacheKey = `tenant:${tenantId}:ip-restrictions`;
await redisClient.set(
  cacheKey,
  JSON.stringify(ipConfig),
  'EX',
  3600
);
```

### 4. Access Control

#### Request Validation
```javascript
function validateIPAccess(clientIP, config) {
  // Check block list first
  if (config.blockList.includes(clientIP)) {
    return {
      allowed: false,
      reason: 'IP is blocked'
    };
  }

  // Check explicit allows
  if (config.allowedIPs.includes(clientIP)) {
    return {
      allowed: true
    };
  }

  // Check ranges
  const inRange = config.allowedRanges.some(range =>
    isIPInRange(clientIP, range)
  );

  return {
    allowed: inRange,
    reason: inRange ? null : 'IP not in allowed ranges'
  };
}
```

#### Middleware Implementation
```javascript
const ipRestrictionMiddleware = async (req, res, next) => {
  const clientIP = req.ip;
  const config = await getIPConfig(req.tenant.id);
  
  if (!config.enabled) {
    return next();
  }

  const { allowed, reason } = validateIPAccess(clientIP, config);
  
  if (!allowed) {
    await SecurityAuditLog.create({
      event: 'IP_ACCESS_DENIED',
      severity: 'medium',
      details: {
        ip: clientIP,
        reason
      }
    });
    
    return res.status(403).json({
      error: 'IP access denied',
      reason
    });
  }

  next();
};
```

### 5. Monitoring & Notifications

#### Access Logging
```javascript
async function logIPAccess(clientIP, tenantId, allowed) {
  await SecurityAuditLog.create({
    event: allowed ? 'IP_ACCESS_ALLOWED' : 'IP_ACCESS_DENIED',
    severity: allowed ? 'low' : 'medium',
    details: {
      ip: clientIP,
      tenantId,
      timestamp: new Date()
    }
  });
}
```

#### Notifications
```javascript
// New IP detection
async function notifyNewIPAccess(ip, tenant, user) {
  await emailService.sendEmail({
    to: tenant.adminEmail,
    template: 'new-ip-detected',
    context: {
      ip,
      tenant: tenant.name,
      user: user?.email,
      timestamp: new Date()
    }
  });
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid IP format
   - Invalid CIDR range
   - Configuration conflicts
   - Missing required fields

2. **Access Errors**
   - IP not allowed
   - Range not matched
   - Blocked IP
   - Configuration error

### Error Responses
```javascript
{
  error: 'IP_ACCESS_DENIED',
  message: 'Access from this IP is not allowed',
  details: {
    ip: '192.168.1.1',
    reason: 'IP not in allowed ranges'
  }
}
```

## Best Practices

### Security
1. **Configuration**
   - Use specific ranges
   - Regular review
   - Audit changes
   - Monitor access

2. **Implementation**
   - Quick validation
   - Efficient caching
   - Proper logging
   - Clear errors

### Performance
1. **Optimization**
   - Cache configs
   - Efficient checks
   - Quick lookups
   - Minimal overhead

2. **Resource Usage**
   - Memory efficient
   - CPU efficient
   - Network efficient
   - Storage efficient

## API Reference

### Update IP Restrictions
```http
PUT /api/tenants/:id/security/ip-restrictions
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "allowedIPs": ["192.168.1.0/24"],
  "allowedRanges": ["10.0.0.0/8"],
  "blockList": ["1.2.3.4"]
}
```

### Response
```json
{
  "enabled": true,
  "allowedIPs": ["192.168.1.0/24"],
  "allowedRanges": ["10.0.0.0/8"],
  "blockList": ["1.2.3.4"],
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Security Policies Guide
- Access Control Guide
- Audit Logging Guide
- Network Security Guide
