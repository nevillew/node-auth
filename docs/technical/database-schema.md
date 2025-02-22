# Database Schema Reference

## Overview
This document details the database schema for the multi-tenant platform, including table structures, relationships, and field descriptions.

## Core Tables

### Users
```sql
CREATE TABLE "Users" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  password VARCHAR,
  status ENUM('active', 'inactive', 'suspended', 'deleted') DEFAULT 'active',
  avatar VARCHAR,
  googleId VARCHAR UNIQUE,
  failedLoginAttempts INTEGER DEFAULT 0,
  accountLockedUntil TIMESTAMP,
  lastFailedLoginAt TIMESTAMP,
  currentChallenge VARCHAR,
  passKeyEnabled BOOLEAN DEFAULT false,
  passkeyRegistrationStartedAt TIMESTAMP,
  twoFactorSecret VARCHAR,
  twoFactorEnabled BOOLEAN DEFAULT false,
  twoFactorPendingVerification BOOLEAN DEFAULT false,
  twoFactorBackupCodes VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  twoFactorSetupStartedAt TIMESTAMP,
  twoFactorLastVerifiedAt TIMESTAMP,
  twoFactorVerificationAttempts INTEGER DEFAULT 0,
  twoFactorLastFailedAttempt TIMESTAMP,
  emailVerified BOOLEAN DEFAULT false,
  verificationToken VARCHAR,
  verificationTokenExpires TIMESTAMP,
  resetToken VARCHAR,
  resetTokenExpires TIMESTAMP,
  preferences JSONB DEFAULT '{}',
  lastActivity TIMESTAMP,
  profile JSONB DEFAULT '{
    "phoneNumber": null,
    "address": null,
    "timezone": "UTC",
    "language": "en",
    "bio": null,
    "socialLinks": {},
    "skills": [],
    "title": null,
    "department": null
  }',
  emailPreferences JSONB DEFAULT '{
    "marketing": true,
    "updates": true,
    "security": true,
    "newsletter": false
  }',
  deletedAt TIMESTAMP,
  deletedBy UUID REFERENCES "Users"(id),
  statusReason VARCHAR,
  statusChangedAt TIMESTAMP,
  statusChangedBy UUID REFERENCES "Users"(id),
  deactivatedAt TIMESTAMP,
  deactivatedBy UUID REFERENCES "Users"(id),
  deactivationReason VARCHAR,
  lastLoginAt TIMESTAMP,
  loginCount INTEGER DEFAULT 0,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX users_email_idx ON "Users"(email);
CREATE INDEX users_status_idx ON "Users"(status);
```

### Tenants
```sql
CREATE TABLE "Tenants" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  databaseUrl VARCHAR NOT NULL UNIQUE,
  logo VARCHAR,
  colors JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  securityPolicy JSONB DEFAULT '{
    "session": {
      "maxConcurrentSessions": 3,
      "sessionTimeout": 3600,
      "extendOnActivity": true,
      "requireMFA": false
    },
    "twoFactor": {
      "required": false,
      "graceLogins": 3,
      "gracePeriodDays": 7,
      "allowBackupCodes": true,
      "allowRememberDevice": false,
      "exemptRoles": [],
      "enforcementDate": null
    },
    "ipRestrictions": {
      "enabled": false,
      "allowedIPs": [],
      "allowedRanges": [],
      "blockList": []
    }
  }',
  status ENUM('active', 'suspended', 'pending_deletion') DEFAULT 'active',
  deletionRequestedAt TIMESTAMP,
  deletionScheduledAt TIMESTAMP,
  gracePeriodDays INTEGER DEFAULT 7,
  settings JSONB DEFAULT '{}',
  featureFlags JSONB DEFAULT '{}',
  onboardingStatus ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX tenants_slug_idx ON "Tenants"(slug);
CREATE INDEX tenants_status_idx ON "Tenants"(status);
```

### TenantUsers (Junction Table)
```sql
CREATE TABLE "TenantUsers" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  tenantId UUID NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  roles VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  UNIQUE(userId, tenantId)
);

CREATE INDEX tenant_users_user_id_idx ON "TenantUsers"(userId);
CREATE INDEX tenant_users_tenant_id_idx ON "TenantUsers"(tenantId);
```

## Authentication & Security

### Authenticators
```sql
CREATE TABLE "Authenticators" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  credentialID BYTEA NOT NULL UNIQUE,
  credentialPublicKey BYTEA NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  friendlyName VARCHAR NOT NULL DEFAULT 'Primary Authenticator',
  lastUsedAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX authenticators_user_id_idx ON "Authenticators"(userId);
```

### OAuthClients
```sql
CREATE TABLE "OAuthClients" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clientId VARCHAR NOT NULL UNIQUE,
  clientSecret VARCHAR,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  grants VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  redirectUris VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  allowedScopes VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  tenantId UUID REFERENCES "Tenants"(id) ON DELETE CASCADE,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX oauth_clients_client_id_idx ON "OAuthClients"(clientId);
```

### OAuthTokens
```sql
CREATE TABLE "OAuthTokens" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accessToken VARCHAR NOT NULL UNIQUE,
  accessTokenExpiresAt TIMESTAMP NOT NULL,
  refreshToken VARCHAR UNIQUE,
  refreshTokenExpiresAt TIMESTAMP,
  clientId UUID NOT NULL REFERENCES "OAuthClients"(id) ON DELETE CASCADE,
  userId UUID REFERENCES "Users"(id) ON DELETE CASCADE,
  scopes VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  type VARCHAR DEFAULT 'access',
  revoked BOOLEAN DEFAULT false,
  revokedAt TIMESTAMP,
  revokedBy UUID REFERENCES "Users"(id),
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX oauth_tokens_access_token_idx ON "OAuthTokens"(accessToken);
CREATE INDEX oauth_tokens_refresh_token_idx ON "OAuthTokens"(refreshToken);
```

## Roles & Permissions

### Roles
```sql
CREATE TABLE "Roles" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  description TEXT,
  scopes VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  tenantId UUID NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  isDefault BOOLEAN DEFAULT false,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  UNIQUE(name, tenantId)
);

CREATE INDEX roles_tenant_id_idx ON "Roles"(tenantId);
```

### Permissions
```sql
CREATE TABLE "Permissions" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);
```

### RolePermissions (Junction Table)
```sql
CREATE TABLE "RolePermissions" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roleId UUID NOT NULL REFERENCES "Roles"(id) ON DELETE CASCADE,
  permissionId UUID NOT NULL REFERENCES "Permissions"(id) ON DELETE CASCADE,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  UNIQUE(roleId, permissionId)
);

CREATE INDEX role_permissions_role_id_idx ON "RolePermissions"(roleId);
```

## Activity & Audit Logs

### LoginHistories
```sql
CREATE TABLE "LoginHistories" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  ipAddress VARCHAR,
  userAgent VARCHAR,
  location JSONB,
  status ENUM('success', 'failed') NOT NULL,
  failureReason VARCHAR,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX login_histories_user_id_idx ON "LoginHistories"(userId);
CREATE INDEX login_histories_created_at_idx ON "LoginHistories"(createdAt);
```

### SecurityAuditLogs
```sql
CREATE TABLE "SecurityAuditLogs" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES "Users"(id) ON DELETE SET NULL,
  event VARCHAR NOT NULL,
  details JSONB,
  ipAddress VARCHAR,
  userAgent VARCHAR,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX security_audit_logs_user_id_idx ON "SecurityAuditLogs"(userId);
CREATE INDEX security_audit_logs_event_idx ON "SecurityAuditLogs"(event);
CREATE INDEX security_audit_logs_created_at_idx ON "SecurityAuditLogs"(createdAt);
```

### ActivityLogs
```sql
CREATE TABLE "ActivityLogs" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL,
  details JSONB,
  ipAddress VARCHAR,
  userAgent VARCHAR,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX activity_logs_user_id_idx ON "ActivityLogs"(userId);
CREATE INDEX activity_logs_created_at_idx ON "ActivityLogs"(createdAt);
```

## Notifications & Invitations

### Notifications
```sql
CREATE TABLE "Notifications" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX notifications_user_id_idx ON "Notifications"(userId);
CREATE INDEX notifications_read_idx ON "Notifications"(read);
```

### Invitations
```sql
CREATE TABLE "Invitations" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR NOT NULL,
  token VARCHAR NOT NULL,
  status ENUM('pending', 'accepted', 'expired', 'cancelled') DEFAULT 'pending',
  cancelledAt TIMESTAMP,
  cancelledBy UUID REFERENCES "Users"(id),
  expiresAt TIMESTAMP NOT NULL,
  tenantId UUID NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  invitedById UUID NOT NULL REFERENCES "Users"(id),
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);

CREATE INDEX invitations_email_idx ON "Invitations"(email);
CREATE INDEX invitations_token_idx ON "Invitations"(token);
CREATE INDEX invitations_tenant_id_idx ON "Invitations"(tenantId);
```

## Relationships

### User Relationships
- User -> Tenants (Many-to-Many through TenantUsers)
- User -> Roles (Many-to-Many through TenantUsers.roles)
- User -> Authenticators (One-to-Many)
- User -> LoginHistories (One-to-Many)
- User -> ActivityLogs (One-to-Many)
- User -> SecurityAuditLogs (One-to-Many)
- User -> Notifications (One-to-Many)
- User -> OAuthTokens (One-to-Many)

### Tenant Relationships
- Tenant -> Users (Many-to-Many through TenantUsers)
- Tenant -> Roles (One-to-Many)
- Tenant -> OAuthClients (One-to-Many)
- Tenant -> Invitations (One-to-Many)

### Role Relationships
- Role -> Permissions (Many-to-Many through RolePermissions)
- Role -> Users (Many-to-Many through TenantUsers.roles)

## Indexes
- Indexes on all foreign keys
- Indexes on frequently queried fields
- Indexes on unique constraints
- Indexes on timestamp fields used for filtering

## Best Practices
1. **UUID Primary Keys**
   - All tables use UUID primary keys
   - Generated using uuid_generate_v4()
   - Provides better distribution and security

2. **Timestamps**
   - All tables include createdAt and updatedAt
   - Automatic updates via Sequelize hooks
   - Used for audit trails and sorting

3. **Soft Deletes**
   - Users table implements soft deletes
   - Maintains referential integrity
   - Preserves audit history

4. **JSON/JSONB Fields**
   - Used for flexible data structures
   - Indexed for performance
   - Schema validation in application layer

5. **Cascading Deletes**
   - Carefully configured for referential integrity
   - Protects against orphaned records
   - Maintains data consistency

## Related Documentation
- Database Migration Guide
- Data Access Patterns
- Query Optimization Guide
- Backup Procedures
