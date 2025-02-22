# File Upload Guide

## Overview
This document details the technical implementation of file uploads in the multi-tenant platform, including validation, storage, and security measures.

## Process Flow

### 1. Upload Request
- **Endpoint**: `POST /api/files/upload`
- **Authentication**: Required with files:write scope
- **Content-Type**: multipart/form-data
- **Request Body**:
```json
{
  "file": <file>,
  "type": "avatar|document|attachment",
  "metadata": {
    "description": "Profile photo",
    "tags": ["profile", "avatar"]
  }
}
```

### 2. Validation Process

#### File Validation
```javascript
const fileOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      avatar: ['image/jpeg', 'image/png', 'image/gif'],
      document: ['application/pdf', 'application/msword'],
      attachment: ['*/*']
    };
    
    const allowed = allowedTypes[req.body.type].includes(file.mimetype) ||
                   allowedTypes[req.body.type].includes('*/*');
                   
    cb(null, allowed);
  }
};
```

#### Security Checks
1. **File Content**
   - Virus scanning
   - MIME type validation
   - File extension check
   - Content analysis

2. **Storage Quotas**
   - User quota check
   - Tenant quota check
   - Storage availability
   - Rate limiting

### 3. File Processing

#### Image Processing
```javascript
async function processImage(file, options) {
  const image = sharp(file.buffer);
  
  // Generate thumbnails
  const thumbnail = await image
    .resize(200, 200, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
    
  // Optimize original
  const optimized = await image
    .resize(1200, 1200, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();
    
  return { thumbnail, optimized };
}
```

#### Document Processing
1. **PDF Processing**
   - Generate preview
   - Extract metadata
   - Create thumbnails
   - Index content

2. **Office Documents**
   - Convert to PDF
   - Extract text
   - Generate preview
   - Store metadata

### 4. Storage Management

#### S3 Upload
```javascript
async function uploadToS3(file, key, options = {}) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: {
      originalName: file.originalname,
      ...options.metadata
    }
  });

  await s3Client.send(command);
  
  // Generate signed URL
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600 // 1 hour
  });
  
  return { key, url };
}
```

#### Cache Management
```javascript
// Cache file metadata
await redisClient.set(
  `file:${fileId}:metadata`,
  JSON.stringify(metadata),
  'EX',
  3600
);

// Cache file URL
await redisClient.set(
  `file:${fileId}:url`,
  signedUrl,
  'EX',
  3600
);
```

### 5. Database Records

#### File Record
```javascript
const file = await File.create({
  id: uuidv4(),
  userId: req.user.id,
  tenantId: req.tenant.id,
  type: req.body.type,
  name: originalName,
  size: fileSize,
  mimeType: mimetype,
  key: s3Key,
  metadata: req.body.metadata,
  status: 'active'
});
```

#### Audit Trail
```javascript
await SecurityAuditLog.create({
  userId: req.user.id,
  event: 'FILE_UPLOADED',
  details: {
    fileId: file.id,
    type: file.type,
    size: file.size
  },
  severity: 'low'
});
```

## Error Handling

### Common Errors
1. **Validation Errors**
   - File too large
   - Invalid type
   - Malformed file
   - Quota exceeded

2. **Storage Errors**
   - Upload failure
   - S3 errors
   - Processing error
   - Quota exceeded

### Error Responses
```javascript
{
  error: 'FILE_UPLOAD_ERROR',
  message: 'File upload failed',
  details: {
    reason: 'File size exceeds limit',
    limit: '5MB',
    size: '6MB'
  }
}
```

## Monitoring & Logging

### Metrics Collection
1. **Upload Metrics**
   - Upload size
   - Processing time
   - Success rate
   - Error types

2. **Storage Metrics**
   - Space used
   - File counts
   - User quotas
   - Cache hits

### Performance Monitoring
```javascript
const metrics = {
  uploadDuration: Date.now() - startTime,
  processingTime: processEnd - processStart,
  fileSize: file.size,
  cacheHits: cacheStats.hits
};

await metricsCollector.record('file_upload', metrics);
```

## Best Practices

### Security
1. **File Validation**
   - Verify MIME types
   - Scan for viruses
   - Check file content
   - Validate extensions

2. **Access Control**
   - Enforce permissions
   - Check quotas
   - Rate limiting
   - Audit logging

### Performance
1. **Upload Optimization**
   - Chunk uploads
   - Parallel processing
   - Cache management
   - Load balancing

2. **Storage Management**
   - Lifecycle policies
   - Backup strategy
   - Cleanup routines
   - Version control

## API Reference

### Upload File
```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: <file>
- type: "avatar"
- metadata: { "description": "Profile photo" }
```

### Response
```json
{
  "id": "uuid",
  "name": "profile.jpg",
  "url": "https://...",
  "type": "avatar",
  "size": 1048576,
  "createdAt": "2025-02-22T12:00:00Z"
}
```

## Related Documentation
- Storage Configuration Guide
- Security Policies
- Image Processing Guide
- Quota Management
