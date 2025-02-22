# User Profile Update Process

## Overview
This document details the technical implementation of user profile updates in the multi-tenant platform, including validation, file handling, and notification processes.

## Process Flow

### 1. Update Request
- **Endpoint**: `PUT /api/users/:id/profile`
- **Authentication**: Required with profile:write scope
- **Content Type**: multipart/form-data (for avatar uploads)
- **Request Body**:
```json
{
  "name": "Updated Name",
  "profile": {
    "phoneNumber": "+1234567890",
    "timezone": "UTC",
    "language": "en",
    "bio": "Software developer",
    "title": "Senior Engineer",
    "department": "Engineering",
    "socialLinks": {
      "linkedin": "https://linkedin.com/in/username",
      "github": "https://github.com/username"
    }
  },
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "accessibility": {
      "highContrast": false,
      "fontSize": "normal"
    },
    "privacy": {
      "profileVisibility": "public",
      "activityVisibility": "private"
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
   - Phone number format
   - Valid timezone
   - URL formats
   - Enum values

3. **File Validation**
   - Avatar file type (JPEG, PNG, GIF)
   - Maximum file size (5MB)
   - Image dimensions
   - File integrity

### 3. Avatar Processing

#### Phase 1: File Upload
```javascript
const { key, signedUrl } = await uploadToS3(
  req.file,
  'avatars',
  24 * 60 * 60 // 24 hour signed URL
);
```

#### Phase 2: Image Processing
1. **Optimization**
   - Resize image
   - Generate thumbnails
   - Optimize quality
   - Convert format

2. **Storage**
   - Upload to S3
   - Generate signed URL
   - Update user record
   - Clean old avatar

### 4. Database Updates

#### Phase 1: Transaction
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

  if (avatarKey) {
    updates.avatar = avatarKey;
    updates.avatarUrl = avatarSignedUrl;
  }

  // Apply updates
  await user.update(updates, { transaction: t });
  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Cache Management
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
1. **User Notifications**
   - Profile update confirmation
   - Avatar processing status
   - Preference changes
   - Security alerts

2. **Admin Notifications**
   - Suspicious changes
   - Large file uploads
   - Multiple updates
   - Security events

### 6. Audit Trail
```javascript
await SecurityAuditLog.create({
  userId: user.id,
  event: 'PROFILE_UPDATED',
  details: {
    changes: {
      before: previousState,
      after: newState
    },
    fields: changedFields
  },
  severity: 'low'
});
```

## Implementation Details

### Field Validation
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
  },
  socialLinks: {
    validate: {
      linkedin: (url) => url.startsWith('https://linkedin.com/'),
      github: (url) => url.startsWith('https://github.com/')
    }
  }
};
```

### File Handling
```javascript
const fileOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
};
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid field format
   - File too large
   - Wrong file type
   - Missing required field

2. **Processing Errors**
   - Upload failure
   - Image processing
   - Database error
   - Cache error

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
   - Image processing
   - Cache operations

2. **Business Metrics**
   - Update frequency
   - Field changes
   - Storage usage
   - Error rates

### Audit Trail
```javascript
{
  event: 'PROFILE_UPDATED',
  severity: 'low',
  details: {
    userId: 'uuid',
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
   - Image optimization
   - Connection pooling

2. **Resource Management**
   - Clean old files
   - Manage cache size
   - Monitor quotas
   - Track usage

## API Reference

### Update Profile
```http
PUT /api/users/:id/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "name": "John Doe",
  "avatar": <file>,
  "profile": {
    "phoneNumber": "+1234567890",
    "timezone": "UTC"
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
  "avatarUrl": "https://...",
  "profile": {
    "phoneNumber": "+1234567890",
    "timezone": "UTC"
  },
  "preferences": {
    "theme": "dark"
  },
  "updatedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- User Management Guide
- File Upload Guide
- Security Policies
- Audit Logging Guide
