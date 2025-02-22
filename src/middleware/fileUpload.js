const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const uploadToS3 = async (file, folder) => {
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
    
    const signedUrl = await getSignedUrl(s3, new GetObjectCommand(signedUrlParams));
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
