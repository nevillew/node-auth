# Authentication Guide

## Overview
This document details the authentication mechanisms available in the multi-tenant platform, including password-based, passkey, OAuth2.0, and two-factor authentication.

## Authentication Methods

### 1. Password Authentication
```json
{
  "requirements": {
    "minLength": 12,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecialChars": true,
    "preventPasswordReuse": 3,
    "expiryDays": 90
  }
}
```

#### Security Measures
- Account lockout after 5 failed attempts
- 30-minute lockout duration
- Password history tracking
- Regular expiry enforcement

### 2. Passkey (WebAuthn)
- Passwordless authentication
- Biometric support
- Multiple device registration
- Cross-platform compatibility

#### Registration Process
1. Generate registration options
2. Create authenticator
3. Verify registration
4. Enable passkey access

#### Authentication Flow
1. Get authentication options
2. Verify authenticator
3. Generate session token
4. Track authentication

### 3. OAuth 2.0

#### Supported Flows
1. **Authorization Code with PKCE**
   ```javascript
   const pkce = {
     codeVerifier: generateCodeVerifier(),
     codeChallenge: generateCodeChallenge(verifier),
     codeChallengeMethod: 'S256'
   };
   ```

2. **Password Grant**
   ```http
   POST /auth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=password
   &username=user@example.com
   &password=yourpassword
   ```

3. **Refresh Token**
   - Token rotation
   - Limited lifetime
   - Single use
   - Revocation support

### 4. Two-Factor Authentication (2FA)

#### Setup Process
1. Generate TOTP secret
2. Display QR code
3. Verify setup
4. Generate backup codes

#### Verification Flow
1. Primary authentication
2. 2FA challenge
3. Token verification
4. Session creation

## Session Management

### Token Configuration
```javascript
const tokenConfig = {
  accessToken: {
    type: 'JWT',
    algorithm: 'RS256',
    expiresIn: '1h'
  },
  refreshToken: {
    type: 'opaque',
    expiresIn: '14d',
    rotationEnabled: true
  }
};
```

### Security Features
1. **Session Control**
   - Maximum 3 concurrent sessions
   - Automatic timeout after 1 hour
   - Activity-based extension
   - Force logout capability

2. **Token Management**
   - Short-lived access tokens
   - Rotating refresh tokens
   - Scope-based access
   - Revocation support

## Implementation Examples

### 1. Password Login
```javascript
const loginUser = async (email, password) => {
  // Check if account is locked
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    throw new Error('Account is locked');
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await handleFailedLogin(user);
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const tokens = await generateTokens(user);
  return tokens;
};
```

### 2. Passkey Authentication
```javascript
const authenticateWithPasskey = async (response) => {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID
  });

  if (verification.verified) {
    return generateTokens(user);
  }
  throw new Error('Authentication failed');
};
```

### 3. 2FA Verification
```javascript
const verify2FA = async (user, token) => {
  // Check if verification is locked
  if (user.twoFactorVerificationAttempts >= 5) {
    throw new Error('Too many failed attempts');
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2
  });

  if (!verified) {
    await handleFailedVerification(user);
    throw new Error('Invalid verification code');
  }

  return true;
};
```

## Security Considerations

### 1. Rate Limiting
```javascript
const rateLimits = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 attempts
  },
  twoFactor: {
    windowMs: 15 * 60 * 1000,
    max: 5
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3
  }
};
```

### 2. Audit Logging
```javascript
const securityEvents = {
  authentication: {
    login: 'USER_LOGIN',
    logout: 'USER_LOGOUT',
    failedAttempt: 'LOGIN_FAILED',
    passwordChange: 'PASSWORD_CHANGED',
    twoFactorEnabled: 'TWO_FACTOR_ENABLED',
    passkeyRegistered: 'PASSKEY_REGISTERED'
  }
};
```

### 3. Secure Storage
- Password hashing with bcrypt
- Encrypted 2FA secrets
- Secure token storage
- Session management

## Error Handling

### Common Errors
1. **Authentication Errors**
   ```json
   {
     "INVALID_CREDENTIALS": {
       "code": 1001,
       "message": "Invalid email or password"
     },
     "ACCOUNT_LOCKED": {
       "code": 1004,
       "message": "Account is locked"
     },
     "TWO_FACTOR_REQUIRED": {
       "code": 1005,
       "message": "2FA verification required"
     }
   }
   ```

2. **Recovery Procedures**
   - Password reset flow
   - 2FA backup codes
   - Account unlock process
   - Session recovery

## Best Practices

### 1. Security
- Enable 2FA by default
- Regular security audits
- Secure communication
- Input validation

### 2. User Experience
- Clear error messages
- Multiple auth options
- Recovery procedures
- Session handling

### 3. Monitoring
- Failed attempt tracking
- Suspicious activity alerts
- Session monitoring
- Performance metrics

## API Reference

### Password Authentication
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Passkey Registration
```http
POST /auth/passkey/register/options
Authorization: Bearer <token>

Response:
{
  "rp": {},
  "user": {},
  "challenge": "base64string",
  "pubKeyCredParams": []
}
```

### 2FA Verification
```http
POST /auth/2fa/verify
Content-Type: application/json

{
  "token": "123456"
}
```

## Related Documentation
- Security Policies
- User Management Guide
- Session Management
- Error Handling
