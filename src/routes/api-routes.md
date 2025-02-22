# API Routes

## Authentication Routes
POST /auth/login - Local authentication login
POST /auth/passkey/register/options - Get passkey registration options
POST /auth/passkey/register/verify - Verify passkey registration
POST /auth/passkey/login/options - Get passkey login options  
POST /auth/passkey/login/verify - Verify passkey login
GET /auth/google - Google OAuth login
GET /auth/google/callback - Google OAuth callback
POST /auth/token - Get OAuth token
POST /auth/refresh - Refresh OAuth token
POST /auth/logout - Logout user
POST /auth/2fa/setup - Setup 2FA
POST /auth/2fa/verify - Verify 2FA setup
POST /auth/2fa/login - Login with 2FA
POST /auth/verify-email - Request email verification
POST /auth/verify-email/confirm - Confirm email verification
POST /auth/reset-password - Request password reset
POST /auth/reset-password/confirm - Confirm password reset
PUT /auth/preferences - Update user preferences

## User Routes
POST /api/users - Create new user
GET /api/users/:id - Get user details
PUT /api/users/:id - Update user
DELETE /api/users/:id - Delete user
GET /api/users/search - Search users
POST /api/users/bulk/update - Bulk update users
PUT /api/users/:id/status - Update user status
PUT /api/users/:id/roles - Assign roles to user
PUT /api/users/:id/permissions - Update user permissions
GET /api/users/:id/activity - Get user activity
POST /api/users/:id/deactivate - Deactivate user
GET /api/users/:id/profile - Get user profile
PUT /api/users/:id/profile - Update user profile
GET /api/users/:id/preferences - Get user preferences
PUT /api/users/:id/preferences - Update user preferences
GET /api/users/:id/email-preferences - Get email preferences
PUT /api/users/:id/email-preferences - Update email preferences
POST /api/users/:id/change-password - Change password
POST /api/users/:id/reset-password - Request password reset
POST /api/users/:id/reset-password/confirm - Confirm password reset
GET /api/users/:id/activity - Get activity history
GET /api/users/:id/login-history - Get login history
GET /api/users/:id/tenants - Get user's tenants

## Tenant Routes
POST /api/tenants - Create new tenant
GET /api/tenants/:id - Get tenant details
PUT /api/tenants/:id - Update tenant
POST /api/tenants/:id/suspend - Suspend tenant
DELETE /api/tenants/:id - Delete tenant
POST /api/tenants/:id/restore - Restore tenant
POST /api/tenants/invitations/accept - Accept tenant invitation
DELETE /api/tenants/:id/users/:userId - Remove user from tenant
POST /api/tenants/:id/users/:userId/remove - Remove user from tenant
PUT /api/tenants/:id/users/:userId/roles - Update user roles in tenant

## Notification Routes
GET /api/notifications - Get user notifications
PUT /api/notifications/:id/read - Mark notification as read
DELETE /api/notifications/:id - Delete notification

## Email Tracking Routes
GET /email/track/:trackingId/open - Track email open
GET /email/track/:trackingId/click - Track email link click
POST /email/webhooks/mailgun - Mailgun webhook handler
GET /email/analytics - Get email analytics

## Health Check
GET /health - System health check
