# WebAuthn (Web Authentication) Specification Guide

## Overview
This document details the technical implementation of WebAuthn (Web Authentication) in the multi-tenant platform, including registration, authentication, and security considerations.

## WebAuthn Concepts

### Core Components
1. **Relying Party (RP)**
   - Your web application
   - Requests authentication
   - Verifies credentials
   - Maintains user accounts

2. **Authenticator**
   - Hardware security key
   - Platform authenticator (TPM)
   - Biometric sensors
   - PIN/pattern entry

3. **Client (Browser)**
   - Mediates communication
   - Implements WebAuthn API
   - Manages user interactions
   - Handles protocol flow

### Credential Types
```javascript
const credentialCreationOptions = {
  publicKey: {
    rp: {
      name: 'Multi-Tenant App',
      id: 'example.com'
    },
    user: {
      id: Uint8Array.from(userId, c => c.charCodeAt(0)),
      name: 'user@example.com',
      displayName: 'John Doe'
    },
    challenge: new Uint8Array([...]), // Random challenge
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 } // RS256
    ]
  }
};
```

## Implementation

### Registration Flow

#### 1. Server-Side Setup
```javascript
async function generateRegistrationOptions(user) {
  return {
    challenge: crypto.randomBytes(32),
    rp: {
      name: process.env.RP_NAME,
      id: process.env.RP_ID
    },
    user: {
      id: user.id,
      name: user.email,
      displayName: user.name
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 }
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'required'
    },
    timeout: 60000,
    attestation: 'direct'
  };
}
```

#### 2. Client-Side Registration
```javascript
async function registerPasskey() {
  // Get options from server
  const options = await getRegistrationOptions();
  
  // Create credentials
  const credential = await navigator.credentials.create({
    publicKey: options
  });
  
  // Send response to server
  await verifyRegistration(credential);
}
```

#### 3. Server Verification
```javascript
async function verifyRegistration(credential) {
  // Verify attestation
  const verification = await webauthn.verifyRegistrationResponse({
    credential,
    expectedChallenge,
    expectedOrigin,
    expectedRPID
  });

  // Store credential
  await storeCredential(verification.registrationInfo);
}
```

### Authentication Flow

#### 1. Authentication Options
```javascript
async function generateAuthenticationOptions(user) {
  return {
    challenge: crypto.randomBytes(32),
    timeout: 60000,
    userVerification: 'preferred',
    rpId: process.env.RP_ID,
    allowCredentials: user.credentials.map(cred => ({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports
    }))
  };
}
```

#### 2. Client Authentication
```javascript
async function authenticateWithPasskey() {
  // Get options from server
  const options = await getAuthenticationOptions();
  
  // Get assertion
  const assertion = await navigator.credentials.get({
    publicKey: options
  });
  
  // Verify with server
  await verifyAuthentication(assertion);
}
```

#### 3. Server Verification
```javascript
async function verifyAuthentication(assertion) {
  // Verify assertion
  const verification = await webauthn.verifyAuthenticationResponse({
    credential: assertion,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    authenticator: {
      credentialPublicKey,
      credentialID,
      counter
    }
  });

  // Update counter
  await updateCredentialCounter(
    verification.authenticationInfo
  );
}
```

## Security Considerations

### Attestation Options
1. **None**
   - No attestation info
   - Maximum privacy
   - Limited security info

2. **Indirect**
   - Anonymized attestation
   - Balance of privacy/security
   - Common choice

3. **Direct**
   - Full attestation data
   - Maximum security
   - Device identifiable

### User Verification
```javascript
const userVerificationLevels = {
  required: 'Force user verification',
  preferred: 'Request but don\'t require',
  discouraged: 'Don\'t request verification'
};
```

### Authenticator Selection
```javascript
const authenticatorSelection = {
  authenticatorAttachment: 'platform', // or 'cross-platform'
  residentKey: 'required', // or 'preferred', 'discouraged'
  userVerification: 'preferred', // or 'required', 'discouraged'
  requireResidentKey: true // deprecated, use residentKey
};
```

## Error Handling

### Common Errors
1. **Registration Errors**
   - Not supported
   - Already registered
   - User cancelled
   - Timeout expired

2. **Authentication Errors**
   - No credentials
   - Wrong device
   - Verification failed
   - Counter mismatch

### Error Responses
```javascript
{
  error: 'WEBAUTHN_ERROR',
  message: 'Authentication failed',
  details: {
    type: 'verification_failed',
    reason: 'Invalid signature'
  }
}
```

## Best Practices

### Security
1. **Challenge Generation**
   - Use cryptographic randomness
   - Proper length (32+ bytes)
   - Single use only
   - Short expiry time

2. **Verification**
   - Validate all fields
   - Check signatures
   - Verify counters
   - Log attempts

### User Experience
1. **Device Support**
   - Check availability
   - Fallback options
   - Clear errors
   - Help documentation

2. **Recovery Options**
   - Backup methods
   - Recovery codes
   - Support contact
   - Clear process

## API Reference

### Register Passkey
```http
POST /auth/passkey/register/options
Authorization: Bearer <token>

Response:
{
  "publicKey": {
    "challenge": "base64url-encoded-challenge",
    "rp": {
      "name": "Example App",
      "id": "example.com"
    },
    "user": {
      "id": "base64url-encoded-userid",
      "name": "user@example.com",
      "displayName": "John Doe"
    },
    "pubKeyCredParams": [
      { "type": "public-key", "alg": -7 }
    ]
  }
}
```

### Verify Registration
```http
POST /auth/passkey/register/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "credential-id",
  "rawId": "base64url-encoded-id",
  "response": {
    "clientDataJSON": "base64url-encoded-data",
    "attestationObject": "base64url-encoded-attestation"
  },
  "type": "public-key"
}
```

## Related Documentation
- Authentication Guide
- Security Policies
- Device Management
- Recovery Procedures
