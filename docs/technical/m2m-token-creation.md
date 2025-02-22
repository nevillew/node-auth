# Machine-to-Machine Token Creation Process

## Overview
This document details the technical implementation of machine-to-machine (M2M) token creation in the multi-tenant platform, including validation, security measures, and audit processes.

## Process Flow

### 1. Token Request
- **Endpoint**: `POST /auth/m2m/token`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "clientId": "client_id",
  "scopes": ["read:users", "write:data"],
  "tenantId": "tenant_uuid"
}
```

### 2. Validation Process
1. **Client Validation**
   ```javascript
   const client = await OAuthClient.findOne({ 
     where: { 
       clientId,
       type: 'machine',
       tenantId
     }
   });
   ```

2. **Scope Validation**
   ```javascript
   const allowedScopes = new Set(client.allowedScopes);
   const requestedScopes = new Set(scopes);
   const invalidScopes = [...requestedScopes]
     .filter(s => !allowedScopes.has(s));
   ```

### 3. Token Generation

#### Phase 1: Token Creation
```javascript
const token = await oauth2Server.generateToken({
  client,
  scope: scopes.join(' '),
  type: 'm2m',
  expiresIn: 3600, // 1 hour
  tenantId
});
```

#### Phase 2: Security Measures
1. **Token Properties**
   - Limited lifetime (1 hour)
   - Tenant-scoped
   - Specific permissions
   - Machine-type flag

2. **Access Control**
   - Validate client type
   - Check tenant access
   - Verify scopes
   - Monitor usage

### 4. Audit Trail

#### Security Logging
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
```json
{
  "access_token": "token_string",
  "expires_in": 3600,
  "scope": "read:users write:data",
  "token_type": "Bearer"
}
```

## Implementation Details

### Client Validation
```javascript
async function validateClient(clientId, tenantId) {
  const client = await OAuthClient.findOne({
    where: {
      clientId,
      type: 'machine',
      tenantId,
      status: 'active'
    }
  });

  if (!client) {
    throw new Error('Invalid client or not authorized for M2M');
  }

  return client;
}
```

### Scope Validation
```javascript
function validateScopes(requestedScopes, allowedScopes) {
  const requested = new Set(requestedScopes);
  const allowed = new Set(allowedScopes);
  
  const invalid = [...requested].filter(s => !allowed.has(s));
  
  if (invalid.length > 0) {
    throw new Error(`Invalid scopes: ${invalid.join(', ')}`);
  }
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid client
   - Invalid scopes
   - Missing tenant
   - Permission denied

2. **Processing Errors**
   - Token generation failed
   - Database error
   - Audit log error
   - Rate limit exceeded

### Error Responses
```json
{
  "error": "M2M_TOKEN_ERROR",
  "message": "Failed to generate token",
  "details": {
    "reason": "Invalid scopes requested",
    "invalidScopes": ["unauthorized:scope"]
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Generation time
   - Success rate
   - Error rate
   - Token usage

2. **Security Metrics**
   - Token count
   - Client activity
   - Scope usage
   - Failed attempts

### Audit Trail
```javascript
{
  event: 'M2M_TOKEN_GENERATED',
  severity: 'medium',
  details: {
    clientId: 'string',
    tenantId: 'uuid',
    scopes: ['array'],
    expiresAt: 'ISO date'
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Short expiry
   - Limited scopes
   - Tenant isolation
   - Usage monitoring

2. **Access Control**
   - Client validation
   - Scope verification
   - Rate limiting
   - Audit logging

### Performance
1. **Resource Management**
   - Connection pooling
   - Cache utilization
   - Batch processing
   - Queue management

2. **Optimization**
   - Quick validation
   - Efficient logging
   - Cache strategy
   - Error handling

## API Reference

### Generate M2M Token
```http
POST /auth/m2m/token
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": "client_id",
  "scopes": ["read:users", "write:data"],
  "tenantId": "tenant_uuid"
}
```

### Response
```json
{
  "access_token": "token_string",
  "expires_in": 3600,
  "scope": "read:users write:data",
  "token_type": "Bearer"
}
```

## Related Documentation
- OAuth Client Management
- Token Introspection Guide
- Audit Log Guide
- Security Policies
