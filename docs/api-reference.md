# API Reference

## Authentication

### OAuth 2.0 Flows

#### Password Grant
- **Endpoint**: `POST /auth/token`
- **Description**: Authenticate with email/password
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "grant_type": "password",
  "username": "user@example.com",
  "password": "yourpassword"
}
```

#### Refresh Token
- **Endpoint**: `POST /auth/refresh`
- **Description**: Get new access token using refresh token
- **Body**:
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "your_refresh_token"
}
```

#### PKCE Flow
1. Generate Challenge:
   - **Endpoint**: `POST /auth/pkce/challenge`
   - **Response**: Code verifier and challenge

2. Authorization:
   - **Endpoint**: `GET /auth/authorize`
   - **Query Parameters**: 
     - `client_id`
     - `code_challenge`
     - `code_challenge_method`
     - `redirect_uri`

3. Token Exchange:
   - **Endpoint**: `POST /auth/token`
   - **Body**: Include code_verifier

### Two-Factor Authentication (2FA)

#### Setup 2FA
- **Endpoint**: `POST /auth/2fa/setup`
- **Authentication**: Required
- **Response**: TOTP secret and QR code

#### Verify 2FA Setup
- **Endpoint**: `POST /auth/2fa/verify`
- **Body**:
```json
{
  "token": "123456"
}
```

#### Login with 2FA
- **Endpoint**: `POST /auth/2fa/login`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "token": "123456"
}
```

### Passkey Authentication

#### Registration
1. **Get Options**: `POST /auth/passkey/register/options`
2. **Verify Registration**: `POST /auth/passkey/register/verify`

#### Authentication
1. **Get Options**: `POST /auth/passkey/login/options`
2. **Verify Authentication**: `POST /auth/passkey/login/verify`

## User Management

### Create User
- **Endpoint**: `POST /api/users`
- **Authentication**: Required
- **Scope**: `users:write`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

### Update User
- **Endpoint**: `PUT /api/users/:id`
- **Authentication**: Required
- **Body**: Supports partial updates

### User Search
- **Endpoint**: `GET /api/users/search`
- **Query Parameters**:
  - `query`: Search term
  - `status`: active/inactive/suspended
  - `role`: Role filter
  - `page`: Page number
  - `limit`: Results per page

### Bulk Operations
- **Endpoint**: `POST /api/users/bulk/update`
- **Body**:
```json
{
  "userIds": ["uuid1", "uuid2"],
  "updates": {
    "status": "active",
    "roleIds": ["role1", "role2"]
  }
}
```

## Tenant Management

### Create Tenant
- **Endpoint**: `POST /api/tenants`
- **Authentication**: Required
- **Body**:
```json
{
  "name": "Tenant Name",
  "slug": "tenant-slug",
  "features": {},
  "securityPolicy": {}
}
```

### Tenant Operations
- List: `GET /api/tenants`
- Get Details: `GET /api/tenants/:id`
- Update: `PUT /api/tenants/:id`
- Suspend: `POST /api/tenants/:id/suspend`
- Delete: `DELETE /api/tenants/:id`

### User Management in Tenant
- Remove User: `DELETE /api/tenants/:id/users/:userId`
- Update Roles: `PUT /api/tenants/:id/users/:userId/roles`

## Notifications

### Get Notifications
- **Endpoint**: `GET /api/notifications`
- **Authentication**: Required
- **Query Parameters**:
  - `read`: Filter by read status
  - `page`: Page number

### Update Notifications
- Mark as Read: `PUT /api/notifications/:id/read`
- Delete: `DELETE /api/notifications/:id`

## Error Handling

### Error Response Format
```json
{
  "code": "ERROR_CODE",
  "message": "Error description",
  "details": {},
  "requestId": "uuid"
}
```

### Common Error Codes
- `INVALID_CREDENTIALS`: Authentication failed
- `TOKEN_EXPIRED`: Access token expired
- `INSUFFICIENT_PERMISSIONS`: Missing required permissions
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limiting

### Default Limits
- API Requests: 100 per 15 minutes per IP
- Login Attempts: 5 per 15 minutes per IP/email
- Password Reset: 3 per hour per email
- 2FA Verification: 5 per hour per user

### Headers
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time until limit resets

## Webhooks

### Email Events
- **Endpoint**: `POST /email/webhooks/mailgun`
- **Events**:
  - Delivery
  - Bounce
  - Open
  - Click

### Security Events
- **Endpoint**: `POST /api/csp-report`
- **Events**: CSP violations

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "status": "active|inactive|suspended",
  "preferences": {
    "theme": "light|dark",
    "notifications": {
      "email": boolean,
      "push": boolean
    }
  },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Tenant
```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "status": "active|suspended",
  "features": {},
  "securityPolicy": {
    "passwordPolicy": {},
    "ipRestrictions": {},
    "sessionTimeout": number
  }
}
```

### Role
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "scopes": ["string"],
  "permissions": ["uuid"]
}
```

## Security

### Authentication Methods
- OAuth 2.0 with PKCE
- Passkey (WebAuthn)
- Two-Factor Authentication (TOTP)
- Social Login (Google)

### Security Headers
- Content Security Policy (CSP)
- CORS restrictions
- XSS Protection
- CSRF Tokens

### Session Management
- Configurable timeout
- Concurrent session limits
- Force logout capability
- Activity tracking

### IP Security
- Allowlist/Blocklist
- CIDR range support
- Geographic restrictions
- Rate limiting

## Testing

### Authentication Examples

#### OAuth Password Grant
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "password",
    "username": "user@example.com",
    "password": "yourpassword"
  }'
```

#### Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "your_refresh_token"
  }'
```

#### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepassword",
    "name": "New User"
  }'
```

#### Create Tenant
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Tenant",
    "slug": "new-tenant"
  }'
```
