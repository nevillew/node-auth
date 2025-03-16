import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../config/logger';
import { createAppError } from './errorHandler';
import rateLimit from 'express-rate-limit';
import { Result, success, failure, fromPromise } from '../utils/errors';

// Types
export interface FileUploadResult {
  key: string;
  signedUrl: string;
}

interface AllowedFileTypes {
  [mimetype: string]: string[];
}

interface ValidExtensions {
  [mimetype: string]: string[];
}

/**
 * Create S3 client configuration (pure function)
 */
export const createS3Config = (): {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
} => {
  return {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  };
};

/**
 * Create S3 client (pure factory function)
 */
export const createS3Client = (): S3Client => {
  return new S3Client(createS3Config());
};

// Create S3 client instance
const s3 = createS3Client();

/**
 * Define allowed file types and their magic numbers (pure configuration)
 */
export const getAllowedFileTypes = (): AllowedFileTypes => ({
  'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
  'image/png': ['89504e47'],
  'image/gif': ['47494638']
});

/**
 * Define valid file extensions by MIME type (pure configuration)
 */
export const getValidExtensions = (): ValidExtensions => ({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif']
});

/**
 * Get max file size in bytes (pure function)
 */
export const getMaxFileSize = (): number => 5 * 1024 * 1024; // 5MB

/**
 * Malware signatures (pure configuration)
 */
export const getMalwareSignatures = (): string[] => [
  'virus_sig_1',
  'malware_sig_2'
  // Add more signatures as needed
];

/**
 * Sanitize filename (pure function)
 */
export const sanitizeFileName = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Validate file type (pure function)
 */
export const validateFileType = (
  mimetype: string, 
  allowedTypes: AllowedFileTypes
): Result<void> => {
  if (!allowedTypes[mimetype]) {
    return failure({
      message: 'Invalid file type',
      statusCode: 400,
      code: 'INVALID_FILE_TYPE',
      details: {
        allowed: Object.keys(allowedTypes),
        received: mimetype
      }
    });
  }
  
  return success(undefined);
};

/**
 * Validate file size (pure function)
 */
export const validateFileSize = (
  fileSize: number, 
  maxSize: number
): Result<void> => {
  if (fileSize > maxSize) {
    return failure({
      message: 'File too large',
      statusCode: 400,
      code: 'FILE_TOO_LARGE',
      details: {
        maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`,
        received: `${Math.round(fileSize / 1024 / 1024)}MB`
      }
    });
  }
  
  return success(undefined);
};

/**
 * Validate file extension (pure function)
 */
export const validateFileExtension = (
  originalname: string, 
  mimetype: string, 
  validExts: ValidExtensions
): Result<void> => {
  const originalExt = path.extname(originalname).toLowerCase();
  
  if (!validExts[mimetype].includes(originalExt)) {
    return failure({
      message: 'Invalid file extension',
      statusCode: 400,
      code: 'INVALID_FILE_EXTENSION',
      details: {
        allowed: validExts[mimetype],
        received: originalExt
      }
    });
  }
  
  return success(undefined);
};

/**
 * Validate file header (pure function)
 */
export const validateFileHeader = (
  buffer: Buffer, 
  mimetype: string, 
  allowedTypes: AllowedFileTypes
): Result<void> => {
  const fileHeader = buffer.slice(0, 4).toString('hex');
  
  if (!allowedTypes[mimetype].includes(fileHeader)) {
    return failure({
      message: 'File content does not match declared type',
      statusCode: 400,
      code: 'INVALID_FILE_CONTENT'
    });
  }
  
  return success(undefined);
};

/**
 * Scan for malware signatures (pure function)
 */
export const scanForMalware = (
  buffer: Buffer, 
  signatures: string[]
): Result<void> => {
  const fileContent = buffer.toString('hex');
  const hasMalware = signatures.some(sig => fileContent.includes(sig));
  
  if (hasMalware) {
    return failure({
      message: 'File appears to contain malware',
      statusCode: 400,
      code: 'MALWARE_DETECTED'
    });
  }
  
  return success(undefined);
};

/**
 * File filter function for multer (composed from pure validation functions)
 */
export const createFileFilter = () => {
  return (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    // Load configurations 
    const allowedTypes = getAllowedFileTypes();
    const validExts = getValidExtensions();
    const maxSize = getMaxFileSize();
    const malwareSignatures = getMalwareSignatures();
    
    try {
      // 1. Validate file type
      const typeResult = validateFileType(file.mimetype, allowedTypes);
      if (!typeResult.ok) return cb(createAppError(
        typeResult.error.code || 'INVALID_FILE_TYPE', 
        typeResult.error.statusCode, 
        typeResult.error.details
      ));
      
      // 2. Validate file size
      const sizeResult = validateFileSize(file.size, maxSize);
      if (!sizeResult.ok) return cb(createAppError(
        sizeResult.error.code || 'FILE_TOO_LARGE', 
        sizeResult.error.statusCode, 
        sizeResult.error.details
      ));
      
      // 3. Validate file extension
      const extResult = validateFileExtension(file.originalname, file.mimetype, validExts);
      if (!extResult.ok) return cb(createAppError(
        extResult.error.code || 'INVALID_FILE_EXTENSION', 
        extResult.error.statusCode, 
        extResult.error.details
      ));
      
      // 4. Sanitize filename
      const safeName = sanitizeFileName(file.originalname);
      if (safeName !== file.originalname) {
        file.originalname = safeName;
      }
      
      // Remaining validation requires file buffer
      if (!file.buffer) {
        return cb(null, true); // Can't validate buffer, assume OK
      }
      
      // 5. Validate file header
      const headerResult = validateFileHeader(file.buffer, file.mimetype, allowedTypes);
      if (!headerResult.ok) return cb(createAppError(
        headerResult.error.code || 'INVALID_FILE_CONTENT', 
        headerResult.error.statusCode, 
        headerResult.error.details
      ));
      
      // 6. Scan for malware
      const malwareResult = scanForMalware(file.buffer, malwareSignatures);
      if (!malwareResult.ok) return cb(createAppError(
        malwareResult.error.code || 'MALWARE_DETECTED', 
        malwareResult.error.statusCode, 
        malwareResult.error.details
      ));
      
      // All validations passed
      cb(null, true);
    } catch (error) {
      logger.error('File validation error:', error);
      cb(createAppError('FILE_VALIDATION_FAILED', 500));
    }
  };
};

/**
 * Create upload rate limiter (pure factory function)
 */
export const createUploadLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Create multer upload middleware (pure factory function)
 */
export const createUploadMiddleware = () => {
  const storage = multer.memoryStorage();
  
  return multer({
    storage,
    fileFilter: createFileFilter(),
    limits: {
      fileSize: getMaxFileSize(),
      files: 5 // Max 5 files per request
    }
  });
};

// Create middleware
export const upload = createUploadMiddleware();

/**
 * Upload file to S3 (async with Result pattern)
 */
export const uploadToS3 = async (
  file: Express.Multer.File, 
  folder: string, 
  maxAge = 3600
): Promise<Result<FileUploadResult>> => {
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const key = `${folder}/${uuidv4()}${ext}`;
    
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME || '',
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    
    // Upload file
    return fromPromise(s3.send(new PutObjectCommand(uploadParams)))
      .then(async (result) => {
        if (!result.ok) return result;
      
        // Generate signed URL for access
        const signedUrlParams = {
          Bucket: process.env.AWS_BUCKET_NAME || '',
          Key: key
        };
        
        const signedUrl = await getSignedUrl(
          s3, 
          new GetObjectCommand(signedUrlParams), 
          { expiresIn: maxAge }
        );
        
        return success({ key, signedUrl });
      });
  } catch (error) {
    logger.error('S3 upload failed:', error);
    return failure({
      message: 'Failed to upload file',
      statusCode: 500,
      originalError: error instanceof Error ? error : new Error('Upload failed')
    });
  }
};
