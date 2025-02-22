# Machine-to-Machine (M2M) Authentication Process

## Overview
This document details the technical implementation of machine-to-machine (M2M) authentication in the multi-tenant platform, including token generation, validation, and security measures.

## Process Flow

### 1. Token Request
- **Endpoint**: `POST /auth/m2m/token`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "clientId": "your-client-id",
  "scopes": ["read", "write"],
  "tenantId": "tenant-uuid"
}
```

### 2. Validation Process

#### Client Verification
```javascript
const client = await OAuthClient.findOne({ 
  where: { 
    clientId,
    type: 'machine',
    tenantId
  }
});

if (!client) {
  throw new Error('Client not found or not authorized for M2M');
}
```

#### Scope Validation
```javascript
const allowedScopes = new Set(client.allowedScopes);
const requestedScopes = new Set(scopes);
const invalidScopes = [...requestedScopes].filter(s => !allowedScopes.has(s));

if (invalidScopes.length > 0) {
  throw new Error('Invalid scopes requested');
}
```

### 3. Token Generation

#### Access Token
```javascript
const token = await oauth2Server.generateToken({
  client,
  scope: scopes.join(' '),
  type: 'm2m',
  expiresIn: 3600, // 1 hour
  tenantId // Include tenant ID in token payload
});
```

#### Token Storage
```javascript
await OAuthToken.create({
  accessToken: token.accessToken,
  accessTokenExpiresAt: token.accessTokenExpiresAt,
  clientId: client.id,
  scope: scopes.join(' '),
  type: 'm2m',
  tenantId
});
```

### 4. Security Measures

#### Rate Limiting
```javascript
const m2mTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 tokens per hour
  message: 'Too many token requests'
});
```

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'M2M_TOKEN_GENERATED',
  details: {
    clientId: client.id,
    tenantId,
    scopes,
    expiresAt: token.accessTokenExpiresAt
  },
  severity: 'medium'
});
```

### 5. Response Format

#### Success Response
```json
{
  "access_token": "your-access-token",
  "expires_in": 3600,
  "scope": "read write",
  "token_type": "Bearer"
}
```

#### Error Response
```json
{
  "error": "invalid_scope",
  "error_description": "Invalid scopes requested",
  "details": {
    "invalidScopes": ["admin"]
  }
}
```

## Implementation Details

### Token Validation
```javascript
async function validateM2MToken(token) {
  // Verify token exists and is not expired
  const tokenRecord = await OAuthToken.findOne({
    where: { 
      accessToken: token,
      type: 'm2m',
      revoked: false,
      accessTokenExpiresAt: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!tokenRecord) {
    throw new Error('Invalid or expired token');
  }

  // Verify tenant access
  if (tokenRecord.tenantId !== requestedTenantId) {
    throw new Error('Token not authorized for this tenant');
  }

  return tokenRecord;
}
```

### Scope Management
```javascript
function validateM2MScopes(client, requestedScopes) {
  const allowedScopes = new Set(client.allowedScopes);
  
  return requestedScopes.every(scope => 
    allowedScopes.has(scope) || allowedScopes.has('*')
  );
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid client ID
   - Invalid scopes
   - Missing tenant ID
   - Expired token

2. **Security Errors**
   - Rate limit exceeded
   - Unauthorized tenant
   - Revoked token
   - Invalid permissions

### Error Responses
```javascript
{
  error: 'M2M_TOKEN_ERROR',
  message: 'Token generation failed',
  details: {
    reason: 'Invalid client configuration',
    clientId: 'client-id'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Token Metrics**
   - Generation rate
   - Usage patterns
   - Error rates
   - Expiry tracking

2. **Security Metrics**
   - Failed attempts
   - Scope violations
   - Tenant mismatches
   - Rate limit hits

### Audit Trail
```javascript
{
  event: 'M2M_TOKEN_USED',
  severity: 'low',
  details: {
    clientId: 'string',
    tenantId: 'uuid',
    endpoint: '/api/resource',
    method: 'GET',
    scopes: ['read']
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Short expiry times
   - Scope restrictions
   - Tenant isolation
   - Regular rotation

2. **Access Control**
   - Validate permissions
   - Check tenant context
   - Monitor usage
   - Log access

### Performance
1. **Token Generation**
   - Cache client config
   - Batch operations
   - Optimize validation
   - Monitor latency

2. **Resource Usage**
   - Connection pooling
   - Token cleanup
   - Cache management
   - Rate limiting

## API Reference

### Generate M2M Token
```http
POST /auth/m2m/token
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "clientId": "your-client-id",
  "scopes": ["read", "write"],
  "tenantId": "tenant-uuid"
}
```

### List M2M Tokens
```http
GET /auth/m2m/tokens?clientId=your-client-id&active=true
Authorization: Bearer <admin-token>
```

### Revoke M2M Token
```http
POST /auth/m2m/token/revoke
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "token": "token-to-revoke",
  "clientId": "your-client-id"
}
```

## Client Implementation

### JavaScript Example
```javascript
async function getM2MToken() {
  const response = await fetch('/auth/m2m/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientId: 'your-client-id',
      scopes: ['read', 'write'],
      tenantId: 'tenant-uuid'
    })
  });

  const data = await response.json();
  return data.access_token;
}

// Use token for API calls
async function callApi() {
  const token = await getM2MToken();
  
  const response = await fetch('/api/resource', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': 'tenant-uuid'
    }
  });

  return response.json();
}
```

## Related Documentation
- OAuth 2.0 Configuration
- Client Management
- Security Policies
- Audit Logging Guide
