# Two-Factor Authentication Setup Process

## Overview
This document details the technical implementation of Two-Factor Authentication (2FA) setup in the multi-tenant platform, including validation, security measures, and backup procedures.

## Process Flow

### 1. Setup Request
- **Endpoint**: `POST /auth/2fa/setup`
- **Authentication**: Required
- **Response**:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["XXXX-XXXX", ...],
  "expiresAt": "2025-02-22T12:10:00Z"
}
```

### 2. Setup Process

#### Phase 1: Secret Generation
```javascript
const secret = speakeasy.generateSecret({
  name: `Multi-Tenant App (${user.email})`,
  length: 32,
  issuer: process.env.APP_NAME
});
```

#### Phase 2: Backup Codes
- Generate 10 backup codes
- Format as XXXX-XXXX
- Hash before storage
- Store with user record

#### Phase 3: QR Code
- Generate using secret
- Include app name and issuer
- High error correction
- Proper sizing

### 3. Verification Process

#### Phase 1: Token Validation
```javascript
const verified = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: 'base32',
  token,
  window: 4 // Allow 2 minutes time drift
});
```

#### Phase 2: Account Update
- Enable 2FA flag
- Store secret
- Store backup codes
- Update verification status

### 4. Security Measures

#### Rate Limiting
```javascript
const twoFactorSetupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many setup attempts'
});
```

#### Session Protection
- Require password reentry
- Validate current session
- Check device trust
- Monitor suspicious activity

### 5. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: '2FA Enabled Successfully',
  template: '2fa-enabled',
  context: {
    name: user.name,
    timestamp: new Date(),
    deviceInfo: req.userAgent
  }
});
```

#### Security Alerts
- Setup initiated
- Verification complete
- Backup codes generated
- Device authorized

## Implementation Details

### Secret Generation
```javascript
function generateTwoFactorSecret(user) {
  return speakeasy.generateSecret({
    name: `${process.env.APP_NAME} (${user.email})`,
    length: 32,
    issuer: process.env.APP_NAME,
    encoding: 'base32'
  });
}
```

### Backup Code Generation
```javascript
function generateBackupCodes() {
  return Array.from({ length: 10 }, () => {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    return code.match(/.{1,4}/g).join('-');
  });
}
```

### QR Code Generation
```javascript
async function generateQRCode(otpauthUrl) {
  return qrcode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    width: 300
  });
}
```

## Error Handling

### Common Errors
1. **Setup Errors**
   - Invalid secret generation
   - QR code generation failure
   - Backup code creation error
   - Storage failure

2. **Verification Errors**
   - Invalid token
   - Token expired
   - Too many attempts
   - Session invalid

### Recovery Procedures
1. **Setup Recovery**
   ```javascript
   try {
     await setupTwoFactor(user);
   } catch (error) {
     await cleanupFailedSetup(user);
     throw new Error('2FA setup failed');
   }
   ```

2. **Verification Recovery**
   - Reset attempt counter
   - Clear pending status
   - Remove temporary secret
   - Log failure

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Setup duration
   - Verification time
   - QR generation speed
   - API latency

2. **Security Metrics**
   - Setup attempts
   - Failed verifications
   - Backup code usage
   - Session validity

### Audit Trail
```javascript
{
  event: '2FA_ENABLED',
  severity: 'medium',
  details: {
    userId: 'uuid',
    method: 'TOTP',
    backupCodesGenerated: true,
    deviceInfo: {
      userAgent: 'string',
      ip: 'string'
    }
  }
}
```

## Best Practices

### Security
1. **Secret Management**
   - Secure generation
   - Encrypted storage
   - Limited lifetime
   - Proper cleanup

2. **Verification Process**
   - Rate limiting
   - Attempt tracking
   - Session validation
   - Device verification

### User Experience
1. **Setup Flow**
   - Clear instructions
   - QR code preview
   - Backup code download
   - Verification confirmation

2. **Recovery Options**
   - Backup codes
   - Alternative methods
   - Support contact
   - Account recovery

## API Reference

### Start 2FA Setup
```http
POST /auth/2fa/setup
Authorization: Bearer <token>
```

### Verify Setup
```http
POST /auth/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "123456"
}
```

### Response
```json
{
  "enabled": true,
  "verifiedAt": "2025-02-22T12:00:00Z",
  "backupCodesRemaining": 10
}
```

## Related Documentation
- Authentication Guide
- Security Policies
- Backup Procedures
- Account Recovery Guide
