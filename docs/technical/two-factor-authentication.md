# Two-Factor Authentication Guide

## Overview
This comprehensive guide details the implementation and management of Two-Factor Authentication (2FA) in the multi-tenant platform, including setup, verification, recovery, and administrative processes.

## Authentication Methods

### Time-based One-Time Password (TOTP)
- Compatible with Google Authenticator, Authy, etc.
- 6-digit codes
- 30-second refresh
- SHA-256 algorithm
- 32-byte secrets

### Backup Codes
- 10 single-use codes
- XXXX-XXXX format
- Hashed storage
- Automatic regeneration
- Usage tracking

### Remember Device Option
- 30-day trust period
- Device fingerprinting
- IP validation
- Browser validation

## Implementation Flow

### 1. Setup Process
```typescript
// Generate secret
const secret = speakeasy.generateSecret({
  name: `${appName} (${user.email})`,
  length: 32,
  issuer: appName
});

// Generate QR code
const qrCode = await qrcode.toDataURL(secret.otpauth_url, {
  errorCorrectionLevel: 'H'
});

// Generate backup codes
const backupCodes = Array.from({ length: 10 }, () => 
  crypto.randomBytes(4).toString('hex').toUpperCase()
    .match(/.{1,4}/g).join('-')
);
```

### 2. Verification Process
```typescript
// Verify TOTP code
const verified = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: 'base32',
  token,
  window: 2 // Allow 1 minute time drift
});

// Verify backup code
const validBackupCode = await bcrypt.compare(
  code,
  user.backupCodes[index]
);
```

### 3. Login Flow
```typescript
// After password validation
if (user.twoFactorEnabled) {
  return {
    requiresTwoFactor: true,
    tempToken: generateTempToken(user)
  };
}

// After 2FA validation
const token = await generateAuthToken(user);
```

## Security Measures

### Rate Limiting
```typescript
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many attempts'
});
```

### Session Protection
1. **Temporary Tokens**
   - Short lifetime (5 minutes)
   - Single use
   - Limited scope
   - IP bound

2. **Device Trust**
   - Secure cookie
   - Device fingerprint
   - Location validation
   - Activity monitoring

### Recovery Options
1. **Backup Codes**
   - One-time use
   - Secure storage
   - Usage logging
   - Auto-regeneration

2. **Admin Recovery**
   - Requires approval
   - Audit logging
   - Identity verification
   - New device setup

## Administrative Features

### Tenant Policies
```typescript
const twoFactorPolicy = {
  required: true,
  gracePeriodDays: 7,
  graceLogins: 3,
  allowRememberDevice: false,
  allowBackupCodes: true,
  exemptRoles: ['service-account']
};
```

### Monitoring
1. **Usage Metrics**
   - Setup rate
   - Success rate
   - Method usage
   - Recovery rate

2. **Security Events**
   - Failed attempts
   - Backup code usage
   - Device changes
   - Recovery actions

### Audit Logging
```typescript
await SecurityAuditLog.create({
  event: 'TWO_FACTOR_VERIFIED',
  severity: 'medium',
  details: {
    userId,
    method: 'TOTP',
    deviceInfo,
    location
  }
});
```

## User Experience

### Setup Flow
1. **Initialization**
   - Generate secret
   - Create QR code
   - Generate backup codes
   - Show instructions

2. **Verification**
   - Enter TOTP code
   - Validate setup
   - Save backup codes
   - Enable 2FA

### Login Flow
1. **First Factor**
   - Enter credentials
   - Validate password
   - Check 2FA status
   - Generate temp token

2. **Second Factor**
   - Enter TOTP code
   - Validate code
   - Check remember device
   - Generate session

### Recovery Flow
1. **Using Backup Codes**
   - Enter backup code
   - Validate code
   - Mark as used
   - Generate session

2. **Admin Recovery**
   - Contact admin
   - Verify identity
   - Reset 2FA
   - Setup new device

## API Reference

### Setup 2FA
```http
POST /auth/2fa/setup
Authorization: Bearer <token>

Response:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["XXXX-XXXX", ...],
  "expiresAt": "2025-02-22T12:00:00Z"
}
```

### Verify Setup
```http
POST /auth/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "123456"
}

Response:
{
  "enabled": true,
  "backupCodesRemaining": 10
}
```

### Login with 2FA
```http
POST /auth/2fa/login
Content-Type: application/json

{
  "tempToken": "temp-token",
  "token": "123456",
  "rememberDevice": true
}

Response:
{
  "token": "access-token",
  "expiresAt": "2025-02-22T13:00:00Z"
}
```

## Best Practices

### Security
1. **Secret Management**
   - Secure generation
   - Encrypted storage
   - Regular rotation
   - Proper cleanup

2. **Access Control**
   - Rate limiting
   - Session validation
   - IP restrictions
   - Device tracking

### Implementation
1. **Code Quality**
   - Input validation
   - Error handling
   - Audit logging
   - Performance optimization

2. **User Experience**
   - Clear instructions
   - Error messages
   - Recovery options
   - Support contact

## Related Documentation
- Authentication Guide
- Security Policies
- User Management
- Session Management
