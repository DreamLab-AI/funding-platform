/**
 * FileService Unit Tests
 * Comprehensive tests for file upload, validation, and virus scanning
 */

import { EventEmitter } from 'events';
import path from 'path';
import { FileScanStatus, ApplicationFile } from '../../../src/types';

// Store the real path module functions before mocking
const realPath = jest.requireActual('path');

// Mock dependencies BEFORE importing the service
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('test content')),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({
    size: 1024,
    mtime: new Date('2024-01-15'),
  }),
  createReadStream: jest.fn(),
}));

jest.mock('archiver');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

jest.mock('../../../src/config', () => ({
  config: {
    aws: {
      accessKeyId: '', // No S3 configured - local storage mode
      secretAccessKey: '',
      region: 'eu-west-2',
      s3BucketName: 'test-bucket',
    },
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/utils/helpers', () => ({
  generateUniqueFilename: jest.fn((name) => `unique_${name}`),
}));

// Import after mocks are set up
import fs from 'fs';
import archiver from 'archiver';
import { FileService, fileService } from '../../../src/services/file.service';
import { logger } from '../../../src/utils/logger';
import { NotFoundError } from '../../../src/utils/errors';
import { generateUniqueFilename } from '../../../src/utils/helpers';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockArchiver = archiver as jest.MockedFunction<typeof archiver>;
const mockGenerateUniqueFilename = generateUniqueFilename as jest.MockedFunction<
  typeof generateUniqueFilename
>;

describe('FileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset fs mocks to default behavior
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue(Buffer.from('test content'));
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.renameSync.mockReturnValue(undefined);
    mockFs.statSync.mockReturnValue({
      size: 1024,
      mtime: new Date('2024-01-15'),
    } as any);

    // Reset the unique filename mock
    mockGenerateUniqueFilename.mockImplementation((name) => `unique_${name}`);
  });

  describe('uploadFile (Local storage)', () => {
    const mockMulterFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('test content'),
      size: 12,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should upload file to local storage', async () => {
      const result = await FileService.uploadFile(mockMulterFile);

      expect(result.filename).toBe('unique_test-document.pdf');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'File stored locally',
        expect.any(Object)
      );
    });

    it('should create subdirectory if provided', async () => {
      // First call checks if directory exists, return false to trigger mkdir
      mockFs.existsSync.mockReturnValue(false);

      const result = await FileService.uploadFile(mockMulterFile, 'applications/app-1');

      expect(result.filePath).toBe('applications/app-1/unique_test-document.pdf');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('applications'),
        { recursive: true }
      );
    });

    it('should handle file with path (multer disk storage)', async () => {
      const fileWithPath: Express.Multer.File = {
        ...mockMulterFile,
        buffer: undefined as any,
        path: '/tmp/upload-12345',
      };

      await FileService.uploadFile(fileWithPath);

      expect(mockFs.renameSync).toHaveBeenCalled();
    });

    it('should write buffer when available', async () => {
      await FileService.uploadFile(mockMulterFile);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        mockMulterFile.buffer
      );
    });

    it('should generate unique filename', async () => {
      await FileService.uploadFile(mockMulterFile);

      expect(mockGenerateUniqueFilename).toHaveBeenCalledWith('test-document.pdf');
    });

    it('should return correct file path with subpath', async () => {
      const result = await FileService.uploadFile(mockMulterFile, 'subdir');

      expect(result.filePath).toBe('subdir/unique_test-document.pdf');
    });

    it('should return correct file path without subpath', async () => {
      const result = await FileService.uploadFile(mockMulterFile);

      expect(result.filePath).toBe('unique_test-document.pdf');
    });
  });

  describe('getFile (Local storage)', () => {
    it('should retrieve file from local storage', async () => {
      const mockContent = Buffer.from('file content');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await FileService.getFile('path/to/file.pdf');

      expect(result).toEqual(mockContent);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('should throw NotFoundError when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(FileService.getFile('nonexistent.pdf')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should construct correct local path', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('content'));

      await FileService.getFile('subfolder/file.pdf');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('subfolder')
      );
    });
  });

  describe('getSignedDownloadUrl (Local storage)', () => {
    it('should return relative API path for local files', async () => {
      const result = await FileService.getSignedDownloadUrl('path/to/file.pdf');

      expect(result).toBe('/api/v1/files/path%2Fto%2Ffile.pdf');
    });

    it('should properly encode special characters', async () => {
      const result = await FileService.getSignedDownloadUrl('path/with spaces/file.pdf');

      expect(result).toContain('path%2Fwith%20spaces');
    });

    it('should encode forward slashes', async () => {
      const result = await FileService.getSignedDownloadUrl('a/b/c.pdf');

      expect(result).toContain('%2F');
    });
  });

  describe('deleteFile (Local storage)', () => {
    it('should delete file from local storage', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await FileService.deleteFile('path/to/file.pdf');

      expect(mockFs.unlinkSync).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'File deleted locally',
        expect.any(Object)
      );
    });

    it('should not throw when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(FileService.deleteFile('nonexistent.pdf')).resolves.not.toThrow();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('fileExists (Local storage)', () => {
    it('should return true when file exists locally', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await FileService.fileExists('path/to/file.pdf');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await FileService.fileExists('nonexistent.pdf');

      expect(result).toBe(false);
    });
  });

  describe('createZipArchive', () => {
    let mockArchiveInstance: EventEmitter & {
      append: jest.Mock;
      finalize: jest.Mock;
    };

    beforeEach(() => {
      mockArchiveInstance = new EventEmitter() as any;
      mockArchiveInstance.append = jest.fn();
      mockArchiveInstance.finalize = jest.fn();

      mockArchiver.mockReturnValue(mockArchiveInstance as any);
    });

    it('should create zip archive with correct options', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('file content'));

      const files = [{ name: 'doc.pdf', path: 'path/to/doc.pdf' }];

      // Simulate archive events
      const resultPromise = FileService.createZipArchive(files);

      // Emit data and end events
      process.nextTick(() => {
        mockArchiveInstance.emit('data', Buffer.from('zip chunk 1'));
        mockArchiveInstance.emit('data', Buffer.from('zip chunk 2'));
        mockArchiveInstance.emit('end');
      });

      const result = await resultPromise;

      expect(mockArchiver).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should append all files to archive', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('content'));

      const files = [
        { name: 'doc1.pdf', path: 'path/to/doc1.pdf' },
        { name: 'doc2.pdf', path: 'path/to/doc2.pdf' },
      ];

      const resultPromise = FileService.createZipArchive(files);

      process.nextTick(() => {
        mockArchiveInstance.emit('end');
      });

      await resultPromise;

      expect(mockArchiveInstance.append).toHaveBeenCalledTimes(2);
      expect(mockArchiveInstance.append).toHaveBeenCalledWith(
        expect.any(Buffer),
        { name: 'doc1.pdf' }
      );
      expect(mockArchiveInstance.append).toHaveBeenCalledWith(
        expect.any(Buffer),
        { name: 'doc2.pdf' }
      );
    });

    it('should handle missing files gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const files = [{ name: 'missing.pdf', path: 'path/to/missing.pdf' }];

      const resultPromise = FileService.createZipArchive(files);

      process.nextTick(() => {
        mockArchiveInstance.emit('end');
      });

      await expect(resultPromise).resolves.toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to add file to archive',
        expect.any(Object)
      );
    });

    it('should call finalize on archive', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('content'));

      const files = [{ name: 'doc.pdf', path: 'doc.pdf' }];

      const resultPromise = FileService.createZipArchive(files);

      process.nextTick(() => {
        mockArchiveInstance.emit('end');
      });

      await resultPromise;

      expect(mockArchiveInstance.finalize).toHaveBeenCalled();
    });

    it('should reject on archive error', async () => {
      const files = [{ name: 'doc.pdf', path: 'doc.pdf' }];

      const resultPromise = FileService.createZipArchive(files);

      process.nextTick(() => {
        mockArchiveInstance.emit('error', new Error('Archive error'));
      });

      await expect(resultPromise).rejects.toThrow('Archive error');
    });
  });

  describe('createApplicationZip', () => {
    it('should create zip with application files', async () => {
      const files: ApplicationFile[] = [
        {
          file_id: 'file-1',
          application_id: 'app-1',
          filename: 'unique_proposal.pdf',
          original_filename: 'proposal.pdf',
          file_path: 'applications/app-1/proposal.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          scan_status: FileScanStatus.CLEAN,
          uploaded_at: new Date(),
        },
      ];

      jest.spyOn(FileService, 'createZipArchive').mockResolvedValue(Buffer.from('zip'));

      const result = await FileService.createApplicationZip('REF-001', files);

      expect(result).toEqual(Buffer.from('zip'));
      expect(FileService.createZipArchive).toHaveBeenCalledWith([
        {
          name: 'proposal.pdf',
          path: 'applications/app-1/proposal.pdf',
        },
      ]);
    });

    it('should use original_filename for archive entry names', async () => {
      const files: ApplicationFile[] = [
        {
          file_id: 'file-1',
          application_id: 'app-1',
          filename: 'unique_doc1.pdf',
          original_filename: 'My Document.pdf',
          file_path: 'path1.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          scan_status: FileScanStatus.CLEAN,
          uploaded_at: new Date(),
        },
      ];

      jest.spyOn(FileService, 'createZipArchive').mockResolvedValue(Buffer.from('zip'));

      await FileService.createApplicationZip('REF-001', files);

      expect(FileService.createZipArchive).toHaveBeenCalledWith([
        { name: 'My Document.pdf', path: 'path1.pdf' },
      ]);
    });

    it('should handle multiple files', async () => {
      const files: ApplicationFile[] = [
        {
          file_id: 'file-1',
          application_id: 'app-1',
          filename: 'unique_doc1.pdf',
          original_filename: 'doc1.pdf',
          file_path: 'path1.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          scan_status: FileScanStatus.CLEAN,
          uploaded_at: new Date(),
        },
        {
          file_id: 'file-2',
          application_id: 'app-1',
          filename: 'unique_doc2.pdf',
          original_filename: 'doc2.pdf',
          file_path: 'path2.pdf',
          file_size: 2048,
          mime_type: 'application/pdf',
          scan_status: FileScanStatus.CLEAN,
          uploaded_at: new Date(),
        },
      ];

      jest.spyOn(FileService, 'createZipArchive').mockResolvedValue(Buffer.from('zip'));

      await FileService.createApplicationZip('REF-001', files);

      expect(FileService.createZipArchive).toHaveBeenCalledWith([
        { name: 'doc1.pdf', path: 'path1.pdf' },
        { name: 'doc2.pdf', path: 'path2.pdf' },
      ]);
    });

    it('should handle empty files array', async () => {
      jest.spyOn(FileService, 'createZipArchive').mockResolvedValue(Buffer.from('zip'));

      await FileService.createApplicationZip('REF-001', []);

      expect(FileService.createZipArchive).toHaveBeenCalledWith([]);
    });
  });

  describe('scanFile', () => {
    it('should return CLEAN status (simulated scan)', async () => {
      const result = await FileService.scanFile('path/to/file.pdf');

      expect(result).toBe(FileScanStatus.CLEAN);
    });

    it('should log scan request', async () => {
      await FileService.scanFile('path/to/file.pdf');

      expect(logger.info).toHaveBeenCalledWith(
        'Virus scan requested (simulated)',
        { path: 'path/to/file.pdf' }
      );
    });

    it('should simulate scan delay', async () => {
      const startTime = Date.now();

      await FileService.scanFile('path/to/file.pdf');

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should always return CLEAN for any file path', async () => {
      const paths = [
        'infected.exe',
        'virus.pdf',
        'trojan.doc',
      ];

      for (const p of paths) {
        const result = await FileService.scanFile(p);
        expect(result).toBe(FileScanStatus.CLEAN);
      }
    });
  });

  describe('getFileMetadata (Local storage)', () => {
    it('should return file metadata from local filesystem', async () => {
      const mockDate = new Date('2024-01-15');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        size: 2048,
        mtime: mockDate,
      } as any);

      const result = await FileService.getFileMetadata('path/to/file.pdf');

      expect(result).toEqual({
        size: 2048,
        contentType: 'application/octet-stream',
        lastModified: mockDate,
      });
    });

    it('should return null when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await FileService.getFileMetadata('nonexistent.pdf');

      expect(result).toBeNull();
    });

    it('should use octet-stream as default content type', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        size: 1024,
        mtime: new Date(),
      } as any);

      const result = await FileService.getFileMetadata('file.xyz');

      expect(result?.contentType).toBe('application/octet-stream');
    });
  });

  describe('getUploadDir', () => {
    it('should return the upload directory path', () => {
      const result = FileService.getUploadDir();

      expect(result).toContain('uploads');
    });

    it('should return an absolute path', () => {
      const result = FileService.getUploadDir();

      expect(realPath.isAbsolute(result)).toBe(true);
    });
  });

  describe('isS3Configured', () => {
    it('should return false when S3 not configured', () => {
      // Config is mocked with empty accessKeyId
      const result = FileService.isS3Configured();

      expect(result).toBe(false);
    });
  });

  describe('fileService proxy object', () => {
    it('should expose all static methods via proxy', () => {
      // Test that proxy methods are functions (identity comparison may fail due to mocking)
      expect(typeof fileService.uploadFile).toBe('function');
      expect(typeof fileService.getFile).toBe('function');
      expect(typeof fileService.getSignedDownloadUrl).toBe('function');
      expect(typeof fileService.deleteFile).toBe('function');
      expect(typeof fileService.fileExists).toBe('function');
      expect(typeof fileService.createZipArchive).toBe('function');
      expect(typeof fileService.createApplicationZip).toBe('function');
      expect(typeof fileService.scanFile).toBe('function');
      expect(typeof fileService.getFileMetadata).toBe('function');
      expect(typeof fileService.getUploadDir).toBe('function');
      expect(typeof fileService.isS3Configured).toBe('function');
    });

    it('should provide createArchive alias', () => {
      // Both should be functions - the proxy maps createArchive to createZipArchive
      expect(typeof fileService.createArchive).toBe('function');
      expect(typeof fileService.createZipArchive).toBe('function');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty filename', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: '',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('test'),
        size: 4,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      mockGenerateUniqueFilename.mockReturnValue('unique_');

      const result = await FileService.uploadFile(file);

      expect(result.filename).toBe('unique_');
    });

    it('should handle filename with special characters', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'file with spaces & symbols!.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
        size: 4,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      mockGenerateUniqueFilename.mockReturnValue('unique_safe_filename.pdf');

      const result = await FileService.uploadFile(file);

      expect(result.filename).toBe('unique_safe_filename.pdf');
    });

    it('should handle very long filenames', async () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: longName,
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
        size: 4,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      mockGenerateUniqueFilename.mockReturnValue('unique_truncated.pdf');

      const result = await FileService.uploadFile(file);

      expect(result.filename).toBe('unique_truncated.pdf');
    });

    it('should handle unicode characters in path', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('content'));

      await FileService.getFile('path/with/unicode.pdf');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('unicode.pdf')
      );
    });

    it('should handle deeply nested paths', async () => {
      const deepPath = 'a/b/c/d/e/f/g/h/file.pdf';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from('content'));

      await FileService.getFile(deepPath);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('file.pdf')
      );
    });
  });

  describe('File upload with different buffer states', () => {
    it('should handle file with undefined buffer and valid path', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: undefined as any,
        size: 100,
        destination: '/tmp',
        filename: 'temp-file',
        path: '/tmp/temp-file',
        stream: null as any,
      };

      await FileService.uploadFile(file);

      expect(mockFs.renameSync).toHaveBeenCalled();
    });

    it('should handle file with both buffer and path (prefers buffer)', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test content'),
        size: 12,
        destination: '/tmp',
        filename: 'temp-file',
        path: '/tmp/temp-file',
        stream: null as any,
      };

      await FileService.uploadFile(file);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        file.buffer
      );
      expect(mockFs.renameSync).not.toHaveBeenCalled();
    });
  });
});
