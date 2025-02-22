# Password Reset Process

## Overview
This document details the technical implementation of password reset in the multi-tenant platform, including request validation, token generation, and security measures.

## Process Flow

### 1. Reset Request
- **Endpoint**: `POST /auth/reset-password`
- **Request Body**:
```json
{
  "email": "user@example.com"
}
```

### 2. Request Validation

#### Rate Limiting
```javascript
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts'
});
```

#### User Validation
```javascript
const user = await User.findOne({ 
  where: { email },
  include: [{
    model: Tenant,
    attributes: ['securityPolicy']
  }]
});
```

### 3. Token Generation

#### Reset Token
```javascript
const token = crypto.randomBytes(32).toString('hex');
const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

await user.update({
  resetToken: token,
  resetTokenExpires: expires
});
```

#### Security Measures
1. **Token Properties**
   - 32 bytes of entropy
   - 1 hour expiration
   - Single use only
   - Tied to user ID

2. **Rate Limiting**
   - Per email address
   - Per IP address
   - Exponential backoff
   - Lockout threshold

### 4. Email Notification

#### Reset Email
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: 'Password Reset Request',
  template: 'password-reset',
  context: {
    name: user.name,
    resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
    expiresAt: expires,
    supportEmail: process.env.SUPPORT_EMAIL
  }
});
```

#### Security Alerts
1. **User Notifications**
   - Reset requested
   - Token expiry
   - IP address
   - Device info

2. **Admin Alerts**
   - Multiple attempts
   - Suspicious patterns
   - Failed resets
   - Account lockouts

### 5. Password Reset

#### Token Validation
```javascript
const user = await User.findOne({ 
  where: { 
    resetToken: token,
    resetTokenExpires: { [Op.gt]: new Date() }
  }
});
```

#### Password Update
```javascript
const hashedPassword = await bcrypt.hash(newPassword, 10);

await user.update({
  password: hashedPassword,
  resetToken: null,
  resetTokenExpires: null,
  passwordChangedAt: new Date()
});
```

### 6. Post-Reset Actions

#### Session Management
1. **Token Revocation**
   ```javascript
   await OAuthToken.update(
     { revoked: true },
     { where: { userId: user.id } }
   );
   ```

2. **Cache Cleanup**
   ```javascript
   await redisClient.del(`user:${user.id}:sessions`);
   ```

#### Security Measures
1. **Password History**
   ```javascript
   await user.update({
     passwordHistory: [
       ...user.passwordHistory,
       hashedPassword
     ].slice(-3)
   });
   ```

2. **Account Protection**
   - Reset failed attempts
   - Clear lockout status
   - Update last password change
   - Log security event

## Implementation Details

### Password Validation
```javascript
function validatePassword(password, policy) {
  const checks = [
    {
      test: pwd => pwd.length >= policy.minLength,
      message: `Password must be at least ${policy.minLength} characters`
    },
    {
      test: pwd => /[A-Z]/.test(pwd),
      message: 'Password must contain uppercase letters'
    },
    {
      test: pwd => /[a-z]/.test(pwd),
      message: 'Password must contain lowercase letters'
    },
    {
      test: pwd => /[0-9]/.test(pwd),
      message: 'Password must contain numbers'
    },
    {
      test: pwd => /[^A-Za-z0-9]/.test(pwd),
      message: 'Password must contain special characters'
    }
  ];

  return checks
    .filter(check => !check.test(password))
    .map(check => check.message);
}
```

### History Check
```javascript
async function checkPasswordHistory(user, newPassword) {
  const recentPasswords = user.passwordHistory.slice(0, 3);
  
  for (const hash of recentPasswords) {
    if (await bcrypt.compare(newPassword, hash)) {
      throw new Error('Cannot reuse any of your last 3 passwords');
    }
  }
}
```

## Error Handling

### Common Errors
1. **Request Errors**
   - Invalid email
   - Rate limited
   - Account locked
   - Token expired

2. **Reset Errors**
   - Invalid token
   - Weak password
   - History conflict
   - System error

### Error Responses
```javascript
{
  error: 'PASSWORD_RESET_ERROR',
  message: 'Unable to reset password',
  details: {
    reason: 'Token expired',
    retryAfter: '2025-02-22T12:30:00Z'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Reset Metrics**
   - Request rate
   - Success rate
   - Token usage
   - Error types

2. **Security Metrics**
   - Failed attempts
   - Token expiry
   - IP patterns
   - Device info

### Audit Trail
```javascript
{
  event: 'PASSWORD_RESET',
  severity: 'high',
  details: {
    userId: 'uuid',
    requestIp: 'string',
    userAgent: 'string',
    success: boolean
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Secure generation
   - Short lifetime
   - Single use
   - Proper cleanup

2. **Password Requirements**
   - Strong complexity
   - History check
   - Dictionary check
   - Length requirements

### User Experience
1. **Communication**
   - Clear instructions
   - Status updates
   - Error messages
   - Support contact

2. **Recovery Options**
   - Email reset
   - Security questions
   - Support contact
   - Account recovery

## API Reference

### Request Reset
```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Complete Reset
```http
POST /auth/reset-password/confirm
Content-Type: application/json

{
  "token": "reset-token",
  "password": "new-password"
}
```

### Response
```json
{
  "message": "Password reset successfully",
  "requiresLogin": true
}
```

## Related Documentation
- Authentication Guide
- Security Policies
- Email Templates
- Audit Logging Guide
