import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import { config } from '../config';
import { generateUniqueFilename } from '../utils/helpers';
import { FileTooLargeError, InvalidFileTypeError } from '../utils/errors';

/**
 * Local storage configuration for development
 */
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  },
});

/**
 * Memory storage for S3 upload
 */
const memoryStorage = multer.memoryStorage();

/**
 * File filter - validates file type against allowed types
 */
const fileFilter = (allowedTypes: string[]) => {
  return (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    // Check MIME type
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    // Check file extension as fallback
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const mimeFromExt = getMimeFromExtension(ext);

    if (mimeFromExt && allowedTypes.includes(mimeFromExt)) {
      cb(null, true);
      return;
    }

    cb(new InvalidFileTypeError(allowedTypes));
  };
};

/**
 * Get MIME type from file extension
 */
function getMimeFromExtension(ext: string): string | null {
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    zip: 'application/zip',
    txt: 'text/plain',
  };

  return mimeMap[ext] || null;
}

/**
 * Create upload middleware with custom configuration
 */
export function createUploadMiddleware(options?: {
  maxFileSize?: number;
  allowedTypes?: string[];
  useMemoryStorage?: boolean;
}) {
  const maxFileSize = options?.maxFileSize || config.upload.maxFileSize;
  const allowedTypes = options?.allowedTypes || config.upload.allowedFileTypes;
  const storage = options?.useMemoryStorage ? memoryStorage : localStorage;

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: 10, // Maximum 10 files per request
    },
    fileFilter: fileFilter(allowedTypes),
  });
}

/**
 * Default upload middleware for single file
 */
export const uploadSingle = createUploadMiddleware().single('file');

/**
 * Upload middleware for multiple files
 */
export const uploadMultiple = createUploadMiddleware().array('files', 10);

/**
 * Upload middleware for specific fields
 */
export const uploadFields = createUploadMiddleware().fields([
  { name: 'applicationForm', maxCount: 1 },
  { name: 'supportingDocuments', maxCount: 9 },
]);

/**
 * S3 upload middleware (uses memory storage)
 */
export const uploadForS3 = createUploadMiddleware({ useMemoryStorage: true });

/**
 * Handle multer errors
 */
export function handleUploadError(
  error: Error,
  req: Request,
  res: Response,
  next: Function
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      throw new FileTooLargeError(config.upload.maxFileSize);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      throw new Error('Too many files. Maximum 10 files allowed.');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      throw new Error('Unexpected file field.');
    }
  }

  next(error);
}

/**
 * Validate uploaded file
 */
export function validateUploadedFile(
  file: Express.Multer.File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
  }
): void {
  const maxSize = options.maxSize || config.upload.maxFileSize;
  const allowedTypes = options.allowedTypes || config.upload.allowedFileTypes;

  if (file.size > maxSize) {
    throw new FileTooLargeError(maxSize);
  }

  if (!allowedTypes.includes(file.mimetype)) {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const mimeFromExt = getMimeFromExtension(ext);

    if (!mimeFromExt || !allowedTypes.includes(mimeFromExt)) {
      throw new InvalidFileTypeError(allowedTypes);
    }
  }
}

export default {
  createUploadMiddleware,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadForS3,
  handleUploadError,
  validateUploadedFile,
};
