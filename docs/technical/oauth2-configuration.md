# OAuth 2.0 Configuration Guide

## Overview
This document details the technical implementation of OAuth 2.0 in the multi-tenant platform, including grant types, token management, and security measures.

## Grant Types

### Password Grant
```javascript
const passwordGrantConfig = {
  accessTokenLifetime: 3600, // 1 hour
  refreshTokenLifetime: 7 * 24 * 3600, // 7 days
  allowExtendedTokenLifetime: false,
  requireClientAuthentication: true
};
```

### Authorization Code with PKCE
```javascript
const pkceConfig = {
  authorizationCodeLifetime: 600, // 10 minutes
  requirePKCE: true,
  allowedPKCEMethods: ['S256'],
  requireClientSecret: false,
  allowMultipleRedirectUris: false
};
```

### Client Credentials (M2M)
```javascript
const clientCredentialsConfig = {
  accessTokenLifetime: 3600,
  allowRefreshToken: false,
  requireClientSecret: true,
  scopeDelimiter: ' '
};
```

## Token Management

### Access Token Configuration
```javascript
const accessTokenConfig = {
  format: 'JWT',
  algorithm: 'RS256',
  includePermissions: true,
  includeTenantId: true,
  includeScopes: true
};
```

### Refresh Token Configuration
```javascript
const refreshTokenConfig = {
  rotateOnRefresh: true,
  reuseDetection: true,
  maxRotations: 10,
  detectSuspiciousActivity: true
};
```

### Token Storage
```javascript
const tokenStorageConfig = {
  accessTokens: {
    storage: 'redis',
    prefix: 'oauth:token:',
    ttl: 3600
  },
  refreshTokens: {
    storage: 'database',
    table: 'oauth_refresh_tokens',
    cascade: true
  }
};
```

## Client Management

### Client Registration
```javascript
const clientRegistrationConfig = {
  requireApproval: true,
  generateSecrets: true,
  secretLength: 32,
  allowedGrantTypes: ['authorization_code', 'refresh_token'],
  defaultScopes: ['read'],
  enforceSSL: true
};
```

### Client Types
1. **Public Clients**
   - Mobile apps
   - Single-page applications
   - Desktop applications
   - PKCE required

2. **Confidential Clients**
   - Server-side applications
   - Machine-to-machine
   - Client secret required

### Client Validation
```javascript
const clientValidationRules = {
  name: {
    required: true,
    minLength: 3,
    maxLength: 100
  },
  redirectUris: {
    required: true,
    validateUrl: true,
    allowLocalhost: process.env.NODE_ENV !== 'production'
  },
  allowedScopes: {
    required: true,
    validateScopes: true
  }
};
```

## Scope Management

### Default Scopes
```javascript
const defaultScopes = {
  'read': 'Read access to resources',
  'write': 'Write access to resources',
  'delete': 'Delete access to resources',
  'admin': 'Administrative access'
};
```

### Scope Validation
```javascript
function validateScopes(requestedScopes, allowedScopes) {
  return requestedScopes.every(scope => 
    allowedScopes.includes(scope) || 
    allowedScopes.includes('*')
  );
}
```

### Scope Inheritance
```javascript
const scopeHierarchy = {
  'admin': ['*'],
  'write': ['read'],
  'delete': ['read', 'write']
};
```

## Security Measures

### Token Security
1. **Access Token**
   - Short lifetime
   - Signed with RS256
   - Include minimal claims
   - Validate on each request

2. **Refresh Token**
   - Long lifetime
   - Secure storage
   - Rotation on use
   - Reuse detection

### PKCE Implementation
```javascript
const pkceRequirements = {
  enforceS256: true,
  minCodeVerifierLength: 43,
  maxCodeVerifierLength: 128,
  codeChallengeMethod: 'S256'
};
```

### Rate Limiting
```javascript
const rateLimits = {
  tokenEndpoint: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  authorizationEndpoint: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50
  }
};
```

## Implementation Examples

### Authorization Code Flow
```javascript
// Generate authorization code
const code = await oauth2.authorize({
  responseType: 'code',
  clientId: 'client123',
  redirectUri: 'https://client.example.com/callback',
  scope: 'read write',
  codeChallenge: 'challenge',
  codeChallengeMethod: 'S256'
});

// Exchange code for tokens
const tokens = await oauth2.token({
  grantType: 'authorization_code',
  code: 'auth_code',
  redirectUri: 'https://client.example.com/callback',
  clientId: 'client123',
  codeVerifier: 'verifier'
});
```

### Password Grant Flow
```javascript
const tokens = await oauth2.token({
  grantType: 'password',
  username: 'user@example.com',
  password: 'password123',
  scope: 'read write',
  clientId: 'client123',
  clientSecret: 'secret456'
});
```

### Client Credentials Flow
```javascript
const tokens = await oauth2.token({
  grantType: 'client_credentials',
  scope: 'read write',
  clientId: 'client123',
  clientSecret: 'secret456'
});
```

## Error Handling

### Common Errors
1. **Authorization Errors**
   - Invalid client
   - Invalid grant
   - Invalid scope
   - Unauthorized client

2. **Token Errors**
   - Invalid token
   - Expired token
   - Insufficient scope
   - Token revoked

### Error Responses
```javascript
{
  error: 'invalid_grant',
  error_description: 'Invalid authorization code',
  error_uri: 'https://example.com/docs/oauth-errors'
}
```

## Monitoring & Logging

### Metrics Collection
1. **Token Metrics**
   - Tokens issued
   - Tokens revoked
   - Token usage
   - Refresh rate

2. **Security Metrics**
   - Failed attempts
   - Suspicious activity
   - Rate limit hits
   - Scope violations

### Audit Trail
```javascript
{
  event: 'TOKEN_ISSUED',
  severity: 'info',
  details: {
    clientId: 'string',
    userId: 'uuid',
    grantType: 'string',
    scopes: ['array']
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Short access token lifetime
   - Secure token storage
   - Regular rotation
   - Proper revocation

2. **Client Security**
   - Validate redirect URIs
   - Require HTTPS
   - Secure client secrets
   - Monitor usage

### Implementation
1. **Grant Types**
   - Use authorization code with PKCE
   - Limit password grant usage
   - Secure client credentials
   - Implement refresh tokens

2. **Scope Management**
   - Minimal scope access
   - Clear scope definitions
   - Regular review
   - Proper validation

## Related Documentation
- Authentication Guide
- Security Policies
- Token Management
- Client Registration
