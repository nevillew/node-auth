# Backup Procedures Guide

## Overview
This document details the backup procedures for the multi-tenant platform, including database backups, file storage, and disaster recovery processes.

## Database Backups

### 1. Automated Backups
```bash
# Daily full backup
pg_dump --format=custom \
  --file=/backups/daily/$(date +%Y%m%d)_full.dump \
  --verbose \
  --compress=9 \
  DATABASE_NAME

# Hourly WAL archiving
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
```

### 2. Tenant-Specific Backups
```bash
# Backup single tenant database
pg_dump --format=custom \
  --file=/backups/tenants/$(date +%Y%m%d)_${TENANT_ID}.dump \
  --schema=${TENANT_SCHEMA} \
  DATABASE_NAME
```

### 3. Retention Policy
- Daily backups: 30 days
- Weekly backups: 12 weeks
- Monthly backups: 12 months
- Yearly backups: 7 years

## File Storage Backups

### 1. S3 Bucket Replication
```json
{
  "Rules": [
    {
      "Status": "Enabled",
      "DeleteMarkerReplication": { "Status": "Enabled" },
      "Destination": {
        "Bucket": "arn:aws:s3:::backup-bucket",
        "ReplicaKmsKeyID": "arn:aws:kms:region:account:key/key-id"
      }
    }
  ]
}
```

### 2. Versioning
- Enable versioning on all buckets
- Lifecycle policies for version management
- Cross-region replication
- Encryption at rest

### 3. File Categories
1. **User Data**
   - Profile pictures
   - Uploaded documents
   - Generated reports
   - Temporary files

2. **System Data**
   - Configuration files
   - SSL certificates
   - Log files
   - Audit records

## Redis Backup

### 1. Snapshot Configuration
```bash
# Redis configuration
save 900 1          # Save if 1 change in 15 minutes
save 300 10         # Save if 10 changes in 5 minutes
save 60 10000       # Save if 10000 changes in 1 minute
```

### 2. Backup Script
```bash
#!/bin/bash
BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
redis-cli SAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$DATE.rdb
```

## Disaster Recovery

### 1. Database Recovery
```bash
# Restore full backup
pg_restore --dbname=DATABASE_NAME \
  --clean \
  --create \
  --verbose \
  /backups/daily/BACKUP_FILE.dump

# Point-in-time recovery
recovery_target_time = '2025-02-22 12:00:00'
restore_command = 'cp /archive/%f %p'
```

### 2. File Recovery
```bash
# Restore from S3
aws s3 sync s3://backup-bucket/path \
  s3://primary-bucket/path \
  --source-region backup-region \
  --region primary-region
```

### 3. Redis Recovery
```bash
# Stop Redis
systemctl stop redis

# Replace dump file
cp /backups/redis/redis_TIMESTAMP.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
systemctl start redis
```

## Backup Verification

### 1. Automated Testing
```bash
#!/bin/bash
# Test database restore
pg_restore --list BACKUP_FILE.dump > /dev/null
if [ $? -ne 0 ]; then
  echo "Backup verification failed"
  exit 1
fi

# Test file integrity
aws s3 ls s3://backup-bucket --recursive | \
while read -r line; do
  aws s3api head-object \
    --bucket backup-bucket \
    --key "${line##* }"
done
```

### 2. Manual Verification
1. **Monthly Tests**
   - Restore test database
   - Verify data integrity
   - Check application functionality
   - Validate performance

2. **Quarterly Tests**
   - Full disaster recovery
   - Cross-region restore
   - Application migration
   - Performance testing

## Monitoring & Alerts

### 1. Backup Monitoring
```javascript
const backupMetrics = {
  database: {
    size: 'gauge',
    duration: 'histogram',
    success: 'counter',
    errors: 'counter'
  },
  storage: {
    size: 'gauge',
    objects: 'gauge',
    replication: 'gauge'
  },
  redis: {
    size: 'gauge',
    lastSave: 'gauge',
    changes: 'counter'
  }
};
```

### 2. Alert Configuration
```javascript
const alertRules = {
  backupFailed: {
    condition: 'backup_success == 0',
    severity: 'critical',
    notification: ['email', 'slack', 'pager']
  },
  replicationDelay: {
    condition: 'replication_lag > 1800',
    severity: 'warning',
    notification: ['email', 'slack']
  }
};
```

## Security Measures

### 1. Encryption
- AES-256 encryption at rest
- TLS 1.3 in transit
- KMS key management
- Regular key rotation

### 2. Access Control
- Role-based access
- MFA requirement
- IP restrictions
- Audit logging

## Best Practices

### 1. Backup Strategy
- Regular testing
- Multiple copies
- Geographic distribution
- Automated verification

### 2. Recovery Testing
- Monthly restore tests
- Documentation updates
- Team training
- Process improvement

### 3. Security
- Encryption verification
- Access review
- Key rotation
- Audit compliance

## Related Documentation
- Database Management Guide
- Storage Configuration Guide
- Disaster Recovery Plan
- Security Policies
