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
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  // Validate file type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'), false);
  }

  // Validate file size
  if (file.size > maxSize) {
    return cb(new Error('File too large. Maximum size is 5MB.'), false);
  }

  // Validate file name
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (safeName !== file.originalname) {
    file.originalname = safeName;
  }

  // Scan file content
  const fileHeader = file.buffer.slice(0, 4).toString('hex');
  const validHeaders = {
    'ffd8ffe0': 'image/jpeg',
    '89504e47': 'image/png',
    '47494638': 'image/gif'
  };

  if (!validHeaders[fileHeader]) {
    return cb(new Error('Invalid file content'), false);
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
