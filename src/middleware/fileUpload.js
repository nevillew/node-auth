const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../config/logger');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
    'image/png': ['89504e47'],
    'image/gif': ['47494638']
  };
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  // Validate file type
  if (!allowedTypes[file.mimetype]) {
    return cb(new AppError('INVALID_FILE_TYPE', 400, {
      allowed: Object.keys(allowedTypes),
      received: file.mimetype
    }));
  }

  // Validate file size
  if (file.size > maxSize) {
    return cb(new AppError('FILE_TOO_LARGE', 400, {
      maxSize: '5MB',
      received: `${Math.round(file.size / 1024 / 1024)}MB`
    }));
  }

  // Validate file name and extension
  const originalExt = path.extname(file.originalname).toLowerCase();
  const validExts = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif']
  };

  if (!validExts[file.mimetype].includes(originalExt)) {
    return cb(new AppError('INVALID_FILE_EXTENSION', 400, {
      allowed: validExts[file.mimetype],
      received: originalExt
    }));
  }

  // Sanitize filename
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (safeName !== file.originalname) {
    file.originalname = safeName;
  }

  // Scan file content
  const fileHeader = file.buffer.slice(0, 4).toString('hex');
  if (!allowedTypes[file.mimetype].includes(fileHeader)) {
    return cb(new AppError('INVALID_FILE_CONTENT', 400, {
      error: 'File content does not match declared type'
    }));
  }

  // Scan for malware signatures
  const malwareSignatures = [
    'virus_sig_1',
    'malware_sig_2'
    // Add more signatures as needed
  ];

  const fileContent = file.buffer.toString('hex');
  const hasMalware = malwareSignatures.some(sig => fileContent.includes(sig));
  
  if (hasMalware) {
    return cb(new AppError('MALWARE_DETECTED', 400, {
      error: 'File appears to contain malware'
    }));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const uploadToS3 = async (file, folder, maxAge = 3600) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${uuidv4()}${ext}`;
  
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  try {
    // Upload file
    await s3.send(new PutObjectCommand(uploadParams));
    
    // Generate signed URL for access
    const signedUrlParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Expires: 3600 // 1 hour
    };
    
    const signedUrl = await getSignedUrl(s3, new GetObjectCommand(signedUrlParams), {
      expiresIn: maxAge
    });
    return { key, signedUrl };
  } catch (error) {
    logger.error('S3 upload failed:', error);
    throw new Error('Failed to upload file');
  }
};

module.exports = {
  upload,
  uploadToS3
};
