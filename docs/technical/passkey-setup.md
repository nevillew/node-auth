# Passkey Setup Process

## Overview
This document details the technical implementation of passkey registration and authentication in the multi-tenant platform.

## Registration Process

### 1. Initial Request
- **Endpoint**: `POST /auth/passkey/register/options`
- **Authentication**: Required
- **Rate Limiting**: 3 attempts per hour
- **Response**:
```json
{
  "rp": {
    "name": "Multi-tenant App",
    "id": "localhost"
  },
  "user": {
    "id": "user-uuid",
    "name": "user@example.com",
    "displayName": "User Name"
  },
  "challenge": "random-challenge-string",
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 60000,
  "attestation": "none",
  "authenticatorSelection": {
    "residentKey": "required",
    "userVerification": "preferred",
    "requireResidentKey": true
  }
}
```

### 2. Validation Process
1. **Pre-registration Checks**
   - Verify user exists
   - Check if passkeys already enabled
   - Validate maximum authenticator limit
   - Check rate limiting

2. **Challenge Generation**
   ```javascript
   const challenge = crypto.randomBytes(32);
   await user.update({
     currentChallenge: challenge,
     passkeyRegistrationStartedAt: new Date()
   });
   ```

### 3. Registration Verification

#### Phase 1: Request Validation
```javascript
// Verify registration time window
const registrationStart = user.passkeyRegistrationStartedAt;
if (!registrationStart || (new Date() - registrationStart) > 120000) {
  throw new Error('Registration session expired');
}

// Validate challenge
const expectedChallenge = user.currentChallenge;
if (!expectedChallenge) {
  throw new Error('No registration challenge found');
}
```

#### Phase 2: Response Verification
1. **Credential Validation**
   - Verify attestation response
   - Validate credential ID
   - Check for duplicates
   - Store public key

2. **Security Measures**
   - Validate origin
   - Check RP ID
   - Verify user presence
   - Validate counter

### 4. Database Updates

#### Authenticator Storage
```javascript
await user.createAuthenticator({
  credentialID: isoBase64URL.toBuffer(credentialID),
  credentialPublicKey: credentialPublicKey,
  counter: counter,
  transports: response.response.transports || [],
  lastUsedAt: new Date(),
  friendlyName: response.friendlyName || 'Primary Authenticator'
});
```

#### User Updates
```javascript
await user.update({ 
  currentChallenge: null,
  passkeyRegistrationStartedAt: null,
  passKeyEnabled: true 
});
```

### 5. Security Logging
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'PASSKEY_REGISTERED',
  details: {
    authenticator: {
      aaguid: registrationInfo.aaguid,
      credentialType: registrationInfo.credentialType,
      attestationType: registrationInfo.attestationType
    }
  },
  severity: 'medium'
});
```

## Authentication Process

### 1. Authentication Options
- **Endpoint**: `POST /auth/passkey/login/options`
- **Body**:
```json
{
  "email": "user@example.com"
}
```

### 2. Challenge Generation
```javascript
const options = await generateAuthenticationOptions({
  rpID,
  allowCredentials: userAuthenticators.map(authenticator => ({
    id: authenticator.credentialID,
    type: 'public-key',
    transports: authenticator.transports,
  })),
  userVerification: 'preferred',
});
```

### 3. Response Verification
1. **Credential Validation**
   - Find matching authenticator
   - Verify assertion signature
   - Validate challenge
   - Check counter

2. **Security Updates**
   ```javascript
   await authenticator.update({
     counter: authenticationInfo.newCounter,
     lastUsedAt: new Date()
   });
   ```

## Error Handling

### Common Errors
1. **Registration Errors**
   - Invalid challenge
   - Expired session
   - Duplicate credential
   - Rate limit exceeded

2. **Authentication Errors**
   - Authenticator not found
   - Invalid signature
   - Counter mismatch
   - Challenge mismatch

### Error Responses
```json
{
  "error": "Registration failed",
  "code": "PASSKEY_REGISTRATION_ERROR",
  "details": "Session expired"
}
```

## Security Considerations

### 1. Rate Limiting
```javascript
const passkeyRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many passkey registration attempts'
});
```

### 2. Challenge Security
- Random 32-byte challenge
- Time-limited validity
- Single-use verification
- Secure storage

### 3. Authenticator Management
1. **Limits**
   - Maximum 5 authenticators per user
   - Unique credential IDs
   - Active status tracking

2. **Monitoring**
   - Usage tracking
   - Failed attempts
   - Security events
   - Audit logging

## Best Practices

### 1. Registration
- Require user verification
- Validate origin
- Check RP ID
- Monitor attempts

### 2. Authentication
- Track counters
- Verify signatures
- Log activity
- Rate limit attempts

### 3. Security
- Use secure random
- Validate all input
- Log security events
- Monitor usage

## API Reference

### Register Passkey
```http
POST /auth/passkey/register/options
Authorization: Bearer <token>

Response:
{
  "rp": {...},
  "user": {...},
  "challenge": "base64string",
  "pubKeyCredParams": [...]
}
```

### Verify Registration
```http
POST /auth/passkey/register/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "credential-id",
  "rawId": "base64-raw-id",
  "response": {
    "clientDataJSON": "base64-client-data",
    "attestationObject": "base64-attestation"
  },
  "type": "public-key"
}
```

### Authentication
```http
POST /auth/passkey/login/verify
Content-Type: application/json

{
  "id": "credential-id",
  "rawId": "base64-raw-id",
  "response": {
    "clientDataJSON": "base64-client-data",
    "authenticatorData": "base64-auth-data",
    "signature": "base64-signature"
  },
  "type": "public-key"
}
```

## Related Documentation
- WebAuthn Specification
- Security Policies
- Authentication Guide
- Audit Logging Guide
