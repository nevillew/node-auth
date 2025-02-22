# User Management Guide

## Overview
This guide provides comprehensive instructions for managing users in the multi-tenant platform, including creation, authentication, permissions, and monitoring.

## User Lifecycle

### Creation Process
1. **Direct Creation**
   ```typescript
   const user = await sdk.users.create({
     email: "user@example.com",
     name: "John Doe",
     password: "SecurePass123!",
     roles: ["member"]
   });
   ```

2. **Invitation Flow**
   ```typescript
   const invitation = await sdk.tenants.inviteUser(tenantId, {
     email: "user@example.com",
     roles: ["member"],
     message: "Welcome to our platform!"
   });
   ```

### Authentication Methods

#### Password Authentication
- Minimum length: 12 characters
- Requires: uppercase, lowercase, numbers, special chars
- Password history: last 3 passwords
- Expiry: 90 days configurable

#### Two-Factor Authentication
1. **Setup Process**
   ```typescript
   const setup = await sdk.users.setup2FA(userId);
   // Returns QR code and backup codes
   ```

2. **Verification**
   ```typescript
   await sdk.users.verify2FA(userId, {
     token: "123456"
   });
   ```

#### Passkey (WebAuthn)
1. **Registration**
   ```typescript
   const options = await sdk.users.getPasskeyOptions(userId);
   await sdk.users.registerPasskey(userId, credentials);
   ```

2. **Authentication**
   ```typescript
   const assertion = await sdk.users.authenticatePasskey(options);
   ```

### Role Management

#### Role Assignment
```typescript
await sdk.users.assignRoles(userId, {
  roles: ["admin", "billing"],
  tenantId: "tenant-uuid"
});
```

#### Permission Updates
```typescript
await sdk.users.updatePermissions(userId, {
  permissions: ["read:users", "write:billing"],
  tenantId: "tenant-uuid"
});
```

### Profile Management

#### Update Profile
```typescript
await sdk.users.updateProfile(userId, {
  name: "Updated Name",
  avatar: fileObject,
  profile: {
    phoneNumber: "+1234567890",
    timezone: "UTC",
    language: "en"
  }
});
```

#### Preference Management
```typescript
await sdk.users.updatePreferences(userId, {
  theme: "dark",
  notifications: {
    email: true,
    push: true,
    sms: false
  },
  accessibility: {
    highContrast: false,
    fontSize: "normal"
  }
});
```

### Security Management

#### Account Status
1. **Status Updates**
   ```typescript
   await sdk.users.updateStatus(userId, {
     status: "suspended",
     reason: "Security violation"
   });
   ```

2. **Lock/Unlock**
   ```typescript
   await sdk.users.lockAccount(userId, {
     duration: 3600, // 1 hour
     reason: "Too many failed attempts"
   });
   ```

#### Session Management
1. **Active Sessions**
   ```typescript
   const sessions = await sdk.users.getSessions(userId);
   ```

2. **Force Logout**
   ```typescript
   await sdk.users.revokeSession(userId, {
     sessionId: "session-uuid",
     allDevices: false
   });
   ```

### Activity Monitoring

#### Login History
```typescript
const loginHistory = await sdk.users.getLoginHistory(userId, {
  startDate: "2025-01-01",
  endDate: "2025-02-22",
  status: "success"
});
```

#### Audit Trail
```typescript
const auditLogs = await sdk.users.getAuditLogs(userId, {
  severity: "high",
  events: ["PASSWORD_CHANGED", "ROLE_UPDATED"]
});
```

### Tenant Access

#### Grant Access
```typescript
await sdk.tenants.addUser(tenantId, {
  userId: "user-uuid",
  roles: ["member"]
});
```

#### Remove Access
```typescript
await sdk.tenants.removeUser(tenantId, userId, {
  reason: "Project completed"
});
```

## Best Practices

### Security
1. **Password Management**
   - Enforce strong passwords
   - Regular rotation
   - Failed attempt tracking
   - Secure storage

2. **Access Control**
   - Least privilege principle
   - Regular access review
   - Role-based access
   - Session monitoring

### User Experience
1. **Onboarding**
   - Clear instructions
   - Email verification
   - Welcome messages
   - Initial setup guide

2. **Communication**
   - Status updates
   - Security alerts
   - Feature announcements
   - Support contact

### Compliance
1. **Data Protection**
   - Privacy settings
   - Data retention
   - Export capability
   - Deletion process

2. **Audit Requirements**
   - Activity logging
   - Change tracking
   - Access records
   - Security events

## Troubleshooting

### Common Issues
1. **Authentication Problems**
   - Invalid credentials
   - Expired password
   - Account locked
   - 2FA issues

2. **Access Issues**
   - Permission denied
   - Role conflicts
   - Session expired
   - Token invalid

### Recovery Procedures
1. **Account Recovery**
   - Password reset
   - 2FA recovery
   - Session cleanup
   - Profile restore

2. **Access Recovery**
   - Role verification
   - Permission sync
   - Cache refresh
   - Token reissue

## API Reference

### User Management
```typescript
// Create user
const user = await sdk.users.create({
  email: "user@example.com",
  password: "SecurePass123!"
});

// Update profile
await sdk.users.update(userId, {
  name: "Updated Name",
  profile: { /* ... */ }
});

// Delete user
await sdk.users.delete(userId);
```

### Role Management
```typescript
// Assign roles
await sdk.users.assignRoles(userId, {
  roles: ["admin"]
});

// Update permissions
await sdk.users.updatePermissions(userId, {
  permissions: ["read:users"]
});
```

### Security Operations
```typescript
// Lock account
await sdk.users.lock(userId);

// Force logout
await sdk.users.logout(userId, {
  allDevices: true
});
```

## Related Documentation
- Authentication Guide
- Role Management Guide
- Security Policies
- Compliance Guide
