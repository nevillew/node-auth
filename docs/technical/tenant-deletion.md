# Tenant Deletion Process

## Overview
This document details the technical implementation of tenant deletion in the multi-tenant platform, including the grace period, data cleanup, and notification processes.

## Process Flow

### 1. Deletion Request
- **Endpoint**: `DELETE /api/tenants/:id`
- **Authentication**: Required with admin scope
- **Request Body**:
```json
{
  "confirm": true
}
```

### 2. Pre-Deletion Checks
1. **Validation**
   - Verify tenant exists
   - Check admin permissions
   - Require explicit confirmation
   - Validate tenant status

2. **Resource Assessment**
   - Count active users
   - Check data volume
   - Assess connected services
   - Calculate backup size

### 3. Deletion Process

#### Phase 1: Initiation
```javascript
await tenant.update({
  status: 'pending_deletion',
  deletionRequestedAt: new Date(),
  deletionScheduledAt: deletionDate
});
```

#### Phase 2: Grace Period
- Default: 7 days configurable per tenant
- Purpose:
  - Allow for cancellation
  - Complete data backup
  - User notification
  - Service disconnection

#### Phase 3: Resource Cleanup
1. **Database Operations**
   - Revoke active connections
   - Export audit logs
   - Create final backup
   - Drop tenant database

2. **File Storage**
   - Archive uploaded files
   - Remove S3 buckets/folders
   - Clean temporary files
   - Export user data

3. **Cache & Queue**
   - Clear Redis entries
   - Remove job queues
   - Clean session data
   - Purge message queues

### 4. Notification System

#### User Notifications
1. **Email Templates**
   - Initial deletion notice
   - Reminder emails
   - Final confirmation
   - Deletion complete

2. **In-App Notifications**
   - Banner alerts
   - System messages
   - Admin notifications
   - Status updates

#### Audit Trail
```javascript
await SecurityAuditLog.create({
  event: 'TENANT_DELETED',
  severity: 'critical',
  details: {
    tenantId,
    name,
    userCount,
    dataSize,
    requestedBy,
    completedAt
  }
});
```

### 5. Cleanup Tasks

#### Data Retention
1. **Retained Data**
   - Audit logs: 1 year
   - Financial records: 7 years
   - User data: 30 days
   - System logs: 90 days

2. **Immediate Deletion**
   - Session data
   - Cache entries
   - Temporary files
   - API tokens

#### Resource Recovery
1. **System Resources**
   - Database connections
   - Cache allocations
   - Storage quotas
   - API limits

2. **Service Cleanup**
   - OAuth applications
   - Webhook endpoints
   - Email templates
   - Custom domains

## Implementation Details

### Database Cleanup
```javascript
// Terminate active connections
await client.query(`
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = $1
    AND pid <> pg_backend_pid()
`, [dbName]);

// Drop database
await client.query(`DROP DATABASE "${dbName}"`);
```

### File Storage Cleanup
```javascript
// Archive and remove S3 files
const objects = await s3.listObjects({
  Bucket: process.env.AWS_BUCKET_NAME,
  Prefix: `tenant-${tenantId}/`
});

await Promise.all(
  objects.Contents.map(obj =>
    s3.deleteObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: obj.Key
    })
  )
);
```

### Cache Invalidation
```javascript
// Clear tenant-specific cache
const keys = await redisClient.keys(`tenant:${tenantId}:*`);
if (keys.length > 0) {
  await redisClient.del(keys);
}
```

## Error Handling

### Common Errors
1. **Database Errors**
   - Connection timeouts
   - Lock conflicts
   - Space constraints
   - Backup failures

2. **Storage Errors**
   - S3 access denied
   - Quota exceeded
   - Network timeout
   - File locks

### Recovery Procedures
1. **Transaction Rollback**
   ```javascript
   try {
     await t.commit();
   } catch (error) {
     await t.rollback();
     logger.error('Deletion failed:', error);
   }
   ```

2. **Cleanup Verification**
   - Verify database dropped
   - Check file deletion
   - Confirm cache cleared
   - Validate backups

## Monitoring & Logging

### Metrics Collection
1. **Performance Metrics**
   - Deletion duration
   - Resource usage
   - Network traffic
   - API latency

2. **Business Metrics**
   - Deleted tenants
   - Data volume
   - User impact
   - Storage freed

### Audit Logging
```javascript
{
  event: 'TENANT_DELETION_COMPLETED',
  severity: 'critical',
  details: {
    tenantId: 'uuid',
    duration: 'time in ms',
    dataSize: 'bytes',
    backupLocation: 's3://path'
  }
}
```

## Best Practices

### Security
1. **Access Control**
   - Verify admin rights
   - Check dependencies
   - Validate tokens
   - Log all actions

2. **Data Protection**
   - Encrypt backups
   - Secure transfers
   - Verify deletions
   - Audit changes

### Performance
1. **Resource Management**
   - Batch operations
   - Connection pooling
   - Parallel processing
   - Rate limiting

2. **Optimization**
   - Index cleanup
   - Cache invalidation
   - Connection handling
   - Storage cleanup

## API Reference

### Delete Tenant
```http
DELETE /api/tenants/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirm": true
}
```

### Response
```json
{
  "message": "Tenant scheduled for deletion",
  "deletionDate": "2025-03-01T00:00:00Z",
  "gracePeriodDays": 7
}
```

## Related Documentation
- Tenant Creation Guide
- Backup Procedures
- Audit Log Guide
- Security Policies
