import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { config } from '../config';
import { ApplicationFile, FileScanStatus } from '../types';
import { generateUniqueFilename } from '../utils/helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ExternalServiceError } from '../utils/errors';

// Initialize S3 client if configured
const s3Client = config.aws.accessKeyId
  ? new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    })
  : null;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class FileService {
  /**
   * Upload file to S3 or local storage
   */
  static async uploadFile(
    file: Express.Multer.File,
    subPath: string = ''
  ): Promise<{ filename: string; filePath: string }> {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    const filePath = subPath ? `${subPath}/${uniqueFilename}` : uniqueFilename;

    if (s3Client) {
      // Upload to S3
      try {
        const command = new PutObjectCommand({
          Bucket: config.aws.s3BucketName,
          Key: filePath,
          Body: file.buffer || fs.createReadStream(file.path),
          ContentType: file.mimetype,
          Metadata: {
            originalName: file.originalname,
          },
        });

        await s3Client.send(command);

        logger.info('File uploaded to S3', { filename: uniqueFilename, path: filePath });

        // Clean up local file if it exists
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        return { filename: uniqueFilename, filePath };
      } catch (error) {
        logger.error('S3 upload failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new ExternalServiceError('S3', 'Failed to upload file');
      }
    } else {
      // Store locally
      const localDir = path.join(UPLOAD_DIR, subPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const localPath = path.join(localDir, uniqueFilename);

      if (file.buffer) {
        fs.writeFileSync(localPath, file.buffer);
      } else if (file.path && file.path !== localPath) {
        fs.renameSync(file.path, localPath);
      }

      logger.info('File stored locally', { filename: uniqueFilename, path: localPath });

      return { filename: uniqueFilename, filePath };
    }
  }

  /**
   * Get file from S3 or local storage
   */
  static async getFile(filePath: string): Promise<Buffer> {
    if (s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: config.aws.s3BucketName,
          Key: filePath,
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
          throw new NotFoundError('File', filePath);
        }

        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }

        return Buffer.concat(chunks);
      } catch (error) {
        if ((error as any).name === 'NoSuchKey') {
          throw new NotFoundError('File', filePath);
        }
        throw new ExternalServiceError('S3', 'Failed to retrieve file');
      }
    } else {
      const localPath = path.join(UPLOAD_DIR, filePath);

      if (!fs.existsSync(localPath)) {
        throw new NotFoundError('File', filePath);
      }

      return fs.readFileSync(localPath);
    }
  }

  /**
   * Get signed URL for file download (S3 only)
   */
  static async getSignedDownloadUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (!s3Client) {
      // For local storage, return a relative path
      return `/api/v1/files/${encodeURIComponent(filePath)}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: filePath,
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ExternalServiceError('S3', 'Failed to generate download URL');
    }
  }

  /**
   * Delete file from S3 or local storage
   */
  static async deleteFile(filePath: string): Promise<void> {
    if (s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: config.aws.s3BucketName,
          Key: filePath,
        });

        await s3Client.send(command);
        logger.info('File deleted from S3', { path: filePath });
      } catch (error) {
        logger.error('Failed to delete file from S3', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - file might already be deleted
      }
    } else {
      const localPath = path.join(UPLOAD_DIR, filePath);

      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logger.info('File deleted locally', { path: localPath });
      }
    }
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    if (s3Client) {
      try {
        const command = new HeadObjectCommand({
          Bucket: config.aws.s3BucketName,
          Key: filePath,
        });

        await s3Client.send(command);
        return true;
      } catch {
        return false;
      }
    } else {
      const localPath = path.join(UPLOAD_DIR, filePath);
      return fs.existsSync(localPath);
    }
  }

  /**
   * Create ZIP archive of multiple files
   */
  static async createZipArchive(
    files: Array<{ name: string; path: string }>,
    outputPath?: string
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const chunks: Buffer[] = [];

      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      for (const file of files) {
        try {
          const fileBuffer = await this.getFile(file.path);
          archive.append(fileBuffer, { name: file.name });
        } catch (error) {
          logger.warn('Failed to add file to archive', {
            path: file.path,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      await archive.finalize();
    });
  }

  /**
   * Create ZIP archive of application files
   */
  static async createApplicationZip(
    applicationRef: string,
    files: ApplicationFile[]
  ): Promise<Buffer> {
    const archiveFiles = files.map((f) => ({
      name: f.original_filename,
      path: f.file_path,
    }));

    return this.createZipArchive(archiveFiles);
  }

  /**
   * Placeholder for virus scanning
   * In production, integrate with ClamAV or a cloud scanning service
   */
  static async scanFile(filePath: string): Promise<FileScanStatus> {
    // TODO: Implement actual virus scanning
    // For now, return CLEAN after a simulated delay
    logger.info('Virus scan requested (simulated)', { path: filePath });

    // Simulate scan time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In production, return based on actual scan results
    return FileScanStatus.CLEAN;
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(
    filePath: string
  ): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
    if (s3Client) {
      try {
        const command = new HeadObjectCommand({
          Bucket: config.aws.s3BucketName,
          Key: filePath,
        });

        const response = await s3Client.send(command);

        return {
          size: response.ContentLength || 0,
          contentType: response.ContentType || 'application/octet-stream',
          lastModified: response.LastModified || new Date(),
        };
      } catch {
        return null;
      }
    } else {
      const localPath = path.join(UPLOAD_DIR, filePath);

      if (!fs.existsSync(localPath)) {
        return null;
      }

      const stats = fs.statSync(localPath);
      return {
        size: stats.size,
        contentType: 'application/octet-stream',
        lastModified: stats.mtime,
      };
    }
  }

  /**
   * Get local upload directory
   */
  static getUploadDir(): string {
    return UPLOAD_DIR;
  }

  /**
   * Check if S3 is configured
   */
  static isS3Configured(): boolean {
    return s3Client !== null;
  }
}

export default FileService;
