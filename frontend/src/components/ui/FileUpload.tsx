// =============================================================================
// FileUpload Component - Funding Application Platform
// Drag-and-drop file upload with preview and progress
// =============================================================================

import {
  useCallback,
  useState,
  useRef,
  ReactNode,
  DragEvent,
  ChangeEvent,
  HTMLAttributes,
} from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  preview?: string;
}

export interface FileUploadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Called when files are selected */
  onFilesSelected?: (files: File[]) => void;
  /** Called when upload is triggered */
  onUpload?: (file: File) => Promise<void>;
  /** Called when a file is removed */
  onRemove?: (file: UploadedFile) => void;
  /** Currently uploaded files */
  files?: UploadedFile[];
  /** Allowed file types (e.g., ['.pdf', '.doc']) */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Allow multiple files */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom dropzone content */
  children?: ReactNode;
  /** Show file previews */
  showPreviews?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type: string): ReactNode {
  if (type.startsWith('image/')) {
    return (
      <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === 'application/pdf') {
    return (
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type.includes('word') || type.includes('document')) {
    return (
      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (type.includes('sheet') || type.includes('excel')) {
    return (
      <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function validateFile(
  file: File,
  accept?: string[],
  maxSize?: number
): { valid: boolean; error?: string } {
  if (maxSize && file.size > maxSize) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${formatFileSize(maxSize)}.`,
    };
  }

  if (accept && accept.length > 0) {
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const fileType = file.type;

    const isValidType = accept.some((type) => {
      if (type.startsWith('.')) {
        return fileExt === type.toLowerCase();
      }
      if (type.endsWith('/*')) {
        return fileType.startsWith(type.replace('/*', '/'));
      }
      return fileType === type;
    });

    if (!isValidType) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${accept.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// FileUpload Component
// -----------------------------------------------------------------------------

export function FileUpload({
  onFilesSelected,
  onUpload,
  onRemove,
  files = [],
  accept = [],
  maxSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 10,
  multiple = true,
  disabled = false,
  children,
  showPreviews = true,
  compact = false,
  error: externalError,
  helperText,
  className,
  ...props
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const error = externalError || internalError;

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      setInternalError(null);
      const newFiles: File[] = [];

      const remainingSlots = maxFiles - files.length;
      if (remainingSlots <= 0) {
        setInternalError(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      const filesToProcess = Array.from(fileList).slice(0, remainingSlots);

      for (const file of filesToProcess) {
        const validation = validateFile(file, accept, maxSize);
        if (!validation.valid) {
          setInternalError(validation.error || 'Invalid file');
          continue;
        }
        newFiles.push(file);
      }

      if (newFiles.length > 0) {
        onFilesSelected?.(newFiles);

        // If onUpload is provided, start uploading immediately
        if (onUpload) {
          newFiles.forEach((file) => {
            onUpload(file).catch((err) => {
              setInternalError(err.message || 'Upload failed');
            });
          });
        }
      }
    },
    [disabled, files.length, maxFiles, accept, maxSize, onFilesSelected, onUpload]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      // Reset input value to allow selecting the same file again
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [processFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled]
  );

  const acceptString = accept.length > 0 ? accept.join(',') : undefined;

  return (
    <div className={clsx('space-y-4', className)} {...props}>
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={clsx(
          'relative border-2 border-dashed rounded-lg transition-all duration-150',
          compact ? 'p-4' : 'p-8',
          'text-center cursor-pointer',
          'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#ffdd00]',
          isDragging && 'border-primary-500 bg-primary-50',
          error
            ? 'border-red-300 bg-red-50'
            : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        )}
        aria-disabled={disabled}
        aria-describedby={error ? 'upload-error' : helperText ? 'upload-help' : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileInput}
          className="sr-only"
          aria-hidden="true"
        />

        {children || (
          <div className="space-y-2">
            <svg
              className={clsx(
                'mx-auto',
                compact ? 'h-10 w-10' : 'h-12 w-12',
                isDragging ? 'text-primary-500' : 'text-gray-400'
              )}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {isDragging ? (
              <p className="text-primary-600 font-medium">Drop files here...</p>
            ) : (
              <>
                <p className={clsx('text-gray-600', compact && 'text-sm')}>
                  <span className="text-primary-600 font-medium hover:text-primary-700">
                    Click to upload
                  </span>{' '}
                  or drag and drop
                </p>
                <p className="text-sm text-gray-500">
                  {accept.length > 0 ? accept.join(', ') : 'Any file type'} up to{' '}
                  {formatFileSize(maxSize)}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          id="upload-error"
          className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200"
          role="alert"
        >
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Helper Text */}
      {helperText && !error && (
        <p id="upload-help" className="text-sm text-gray-500">
          {helperText}
        </p>
      )}

      {/* File List */}
      {files.length > 0 && showPreviews && (
        <ul className="space-y-2" role="list" aria-label="Uploaded files">
          {files.map((file) => (
            <FilePreviewItem
              key={file.id}
              file={file}
              onRemove={onRemove}
              disabled={disabled}
              compact={compact}
            />
          ))}
        </ul>
      )}

      {/* File Count */}
      {maxFiles > 1 && (
        <p className="text-sm text-gray-500">
          {files.length} of {maxFiles} files
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// File Preview Item
// -----------------------------------------------------------------------------

interface FilePreviewItemProps {
  file: UploadedFile;
  onRemove?: (file: UploadedFile) => void;
  disabled?: boolean;
  compact?: boolean;
}

function FilePreviewItem({ file, onRemove, disabled, compact }: FilePreviewItemProps) {
  const statusColors = {
    pending: 'border-gray-200',
    uploading: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
  };

  return (
    <li
      className={clsx(
        'flex items-center gap-3 rounded-lg border',
        compact ? 'p-2' : 'p-3',
        statusColors[file.status]
      )}
    >
      {/* File Icon or Preview */}
      <div className="flex-shrink-0">
        {file.preview && file.type.startsWith('image/') ? (
          <img
            src={file.preview}
            alt=""
            className={clsx(
              'rounded object-cover',
              compact ? 'w-8 h-8' : 'w-10 h-10'
            )}
          />
        ) : (
          getFileIcon(file.type)
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className={clsx('font-medium text-gray-900 truncate', compact && 'text-sm')}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
        {file.status === 'error' && file.errorMessage && (
          <p className="text-xs text-red-600">{file.errorMessage}</p>
        )}
      </div>

      {/* Progress/Status */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {file.status === 'uploading' && (
          <div className="w-16">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
        )}

        {file.status === 'success' && (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}

        {file.status === 'error' && (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}

        {/* Remove Button */}
        {onRemove && !disabled && (
          <button
            type="button"
            onClick={() => onRemove(file)}
            className={clsx(
              'p-1 rounded text-gray-400 hover:text-red-500',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              'transition-colors'
            )}
            aria-label={`Remove ${file.name}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

export default FileUpload;
