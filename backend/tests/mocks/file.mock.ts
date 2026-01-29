/**
 * File System and S3 Mock
 * Mock utilities for file operations and S3 storage
 */

import { Readable } from 'stream';

export interface MockFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream?: Readable;
  destination?: string;
  filename?: string;
  path?: string;
}

export interface MockS3Object {
  Key: string;
  Body: Buffer | string;
  ContentType: string;
  ContentLength: number;
  LastModified: Date;
  ETag: string;
  Metadata?: Record<string, string>;
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(overrides: Partial<MockFile> = {}): MockFile {
  const content = overrides.buffer || Buffer.from('test file content');

  return {
    fieldname: 'file',
    originalname: 'test-document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: content.length,
    buffer: content,
    ...overrides,
  };
}

/**
 * Create mock Multer instance
 */
export function createMockMulter() {
  return {
    single: jest.fn().mockImplementation((fieldName: string) => {
      return (req: any, res: any, next: any) => {
        req.file = createMockFile({ fieldname: fieldName });
        next();
      };
    }),

    array: jest.fn().mockImplementation((fieldName: string, maxCount?: number) => {
      return (req: any, res: any, next: any) => {
        req.files = [createMockFile({ fieldname: fieldName })];
        next();
      };
    }),

    fields: jest.fn().mockImplementation((fields: Array<{ name: string; maxCount?: number }>) => {
      return (req: any, res: any, next: any) => {
        req.files = {};
        fields.forEach(field => {
          (req.files as Record<string, MockFile[]>)[field.name] = [
            createMockFile({ fieldname: field.name }),
          ];
        });
        next();
      };
    }),

    none: jest.fn().mockImplementation(() => {
      return (req: any, res: any, next: any) => next();
    }),

    any: jest.fn().mockImplementation(() => {
      return (req: any, res: any, next: any) => {
        req.files = [createMockFile()];
        next();
      };
    }),
  };
}

/**
 * Create mock S3 client
 */
export function createMockS3Client() {
  const storage = new Map<string, MockS3Object>();

  return {
    send: jest.fn().mockImplementation(async (command: any) => {
      const commandName = command.constructor.name;

      switch (commandName) {
        case 'PutObjectCommand':
          const putKey = command.input.Key;
          storage.set(putKey, {
            Key: putKey,
            Body: command.input.Body,
            ContentType: command.input.ContentType || 'application/octet-stream',
            ContentLength: command.input.Body?.length || 0,
            LastModified: new Date(),
            ETag: `"mock-etag-${Date.now()}"`,
            Metadata: command.input.Metadata,
          });
          return {
            ETag: `"mock-etag-${Date.now()}"`,
            VersionId: `mock-version-${Date.now()}`,
          };

        case 'GetObjectCommand':
          const getKey = command.input.Key;
          const obj = storage.get(getKey);
          if (!obj) {
            const error = new Error('NoSuchKey');
            (error as any).name = 'NoSuchKey';
            (error as any).$metadata = { httpStatusCode: 404 };
            throw error;
          }
          return {
            Body: {
              transformToByteArray: async () => obj.Body,
              transformToString: async () => obj.Body.toString(),
            },
            ContentType: obj.ContentType,
            ContentLength: obj.ContentLength,
            LastModified: obj.LastModified,
            ETag: obj.ETag,
            Metadata: obj.Metadata,
          };

        case 'DeleteObjectCommand':
          const deleteKey = command.input.Key;
          storage.delete(deleteKey);
          return { DeleteMarker: true };

        case 'HeadObjectCommand':
          const headKey = command.input.Key;
          const headObj = storage.get(headKey);
          if (!headObj) {
            const error = new Error('NotFound');
            (error as any).name = 'NotFound';
            (error as any).$metadata = { httpStatusCode: 404 };
            throw error;
          }
          return {
            ContentType: headObj.ContentType,
            ContentLength: headObj.ContentLength,
            LastModified: headObj.LastModified,
            ETag: headObj.ETag,
            Metadata: headObj.Metadata,
          };

        case 'ListObjectsV2Command':
          const prefix = command.input.Prefix || '';
          const objects = Array.from(storage.values()).filter(obj =>
            obj.Key.startsWith(prefix)
          );
          return {
            Contents: objects.map(obj => ({
              Key: obj.Key,
              LastModified: obj.LastModified,
              ETag: obj.ETag,
              Size: obj.ContentLength,
            })),
            KeyCount: objects.length,
            IsTruncated: false,
          };

        case 'CopyObjectCommand':
          const sourceKey = command.input.CopySource?.split('/').slice(1).join('/');
          const destKey = command.input.Key;
          const sourceObj = storage.get(sourceKey || '');
          if (sourceObj) {
            storage.set(destKey, { ...sourceObj, Key: destKey });
          }
          return { CopyObjectResult: { ETag: sourceObj?.ETag } };

        default:
          return {};
      }
    }),

    // Test utilities
    getStorage: () => storage,
    clearStorage: () => storage.clear(),
    getObject: (key: string) => storage.get(key),
    hasObject: (key: string) => storage.has(key),
    getObjectCount: () => storage.size,
  };
}

/**
 * Create mock presigned URL generator
 */
export function createMockPresigner() {
  return {
    getSignedUrl: jest.fn().mockImplementation(async (client: any, command: any, options?: any) => {
      const key = command.input?.Key || 'unknown';
      const expiresIn = options?.expiresIn || 3600;
      return `https://mock-bucket.s3.amazonaws.com/${key}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock-signature`;
    }),
  };
}

/**
 * Create mock file system operations
 */
export function createMockFileSystem() {
  const files = new Map<string, Buffer>();
  const directories = new Set<string>();

  return {
    readFile: jest.fn().mockImplementation(async (path: string) => {
      const content = files.get(path);
      if (!content) {
        const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      return content;
    }),

    writeFile: jest.fn().mockImplementation(async (path: string, data: Buffer | string) => {
      files.set(path, Buffer.isBuffer(data) ? data : Buffer.from(data));
    }),

    unlink: jest.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) {
        const error = new Error(`ENOENT: no such file or directory, unlink '${path}'`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      files.delete(path);
    }),

    mkdir: jest.fn().mockImplementation(async (path: string, options?: { recursive?: boolean }) => {
      directories.add(path);
    }),

    rmdir: jest.fn().mockImplementation(async (path: string) => {
      directories.delete(path);
    }),

    readdir: jest.fn().mockImplementation(async (path: string) => {
      return Array.from(files.keys())
        .filter(f => f.startsWith(path))
        .map(f => f.replace(path + '/', '').split('/')[0]);
    }),

    stat: jest.fn().mockImplementation(async (path: string) => {
      if (files.has(path)) {
        const content = files.get(path)!;
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: content.length,
          mtime: new Date(),
        };
      }
      if (directories.has(path)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          size: 0,
          mtime: new Date(),
        };
      }
      const error = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      (error as any).code = 'ENOENT';
      throw error;
    }),

    exists: jest.fn().mockImplementation(async (path: string) => {
      return files.has(path) || directories.has(path);
    }),

    createReadStream: jest.fn().mockImplementation((path: string) => {
      const content = files.get(path);
      if (!content) {
        const error = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      return Readable.from(content);
    }),

    // Test utilities
    getFiles: () => files,
    clearFiles: () => { files.clear(); directories.clear(); },
    setFile: (path: string, content: Buffer | string) => {
      files.set(path, Buffer.isBuffer(content) ? content : Buffer.from(content));
    },
  };
}

/**
 * Create mock file for different types
 */
export const mockFileTypes = {
  pdf: () => createMockFile({
    originalname: 'document.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock pdf content'),
  }),

  image: () => createMockFile({
    originalname: 'image.png',
    mimetype: 'image/png',
    buffer: Buffer.from('PNG mock image content'),
  }),

  excel: () => createMockFile({
    originalname: 'spreadsheet.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('PK mock xlsx content'),
  }),

  word: () => createMockFile({
    originalname: 'document.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('PK mock docx content'),
  }),

  csv: () => createMockFile({
    originalname: 'data.csv',
    mimetype: 'text/csv',
    buffer: Buffer.from('name,email\nJohn,john@test.com'),
  }),

  json: () => createMockFile({
    originalname: 'data.json',
    mimetype: 'application/json',
    buffer: Buffer.from(JSON.stringify({ test: true })),
  }),

  text: () => createMockFile({
    originalname: 'readme.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from('Plain text content'),
  }),

  zip: () => createMockFile({
    originalname: 'archive.zip',
    mimetype: 'application/zip',
    buffer: Buffer.from('PK mock zip content'),
  }),
};

export default {
  createMockFile,
  createMockMulter,
  createMockS3Client,
  createMockPresigner,
  createMockFileSystem,
  mockFileTypes,
};
