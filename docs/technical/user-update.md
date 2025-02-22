# User Update Process

## Overview
This document details the technical implementation of user updates in the multi-tenant platform, including validation, security measures, and notification processes.

## Process Flow

### 1. Update Request
- **Endpoint**: `PUT /api/users/:id`
- **Authentication**: Required with users:write scope
- **Request Body**:
```json
{
  "name": "Updated Name",
  "avatar": "https://example.com/avatar.jpg",
  "profile": {
    "phoneNumber": "+1234567890",
    "timezone": "UTC",
    "language": "en"
  },
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": false
    }
  }
}
```

### 2. Validation Process
1. **Input Validation**
   ```javascript
   const { error } = updateUserSchema.validate(req.body);
   ```

2. **Field Validation**
   - Name format and length
   - Valid timezone
   - Phone number format
   - Avatar URL format

3. **Permission Check**
   - Verify update permissions
   - Check tenant access
   - Validate scope access
   - Audit trail logging

### 3. Update Process

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  // Create update object
  const updates = {
    name,
    profile: {
      ...user.profile,
      ...profile
    },
    preferences: {
      ...user.preferences,
      ...preferences
    }
  };

  // Apply updates
  await user.update(updates, { transaction: t });
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Avatar Processing
1. **File Upload**
   - Validate file type
   - Check file size
   - Generate unique name
   - Upload to S3

2. **Image Processing**
   - Generate thumbnails
   - Create signed URL
   - Update user record
   - Clean old avatar

### 4. Security Measures

#### Audit Logging
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'USER_UPDATED',
  details: {
    updatedBy: req.user.id,
    changes: {
      before: previousState,
      after: newState
    }
  },
  severity: 'medium'
});
```

#### Session Management
1. **Token Handling**
   - Maintain active sessions
   - Update session data
   - Refresh tokens
   - Track changes

2. **Security Events**
   - Log profile changes
   - Monitor suspicious updates
   - Track IP addresses
   - Record user agent

### 5. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: user.email,
  subject: 'Profile Updated',
  template: 'profile-updated',
  context: {
    name: user.name,
    changes: changedFields,
    timestamp: new Date()
  }
});
```

#### System Notifications
1. **In-App Messages**
   - Profile updates
   - Security changes
   - Preference updates
   - Setting changes

2. **Admin Alerts**
   - Suspicious changes
   - Multiple updates
   - Security events
   - Policy violations

## Implementation Details

### Field Updates
1. **Profile Fields**
   ```javascript
   const profileFields = {
     phoneNumber: {
       validate: /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/
     },
     timezone: {
       validate: timeZones
     },
     language: {
       validate: ['en', 'es', 'fr']
     }
   };
   ```

2. **Preference Fields**
   ```javascript
   const preferenceFields = {
     theme: ['light', 'dark', 'system'],
     notifications: {
       email: Boolean,
       push: Boolean,
       sms: Boolean
     },
     accessibility: {
       highContrast: Boolean,
       fontSize: ['small', 'normal', 'large']
     }
   };
   ```

### Avatar Management
```javascript
// Upload to S3
const { key, signedUrl } = await uploadToS3(
  file,
  'avatars',
  24 * 60 * 60 // 24 hour signed URL
);

// Update user record
await user.update({
  avatar: key,
  avatarUrl: signedUrl
});
```

### Cache Management
```javascript
// Clear user cache
await redisClient.del(`user:${userId}:profile`);
await redisClient.del(`user:${userId}:preferences`);

// Update cache with new data
await redisClient.set(
  `user:${userId}:profile`,
  JSON.stringify(user.profile),
  'EX',
  3600
);
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid field format
   - Missing required data
   - Invalid preferences
   - File upload issues

2. **Permission Errors**
   - Insufficient rights
   - Tenant mismatch
   - Scope violation
   - Token expired

### Error Responses
```javascript
{
  error: 'VALIDATION_ERROR',
  message: 'Invalid input data',
  details: {
    field: 'phoneNumber',
    error: 'Invalid format'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Update duration
   - File upload time
   - Cache operations
   - Transaction time

2. **Business Metrics**
   - Update frequency
   - Field changes
   - Error rates
   - User activity

### Audit Trail
```javascript
{
  event: 'USER_UPDATED',
  severity: 'medium',
  details: {
    userId: 'uuid',
    updatedBy: 'uuid',
    changes: {
      name: {
        from: 'Old Name',
        to: 'New Name'
      }
    },
    timestamp: 'ISO date'
  }
}
```

## Best Practices

### Security
1. **Input Validation**
   - Sanitize all input
   - Validate file types
   - Check permissions
   - Log changes

2. **Resource Protection**
   - Rate limiting
   - File size limits
   - Concurrent updates
   - Session handling

### Performance
1. **Optimization**
   - Batch updates
   - Cache management
   - Connection pooling
   - Transaction handling

2. **Resource Management**
   - Clean old files
   - Manage cache size
   - Monitor quotas
   - Track usage

## API Reference

### Update User
```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "profile": {
    "phoneNumber": "+1234567890"
  },
  "preferences": {
    "theme": "dark"
  }
}
```

### Response
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "profile": {
    "phoneNumber": "+1234567890"
  },
  "preferences": {
    "theme": "dark"
  },
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- User Creation Guide
- File Upload Guide
- Security Policies
- Audit Logging Guide
