# Password Grant Authentication Process

## Overview
This document details the technical implementation of password grant authentication in the multi-tenant platform, including validation, token generation, and security measures.

## Process Flow

### 1. Authentication Request
- **Endpoint**: `POST /auth/token`
- **Content-Type**: `application/json`
- **Request Body**:
```json
{
  "grant_type": "password",
  "username": "user@example.com",
  "password": "SecurePass123!",
  "scope": "read write",
  "client_id": "your-client-id",
  "code_verifier": "your-code-verifier",
  "code_challenge": "your-code-challenge"
}
```

### 2. PKCE Validation
1. **Code Challenge Verification**
   ```javascript
   // Generate challenge from verifier
   const challenge = generateCodeChallenge(req.body.code_verifier);
   
   // Verify it matches provided challenge
   if (challenge !== req.body.code_challenge) {
     throw new Error('Invalid code_verifier');
   }
   ```

2. **Client Validation**
   ```javascript
   const client = await OAuthClient.findOne({
     where: { clientId: req.body.client_id }
   });
   
   if (!client) {
     throw new Error('Invalid client');
   }
   ```

### 3. Authentication Process

#### Phase 1: Credential Validation
```javascript
const user = await User.findOne({
  where: { email: username }
});

if (!user) {
  throw new Error('Invalid credentials');
}

const validPassword = await bcrypt.compare(password, user.password);
if (!validPassword) {
  await handleFailedLogin(user);
  throw new Error('Invalid credentials');
}
```

#### Phase 2: Account Status Check
1. **Lock Status**
   ```javascript
   if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
     const timeLeft = Math.ceil(
       (user.accountLockedUntil - new Date()) / 1000 / 60
     );
     throw new Error(`Account locked. Try again in ${timeLeft} minutes`);
   }
   ```

2. **2FA Requirement**
   ```javascript
   if (user.twoFactorEnabled) {
     return {
       requires2FA: true,
       tempToken: generateTempToken(user)
     };
   }
   ```

### 4. Token Generation

#### Access Token
```javascript
const token = {
  accessToken: crypto.randomBytes(32).toString('hex'),
  accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
  refreshToken: crypto.randomBytes(32).toString('hex'),
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  scope: requestedScope,
  client: client,
  user: user
};
```

#### Token Storage
```javascript
await OAuthToken.create({
  accessToken: token.accessToken,
  accessTokenExpiresAt: token.accessTokenExpiresAt,
  refreshToken: token.refreshToken,
  refreshTokenExpiresAt: token.refreshTokenExpiresAt,
  userId: user.id,
  clientId: client.id,
  scope: token.scope
});
```

### 5. Security Measures

#### Rate Limiting
```javascript
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts'
});
```

#### Failed Attempt Tracking
```javascript
async function handleFailedLogin(user) {
  const failedAttempts = user.failedLoginAttempts + 1;
  const updates = {
    failedLoginAttempts: failedAttempts,
    lastFailedLoginAt: new Date()
  };

  if (failedAttempts >= 5) {
    updates.accountLockedUntil = new Date(
      Date.now() + 30 * 60 * 1000 // 30 minutes
    );
  }

  await user.update(updates);
}
```

### 6. Response Format

#### Success Response
```json
{
  "access_token": "your-access-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "your-refresh-token",
  "scope": "read write"
}
```

#### Error Response
```json
{
  "error": "invalid_grant",
  "error_description": "Invalid credentials",
  "error_uri": "https://example.com/docs/auth-errors"
}
```

## Implementation Details

### PKCE Implementation
```javascript
function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256')
    .update(verifier)
    .digest();
  return base64URLEncode(hash);
}
```

### Token Generation
```javascript
function generateToken(user, client, scope) {
  const accessToken = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    scope
  };
}
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid credentials
   - Missing PKCE parameters
   - Invalid client ID
   - Invalid scope

2. **Security Errors**
   - Account locked
   - Too many attempts
   - 2FA required
   - Expired token

### Error Responses
```javascript
{
  error: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
  details: {
    remainingAttempts: 2,
    lockoutTime: '2025-02-22T12:30:00Z'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Authentication Metrics**
   - Success rate
   - Failed attempts
   - Token generation
   - Response time

2. **Security Metrics**
   - Account lockouts
   - Failed attempts
   - 2FA usage
   - PKCE usage

### Audit Trail
```javascript
{
  event: 'LOGIN_ATTEMPT',
  severity: 'medium',
  details: {
    userId: 'uuid',
    success: boolean,
    ipAddress: 'string',
    userAgent: 'string',
    failureReason: 'string'
  }
}
```

## Best Practices

### Security
1. **Password Handling**
   - Never log passwords
   - Use secure comparison
   - Rate limit attempts
   - Track failures

2. **Token Security**
   - Short expiry times
   - Secure storage
   - Rotation policy
   - Revocation support

### Performance
1. **Response Time**
   - Cache user lookup
   - Optimize queries
   - Batch operations
   - Monitor latency

2. **Resource Usage**
   - Connection pooling
   - Token cleanup
   - Cache management
   - Memory usage

## Client Implementation

### JavaScript Example
```javascript
async function login(email, password) {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Request token
  const response = await fetch('/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'password',
      username: email,
      password: password,
      client_id: 'your-client-id',
      code_verifier: codeVerifier,
      code_challenge: codeChallenge
    })
  });

  const data = await response.json();
  
  if (data.requires2FA) {
    return handle2FAFlow(data.tempToken);
  }

  return data;
}
```

### Error Handling
```javascript
try {
  const token = await login(email, password);
  // Store token securely
  sessionStorage.setItem('token', token.access_token);
} catch (error) {
  if (error.code === 'ACCOUNT_LOCKED') {
    showLockoutMessage(error.details.lockoutTime);
  } else if (error.code === 'INVALID_CREDENTIALS') {
    showLoginError(error.details.remainingAttempts);
  }
}
```

## Related Documentation
- OAuth 2.0 Configuration
- PKCE Implementation
- Two-Factor Authentication
- Security Policies
