# Error Codes Reference

This document provides a comprehensive reference of error codes used throughout the authentication service. The error codes are categorized by their domain and include detailed descriptions to help with troubleshooting and handling errors.

## Format

All error responses follow a standardized format:

```json
{
  "requestId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    // Optional additional context for the error
  },
  "errorId": 1001 // Numeric error code for programmatic handling
}
```

- `requestId`: A unique identifier for the request that encountered the error
- `code`: String identifier for the error type (from the `ErrorCode` enum)
- `message`: Human-readable description of the error
- `details`: (Optional) Additional context-specific information about the error
- `errorId`: Numeric identifier for the error type

## API Response Processing

Our codebase uses a functional programming approach to error handling through the `Result<T>` type. This enables Railway-Oriented Programming where functions can be chained together safely with error short-circuiting.

```typescript
// Example of Railway-Oriented Programming with our Result type
const result = await chainResult(
  validateUserInput(userData),
  validData => hashPassword(validData.password),
  hashedPassword => createUserInDatabase({ ...userData, password: hashedPassword })
);

// Pattern match on the result
if (result.ok) {
  // Handle success case with result.value
} else {
  // Handle specific error with result.error
}
```

## Error Code Categories

Error codes are grouped by category, with each category using a specific numeric range:

| Category | Code Range | Description |
|----------|------------|-------------|
| Authentication | 1xxx | Authentication-related errors |
| Authorization | 2xxx | Access control and permissions errors |
| Resource | 3xxx | Resource manipulation errors |
| Validation | 4xxx | Input validation errors |
| Tenant | 5xxx | Tenant-specific errors |
| Rate Limiting | 6xxx | Rate limiting and throttling errors |
| Integration | 7xxx | External service integration errors |
| Database | 8xxx | Database operation errors |
| System | 9xxx | Internal system errors |
| Cache | 10xxx | Cache and data persistence errors |
| File | 11xxx | File handling and storage errors |

## Authentication Errors (1xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| INVALID_CREDENTIALS | 1001 | Invalid email or password | Provided credentials do not match any user record |
| TOKEN_EXPIRED | 1002 | Authentication token has expired | The JWT or session token has passed its expiration time |
| INVALID_TOKEN | 1003 | Invalid authentication token | The provided token is malformed or has an invalid signature |
| ACCOUNT_LOCKED | 1004 | Account is locked due to too many failed attempts | Account temporarily locked after exceeding failed login attempts |
| TWO_FACTOR_REQUIRED | 1005 | 2FA verification required | Two-factor authentication is required to complete the login |
| INVALID_2FA_TOKEN | 1006 | Invalid 2FA verification code | The provided two-factor code is incorrect or expired |
| MFA_CONFIGURATION_ERROR | 1007 | Error configuring multi-factor authentication | Error during MFA setup or configuration |
| SESSION_EXPIRED | 1008 | Your session has expired, please login again | User session has timed out due to inactivity or policy |
| INVALID_REFRESH_TOKEN | 1009 | Invalid refresh token | The provided refresh token is invalid or expired |
| PASSKEY_ERROR | 1010 | Error with passkey authentication | Error during passkey authentication process |

## Authorization Errors (2xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| UNAUTHORIZED | 2001 | You are not authorized to perform this action | User does not have permission for the requested action |
| INSUFFICIENT_PERMISSIONS | 2002 | Insufficient permissions | User has insufficient permissions for the operation |
| INVALID_SCOPE | 2003 | Invalid or missing scope | The token lacks required OAuth scopes for the operation |
| IP_RESTRICTED | 2004 | Access from this IP address is restricted | IP address is not in the allowlist or is in the blocklist |
| ROLE_REQUIRED | 2005 | This action requires a specific role | User lacks the role required for this operation |

## Resource Errors (3xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| RESOURCE_NOT_FOUND | 3001 | Requested resource not found | The requested resource does not exist |
| RESOURCE_EXISTS | 3002 | Resource already exists | Creating a resource that already exists |
| RESOURCE_CONFLICT | 3003 | Resource conflict | Generic resource conflict error |
| RESOURCE_DELETED | 3004 | Resource has been deleted | Attempting to access a soft-deleted resource |
| RESOURCE_LOCKED | 3005 | Resource is locked and cannot be modified | Resource is currently locked for editing |
| RESOURCE_INACTIVE | 3006 | Resource is inactive | The resource exists but is in an inactive state |
| RESOURCE_VERSION_CONFLICT | 3007 | Resource has been modified by another user | Concurrent modification conflict (optimistic locking) |
| RESOURCE_DEPENDENCY_ERROR | 3008 | Resource has dependencies that prevent this operation | Cannot perform operation due to dependencies |
| RESOURCE_LIMIT_EXCEEDED | 3009 | Resource limit exceeded | Resource quota or limit has been reached |

## Validation Errors (4xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| INVALID_INPUT | 4001 | Invalid input data | General validation error for input data |
| MISSING_REQUIRED | 4002 | Required fields are missing | One or more required fields are missing |
| INVALID_FORMAT | 4003 | Invalid data format | Data format is incorrect (e.g., date, JSON, etc.) |
| DATA_TYPE_ERROR | 4004 | Data type error | Value has the wrong data type |
| VALIDATION_COMPLEX | 4005 | Multiple validation errors occurred | Multiple validation errors in a single request |
| PASSWORD_POLICY_VIOLATION | 4006 | Password does not meet the required security policy | Password does not meet complexity requirements |
| EMAIL_FORMAT_INVALID | 4007 | Email format is invalid | Email address has invalid format |

## Tenant Errors (5xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| TENANT_NOT_FOUND | 5001 | Tenant not found | The specified tenant does not exist |
| TENANT_SUSPENDED | 5002 | Tenant is suspended | Tenant account is currently suspended |
| TENANT_LIMIT_EXCEEDED | 5003 | Tenant resource limit exceeded | Tenant has reached their resource limits |
| TENANT_DELETED | 5004 | Tenant has been deleted | Attempting to access a deleted tenant |
| TENANT_NAME_TAKEN | 5005 | Tenant name is already taken | Another tenant with this name already exists |
| TENANT_CONFIGURATION_ERROR | 5006 | Tenant configuration error | Error in tenant configuration |

## Rate Limiting Errors (6xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| RATE_LIMIT_EXCEEDED | 6001 | Rate limit exceeded | Request rate exceeds the allowed limit |
| TOO_MANY_REQUESTS | 6002 | Too many requests | Too many requests in a given time period |
| CONCURRENT_REQUEST_LIMIT | 6003 | Too many concurrent requests | Max number of concurrent requests exceeded |
| API_QUOTA_EXCEEDED | 6004 | API quota exceeded for this billing period | Monthly or billing period quota exceeded |

## Integration Errors (7xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| INTEGRATION_ERROR | 7001 | External service integration error | Generic external service error |
| SERVICE_UNAVAILABLE | 7002 | External service is unavailable | External dependency is unavailable |
| EMAIL_DELIVERY_FAILED | 7003 | Email delivery failed | Failed to deliver email |
| THIRD_PARTY_API_ERROR | 7004 | Third-party API error | Error from a third-party API |
| WEBHOOK_DELIVERY_FAILED | 7005 | Webhook delivery failed | Failed to deliver webhook notification |

## Database Errors (8xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| DB_CONNECTION_ERROR | 8001 | Database connection error | Cannot connect to the database |
| DB_QUERY_FAILED | 8002 | Database query failed | Generic database query error |
| DB_TRANSACTION_ERROR | 8003 | Database transaction error | Error during transaction processing |
| DB_FOREIGN_KEY_VIOLATION | 8004 | Foreign key constraint violation | Operation violates foreign key constraint |
| DB_UNIQUE_CONSTRAINT_VIOLATION | 8005 | Unique constraint violation | Duplicate value for a unique field |
| DB_CHECK_CONSTRAINT_VIOLATION | 8006 | Check constraint violation | Operation violates check constraint |
| DB_DEADLOCK | 8007 | Database deadlock detected | Deadlock detected during operation |
| DB_TIMEOUT | 8008 | Database operation timed out | Database operation exceeded timeout |
| DB_SERIALIZATION_ERROR | 8009 | Database serialization error | Serialization failure in transaction |

## System Errors (9xxx)

| Code | Error ID | Message | Description |
|------|----------|---------|-------------|
| INTERNAL_ERROR | 9001 | Internal server error | Unexpected server error |
| DATABASE_ERROR | 9002 | Database operation failed | Generic database error |
| CONFIGURATION_ERROR | 9003 | System configuration error | System misconfiguration |
| MAINTENANCE_MODE | 9004 | System is in maintenance mode | System temporarily unavailable for maintenance |
| FILE_SYSTEM_ERROR | 9005 | File system error | Error accessing the file system |
| MEMORY_LIMIT_EXCEEDED | 9006 | Memory limit exceeded | Operation exceeded memory limits |
| TIMEOUT | 9007 | Operation timed out | Operation took too long to complete |
| INITIALIZATION_ERROR | 9008 | Service initialization error | Error during service startup |

## Error Handling Best Practices

When handling errors in your application:

1. **Check the error code**: Use the string `code` to identify the type of error.
2. **Display appropriate messages**: Use the `message` for user-facing errors.
3. **Log detailed information**: Log the full error response including `details` for debugging.
4. **Handle specific errors appropriately**:
   - Authentication errors (1xxx): Redirect to login or prompt for re-authentication
   - Validation errors (4xxx): Display field-specific error messages
   - Resource errors (3xxx): Handle not-found conditions or conflicts
   - System errors (9xxx): Display a generic error and notify administrators

## Example Usage

```javascript
try {
  // Perform an operation
  const result = await api.createUser(userData);
} catch (error) {
  // Handle specific error types
  switch (error.code) {
    case 'RESOURCE_EXISTS':
      // Show user-friendly message about duplicate account
      break;
    case 'VALIDATION_COMPLEX':
      // Show field validation errors from details
      const validationErrors = error.details.errors;
      break;
    case 'DB_UNIQUE_CONSTRAINT_VIOLATION':
      // Handle unique constraint violations
      break;
    default:
      // Generic error handling
      console.error(`Error ${error.code}: ${error.message}`);
  }
}
```