/**
 * File Validation Middleware
 * Validates file uploads for type, size, and virus scanning
 * Aligned with PRD FR-011: Upload validation requirements
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { FILE_UPLOAD_CONFIG } from '../config/security';
import { FileValidationResult } from '../types/security.types';
import { auditService, AuditContext } from '../security/audit.service';
import { AuditAction } from '../types/security.types';

/**
 * File magic bytes for type verification
 */
const FILE_SIGNATURES: Record<string, { signature: number[]; offset: number }[]> = {
  'application/pdf': [{ signature: [0x25, 0x50, 0x44, 0x46], offset: 0 }], // %PDF
  'image/jpeg': [{ signature: [0xff, 0xd8, 0xff], offset: 0 }],
  'image/png': [{ signature: [0x89, 0x50, 0x4e, 0x47], offset: 0 }],
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }, // GIF89a
  ],
  'application/zip': [{ signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 }],
  'video/mp4': [
    { signature: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp at offset 4
  ],
  // MS Office formats (OOXML)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 }, // ZIP header
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  ],
  // Old MS Office formats
  'application/msword': [{ signature: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  'application/vnd.ms-excel': [{ signature: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  'application/vnd.ms-powerpoint': [{ signature: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
};

/**
 * Dangerous file patterns
 */
const DANGEROUS_PATTERNS = [
  /\.exe$/i,
  /\.dll$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.sh$/i,
  /\.ps1$/i,
  /\.vbs$/i,
  /\.js$/i, // Can be dangerous in certain contexts
  /\.jar$/i,
  /\.msi$/i,
  /\.scr$/i,
  /\.pif$/i,
  /\.com$/i,
  /\.hta$/i,
];

/**
 * File info interface
 */
interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

/**
 * Virus scan result
 */
interface VirusScanResult {
  clean: boolean;
  virusName?: string;
  error?: string;
}

/**
 * File Validator class
 */
export class FileValidator {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly allowedExtensions: string[];
  private readonly virusScanEnabled: boolean;

  constructor(config?: Partial<typeof FILE_UPLOAD_CONFIG>) {
    const effectiveConfig = { ...FILE_UPLOAD_CONFIG, ...config };
    this.maxFileSize = effectiveConfig.maxFileSize;
    this.allowedMimeTypes = effectiveConfig.allowedMimeTypes;
    this.allowedExtensions = effectiveConfig.allowedExtensions;
    this.virusScanEnabled = effectiveConfig.virusScan.enabled;
  }

  /**
   * Validate a file upload
   */
  async validate(file: FileInfo, auditContext?: AuditContext): Promise<FileValidationResult> {
    const errors: string[] = [];
    const extension = path.extname(file.originalName).toLowerCase();

    // Size validation
    if (file.size > this.maxFileSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed (${this.formatFileSize(this.maxFileSize)})`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Extension validation
    if (!this.allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed. Allowed: ${this.allowedExtensions.join(', ')}`);
    }

    // MIME type validation
    if (!this.allowedMimeTypes.includes(file.mimeType)) {
      errors.push(`File type '${file.mimeType}' is not allowed`);
    }

    // Dangerous file pattern check
    if (this.isDangerousFilename(file.originalName)) {
      errors.push('Potentially dangerous file type detected');
    }

    // Magic bytes verification (if buffer available)
    if (file.buffer) {
      const magicBytesValid = this.verifyMagicBytes(file.buffer, file.mimeType);
      if (!magicBytesValid) {
        errors.push('File content does not match declared type');
      }
    }

    // Double extension check
    if (this.hasDoubleExtension(file.originalName)) {
      errors.push('Double file extensions are not allowed');
    }

    // Path traversal check
    if (this.hasPathTraversal(file.originalName)) {
      errors.push('Invalid filename');
    }

    // Virus scan (if enabled and buffer available)
    let scanStatus: 'pending' | 'clean' | 'infected' | 'error' = 'pending';
    if (this.virusScanEnabled && file.buffer && errors.length === 0) {
      const scanResult = await this.scanForViruses(file.buffer, file.originalName);
      if (!scanResult.clean) {
        errors.push(scanResult.virusName ? `Malware detected: ${scanResult.virusName}` : 'File failed virus scan');
        scanStatus = 'infected';
      } else if (scanResult.error) {
        scanStatus = 'error';
      } else {
        scanStatus = 'clean';
      }
    }

    const result: FileValidationResult = {
      isValid: errors.length === 0,
      errors,
      file: {
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        extension,
      },
      scanStatus,
    };

    // Audit log
    if (auditContext) {
      auditService.logFileOperation(
        auditContext,
        AuditAction.FILE_SCAN,
        this.generateFileId(file),
        {
          filename: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          valid: result.isValid,
          errors: result.errors,
          scanStatus,
        }
      );
    }

    return result;
  }

  /**
   * Check if filename contains dangerous patterns
   */
  isDangerousFilename(filename: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(filename));
  }

  /**
   * Check for double file extensions (e.g., file.pdf.exe)
   */
  hasDoubleExtension(filename: string): boolean {
    const parts = filename.split('.');
    if (parts.length <= 2) return false;

    // Check if any middle part looks like an extension
    const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.js', '.vbs'];
    for (let i = 1; i < parts.length - 1; i++) {
      if (dangerousExtensions.includes('.' + parts[i].toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for path traversal attempts
   */
  hasPathTraversal(filename: string): boolean {
    const normalized = path.normalize(filename);
    return (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      normalized !== filename
    );
  }

  /**
   * Verify magic bytes match claimed MIME type
   */
  verifyMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
    const signatures = FILE_SIGNATURES[claimedMimeType];
    if (!signatures) {
      // No signature to verify - allow if in allowed types
      return this.allowedMimeTypes.includes(claimedMimeType);
    }

    for (const sig of signatures) {
      if (buffer.length < sig.offset + sig.signature.length) continue;

      let matches = true;
      for (let i = 0; i < sig.signature.length; i++) {
        if (buffer[sig.offset + i] !== sig.signature[i]) {
          matches = false;
          break;
        }
      }

      if (matches) return true;
    }

    return false;
  }

  /**
   * Scan file for viruses (mock implementation - replace with ClamAV in production)
   */
  async scanForViruses(buffer: Buffer, filename: string): Promise<VirusScanResult> {
    // In production, integrate with ClamAV or a cloud scanning service
    // Example ClamAV integration:
    // const clamav = require('clamav.js');
    // const result = await clamav.scan(buffer);

    // Mock implementation - check for EICAR test file
    const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 100));

    if (content.includes(eicarSignature) || filename.toLowerCase().includes('eicar')) {
      return {
        clean: false,
        virusName: 'EICAR-Test-File',
      };
    }

    // Check for obvious malicious patterns
    const maliciousPatterns = [
      /eval\s*\(/i,
      /document\.write/i,
      /<script[^>]*>/i,
      /base64_decode/i,
      /shell_exec/i,
      /exec\s*\(/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        return {
          clean: false,
          virusName: 'Suspicious-Content',
        };
      }
    }

    return { clean: true };
  }

  /**
   * Generate a unique file ID
   */
  private generateFileId(file: FileInfo): string {
    const hash = crypto
      .createHash('md5')
      .update(`${file.originalName}-${file.size}-${Date.now()}`)
      .digest('hex')
      .substring(0, 12);
    return `file_${hash}`;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get allowed file types summary
   */
  getAllowedTypes(): { extensions: string[]; mimeTypes: string[] } {
    return {
      extensions: [...this.allowedExtensions],
      mimeTypes: [...this.allowedMimeTypes],
    };
  }
}

// Export singleton instance
export const fileValidator = new FileValidator();

/**
 * Express-compatible middleware
 */
export function createFileValidationMiddleware(
  config?: Partial<typeof FILE_UPLOAD_CONFIG>
) {
  const validator = new FileValidator(config);

  return async function fileValidationMiddleware(
    req: {
      file?: FileInfo;
      files?: FileInfo[];
      ip: string;
      user?: { id: string };
      headers: Record<string, string | string[] | undefined>;
    },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
    },
    next: () => void
  ): Promise<void> {
    const auditContext: AuditContext = {
      ipAddress: req.ip,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
      user: req.user ? { sub: req.user.id } as any : undefined,
    };

    const filesToValidate: FileInfo[] = [];

    if (req.file) {
      filesToValidate.push(req.file);
    }

    if (req.files) {
      filesToValidate.push(...req.files);
    }

    if (filesToValidate.length === 0) {
      next();
      return;
    }

    // Validate all files
    const results = await Promise.all(
      filesToValidate.map((file) => validator.validate(file, auditContext))
    );

    const invalidResults = results.filter((r) => !r.isValid);

    if (invalidResults.length > 0) {
      const allErrors = invalidResults.flatMap((r) => r.errors);
      res.status(400).json({
        error: 'File Validation Failed',
        message: 'One or more files failed validation',
        details: allErrors,
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured middleware
 */
export const fileValidationMiddleware = createFileValidationMiddleware();

export default FileValidator;
