# User Guide

## Getting Started

### Account Creation
1. Visit the signup page at `https://app.example.com/signup`
2. Enter your email address and create a password that meets these requirements:
   - Minimum 12 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
3. Verify your email address by clicking the link sent to your inbox
4. Complete your profile with:
   - Full name
   - Profile picture (optional)
   - Time zone
   - Language preference

### Initial Setup
1. **Two-Factor Authentication**
   - Strongly recommended for account security
   - Use an authenticator app like Google Authenticator
   - Save backup codes in a secure location

2. **Passkey Registration**
   - Add a passkey for passwordless login
   - Supported on most modern browsers
   - Multiple devices can be registered

3. **Notification Preferences**
   - Email notifications
   - Push notifications
   - Security alerts
   - Newsletter subscription

### Basic Navigation
- **Dashboard**: Overview of your tenants and recent activity
- **Profile**: Personal settings and preferences
- **Tenants**: Manage tenant access and roles
- **Security**: 2FA, passkeys, and security settings
- **Activity**: Login history and account activity

### Common Tasks
1. **Profile Management**
   - Update personal information
   - Change password
   - Manage email preferences
   - Configure notifications

2. **Tenant Operations**
   - Switch between tenants
   - View tenant roles
   - Access tenant resources
   - Manage tenant settings (admin only)

3. **Security Management**
   - Enable/disable 2FA
   - Register passkeys
   - View security logs
   - Manage sessions

## Authentication

### Password Management
1. **Password Requirements**
   ```
   - Minimum length: 12 characters
   - Must include: uppercase, lowercase, number, special char
   - Cannot reuse last 3 passwords
   - Expires every 90 days
   ```

2. **Password Reset Process**
   - Request reset from login page
   - Check email for reset link
   - Link expires in 1 hour
   - Must choose new password

### Two-Factor Authentication (2FA)
1. **Setup Process**
   - Go to Security Settings
   - Click "Enable 2FA"
   - Scan QR code with authenticator app
   - Enter verification code
   - Save backup codes

2. **Using 2FA**
   - Enter password during login
   - Provide 6-digit code from authenticator
   - Option to remember device for 30 days
   - Use backup codes if needed

### Passkey Registration
1. **Adding a Passkey**
   - Go to Security Settings
   - Click "Add Passkey"
   - Follow browser prompts
   - Name your passkey
   - Test the registration

2. **Using Passkeys**
   - Click "Sign in with passkey"
   - Select your passkey
   - Authenticate with biometrics/PIN
   - Access granted immediately

### Session Management
- Sessions expire after 1 hour of inactivity
- Maximum 3 concurrent sessions
- Force logout available for all devices
- Session details viewable in security settings

## User Management

### Profile Settings
1. **Personal Information**
   - Name
   - Email address
   - Profile picture
   - Contact information

2. **Preferences**
   ```json
   {
     "theme": "light|dark|system",
     "notifications": {
       "email": true,
       "push": true,
       "sms": false
     },
     "accessibility": {
       "highContrast": false,
       "fontSize": "normal"
     }
   }
   ```

### Security Settings
1. **Authentication Methods**
   - Password
   - Two-factor authentication
   - Passkeys
   - Recovery options

2. **Activity Monitoring**
   - Login history
   - Device list
   - Location tracking
   - Security events

## Tenant Access

### Joining Tenants
1. **Invitation Process**
   - Receive email invitation
   - Click acceptance link
   - Set up account if new
   - Gain immediate access

2. **Role Assignment**
   - Roles assigned by tenant admin
   - Common roles: Admin, Member, Viewer
   - Custom roles possible
   - Role changes require admin approval

### Permission Management
1. **Available Permissions**
   - Resource access
   - Action permissions
   - Administrative rights
   - Feature access

2. **Request Process**
   - Submit access request
   - Specify needed permissions
   - Provide justification
   - Await admin approval

## Security Features

### IP Restrictions
1. **Configuration**
   ```json
   {
     "allowedIPs": ["192.168.1.0/24"],
     "allowedRanges": ["10.0.0.0/8"],
     "blockList": ["1.2.3.4"]
   }
   ```

2. **Notifications**
   - New IP access alerts
   - Blocked attempt notifications
   - Location-based warnings
   - Suspicious activity alerts

### Activity Monitoring
1. **Login History**
   - Date and time
   - IP address
   - Device information
   - Location data

2. **Security Events**
   - Password changes
   - 2FA enablement/disablement
   - Role changes
   - Permission updates

## Troubleshooting

### Common Issues
1. **Login Problems**
   - Incorrect password
   - 2FA device lost
   - Account locked
   - Session expired

2. **Access Issues**
   - Permission denied
   - Role missing
   - IP restricted
   - Account suspended

### Recovery Options
1. **Password Recovery**
   - Use "Forgot Password"
   - Check email for reset link
   - Follow reset process
   - Update security settings

2. **2FA Recovery**
   - Use backup codes
   - Contact support if codes lost
   - Verify identity
   - Reset 2FA if needed

### Support Contact
- Email: support@example.com
- Hours: 24/7
- Response time: < 1 hour
- Priority support for security issues

### Error Messages
Common error codes and solutions:
```
401: Authentication failed
403: Permission denied
404: Resource not found
429: Too many attempts
503: Service unavailable
```

## Best Practices
1. **Security**
   - Enable 2FA
   - Use strong passwords
   - Register passkeys
   - Monitor activity

2. **Account Management**
   - Regular password updates
   - Review active sessions
   - Check security logs
   - Update contact info

3. **Tenant Access**
   - Use correct tenant
   - Verify permissions
   - Report issues
   - Follow policies
