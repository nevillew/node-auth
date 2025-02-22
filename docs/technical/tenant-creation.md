# Tenant Creation Process

## Overview
This document details the technical implementation of tenant creation in the multi-tenant platform.

## Process Flow

### 1. Initial Request Handling
- Endpoint: `POST /api/tenants`
- Authentication: Required with `admin` scope
- Request body:
```json
{
  "name": "Tenant Name",
  "slug": "tenant-slug", // Optional, generated if not provided
  "features": {
    "auth": ["password", "2fa", "passkey"],
    "storage": ["s3"],
    "email": ["templates"]
  },
  "securityPolicy": {
    "passwordPolicy": {
      "minLength": 12,
      "requireSpecialChars": true
    },
    "sessionTimeout": 3600
  }
}
```

### 2. Database Provisioning
1. Generate unique database name using tenant slug
2. Create new PostgreSQL database
3. Apply base schema migrations
4. Configure connection pooling
5. Add database URL to tenant record

### 3. Default Configuration Setup
1. Create default roles:
   - Admin: Full access
   - Member: Standard access
   - Viewer: Read-only access

2. Configure security policies:
   - Session management
   - 2FA requirements
   - IP restrictions
   - Password policies

3. Initialize email templates:
   - Welcome emails
   - Password reset
   - Verification notices
   - Security alerts

### 4. Resource Initialization
1. Set up S3 buckets/folders
2. Configure Redis namespaces
3. Initialize audit logging
4. Create default user groups

### 5. User Management
1. Assign creator as initial admin
2. Set up admin permissions
3. Configure user invitation system
4. Initialize user quotas

## Implementation Details

### Database Operations
```javascript
// Create tenant database
await manager.createTenantDatabase(slug);

// Initialize connection pool
const pool = {
  max: 10,
  min: 2,
  idle: 10000,
  acquire: 30000
};
```

### Security Configuration
```javascript
const defaultSecurityPolicy = {
  session: {
    maxConcurrentSessions: 3,
    sessionTimeout: 3600,
    extendOnActivity: true,
    requireMFA: false
  },
  password: {
    minLength: 12,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventPasswordReuse: 3,
    expiryDays: 90
  }
};
```

### Role Setup
```javascript
const defaultRoles = [
  {
    name: 'Admin',
    description: 'Full access to all features',
    scopes: ['read', 'write', 'delete', 'admin']
  },
  {
    name: 'Member',
    description: 'Standard user access',
    scopes: ['read', 'write']
  },
  {
    name: 'Viewer',
    description: 'Read-only access',
    scopes: ['read']
  }
];
```

## Error Handling

### Database Creation Failures
1. Roll back partial database creation
2. Clean up any created resources
3. Log failure details
4. Return appropriate error response

### Validation Errors
1. Name validation
2. Slug uniqueness
3. Feature compatibility
4. Security policy validation

## Monitoring & Logging

### Audit Trail
```javascript
await SecurityAuditLog.create({
  event: 'TENANT_CREATED',
  severity: 'high',
  details: {
    tenantId,
    createdBy: userId,
    configuration: {
      features,
      security: securityPolicy
    }
  }
});
```

### Performance Metrics
- Database creation time
- Resource initialization duration
- Configuration application timing
- Overall process completion time

## Post-Creation Tasks

### 1. Notification System
- Send welcome email to admin
- Configure system notifications
- Set up monitoring alerts

### 2. Integration Setup
- Initialize API keys
- Configure webhooks
- Set up OAuth clients

### 3. Resource Monitoring
- Set up usage tracking
- Configure quota monitoring
- Initialize health checks

## Best Practices

### Security
1. Enforce strong default security policies
2. Implement proper role separation
3. Enable audit logging by default
4. Configure secure session management

### Performance
1. Use connection pooling
2. Implement proper caching
3. Configure appropriate resource limits
4. Monitor database performance

### Scalability
1. Design for horizontal scaling
2. Implement proper sharding
3. Use efficient indexing
4. Configure proper resource isolation

## Troubleshooting

### Common Issues
1. Database creation failures
   - Check permissions
   - Verify resource availability
   - Validate naming conventions

2. Configuration errors
   - Validate JSON schemas
   - Check feature compatibility
   - Verify security policies

3. Resource allocation failures
   - Check quota limits
   - Verify resource availability
   - Monitor system resources

### Recovery Procedures
1. Database rollback
2. Resource cleanup
3. Configuration reset
4. User notification

## API Reference

### Create Tenant
```http
POST /api/tenants
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Example Tenant",
  "slug": "example-tenant",
  "features": {
    "auth": ["password", "2fa"],
    "storage": ["s3"]
  },
  "securityPolicy": {
    "passwordPolicy": {
      "minLength": 12
    }
  }
}
```

### Response
```json
{
  "id": "uuid",
  "name": "Example Tenant",
  "slug": "example-tenant",
  "status": "active",
  "onboardingStatus": "pending"
}
```

## Related Documentation
- Database Schema Reference
- Security Policy Guide
- Role Management Guide
- Resource Quotas Documentation
