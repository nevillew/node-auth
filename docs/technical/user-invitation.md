# User Invitation Process

## Overview
This document details the technical implementation of user invitations in the multi-tenant platform, including validation, security measures, and notification processes.

## Process Flow

### 1. Invitation Request
- **Endpoint**: `POST /api/tenants/:id/invitations`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "email": "user@example.com",
  "roles": ["member"],
  "message": "Optional welcome message"
}
```

### 2. Validation Process
1. **Input Validation**
   - Valid email format
   - Existing roles
   - Admin permissions
   - Rate limiting

2. **Duplicate Check**
   ```javascript
   const existingInvitation = await Invitation.findOne({
     where: {
       email,
       tenantId,
       status: 'pending'
     }
   });
   ```

### 3. Invitation Creation

#### Phase 1: Database Transaction
```javascript
const t = await sequelize.transaction();
try {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await Invitation.create({
    email,
    token,
    status: 'pending',
    roles,
    expiresAt,
    tenantId,
    invitedById: req.user.id
  }, { transaction: t });
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### Phase 2: Security Setup
1. **Token Generation**
   - Cryptographically secure
   - Time-limited
   - Single-use
   - Tenant-specific

2. **Role Validation**
   - Verify role exists
   - Check permissions
   - Validate hierarchy
   - Prevent privilege escalation

### 4. Notification System

#### Email Notifications
```javascript
await emailService.sendEmail({
  to: invitation.email,
  subject: `You've been invited to join ${tenant.name}`,
  template: 'user-invitation',
  context: {
    name: invitation.email,
    tenantName: tenant.name,
    invitedBy: req.user.name,
    invitationUrl,
    expiresAt: invitation.expiresAt
  }
});
```

#### System Notifications
1. **Admin Alerts**
   - Invitation sent
   - Status updates
   - Expiry warnings
   - Security events

2. **Audit Trail**
   ```javascript
   await SecurityAuditLog.create({
     userId: req.user.id,
     event: 'USER_INVITED',
     details: {
       email: invitation.email,
       tenantId,
       roles,
       expiresAt
     },
     severity: 'medium'
   });
   ```

### 5. Acceptance Process

#### Phase 1: Validation
```javascript
const invitation = await Invitation.findOne({
  where: {
    token,
    status: 'pending',
    expiresAt: { [Op.gt]: new Date() }
  },
  include: [Tenant]
});
```

#### Phase 2: User Creation/Association
1. **New User**
   - Create account
   - Set password
   - Verify email
   - Initialize profile

2. **Existing User**
   - Verify identity
   - Add tenant access
   - Assign roles
   - Update preferences

### 6. Post-Acceptance Tasks

#### Data Cleanup
1. **Update Invitation**
   ```javascript
   await invitation.update({
     status: 'accepted',
     acceptedAt: new Date()
   });
   ```

2. **Resource Setup**
   - Create user folders
   - Set permissions
   - Initialize quotas
   - Configure access

#### Notifications
1. **Welcome Email**
   - Access details
   - Getting started
   - Support contact
   - Security tips

2. **Admin Notification**
   - Acceptance status
   - User details
   - Access granted
   - Next steps

## Implementation Details

### Token Generation
```javascript
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

### Email Templates
```html
<div>
  <h1>You've been invited to join {{tenantName}}</h1>
  <p>Dear {{name}},</p>
  <p>You have been invited by {{invitedBy}} to join {{tenantName}}.</p>
  <p><a href="{{invitationUrl}}">Accept Invitation</a></p>
  <p>This invitation expires on {{expiresAt}}.</p>
</div>
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - Invalid email
   - Expired token
   - Used invitation
   - Missing permissions

2. **Processing Errors**
   - Database failures
   - Email sending
   - Role assignment
   - Resource creation

### Recovery Procedures
1. **Transaction Rollback**
   ```javascript
   try {
     await t.commit();
   } catch (error) {
     await t.rollback();
     logger.error('Invitation failed:', error);
   }
   ```

2. **Cleanup Tasks**
   - Remove partial data
   - Revoke permissions
   - Clear cache
   - Log failures

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Processing time
   - Email delivery
   - Resource usage
   - API latency

2. **Business Metrics**
   - Invitation count
   - Acceptance rate
   - Time to accept
   - Role distribution

### Audit Trail
```javascript
{
  event: 'INVITATION_ACCEPTED',
  severity: 'medium',
  details: {
    invitationId: 'uuid',
    email: 'user@example.com',
    tenantId: 'uuid',
    roles: ['member'],
    acceptedAt: 'ISO date'
  }
}
```

## Best Practices

### Security
1. **Token Management**
   - Secure generation
   - Limited lifetime
   - Single use
   - Proper storage

2. **Access Control**
   - Role validation
   - Permission checks
   - Audit logging
   - Rate limiting

### Performance
1. **Resource Management**
   - Batch processing
   - Connection pooling
   - Cache utilization
   - Queue management

2. **Optimization**
   - Email queuing
   - Async processing
   - Resource cleanup
   - Cache strategy

## API Reference

### Create Invitation
```http
POST /api/tenants/:id/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "roles": ["member"],
  "message": "Welcome to our platform!"
}
```

### Accept Invitation
```http
POST /api/tenants/invitations/accept
Content-Type: application/json

{
  "token": "invitation-token",
  "password": "new-password"  // For new users only
}
```

### Response
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "roles": ["member"],
  "tenantId": "tenant-uuid",
  "acceptedAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- User Creation Guide
- Role Management Guide
- Email Templates Guide
- Security Policies
