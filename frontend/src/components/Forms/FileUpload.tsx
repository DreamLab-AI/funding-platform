// =============================================================================
// FileUpload Component
// =============================================================================

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { ApplicationFile, FileScanStatus } from '../../types';
import { ProgressBar } from '../Common/ProgressBar';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  onDelete?: (fileId: string) => Promise<void>;
  files?: ApplicationFile[];
  allowedTypes?: string[];
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  uploadProgress?: number;
  isUploading?: boolean;
}

export function FileUpload({
  onUpload,
  onDelete,
  files = [],
  allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  maxSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 10,
  disabled = false,
  uploadProgress = 0,
  isUploading = false,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${formatFileSize(maxSize)}.`);
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
        } else {
          setError(rejection.errors[0]?.message || 'File upload failed');
        }
        return;
      }

      if (files.length + acceptedFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      for (const file of acceptedFiles) {
        try {
          await onUpload(file);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        }
      }
    },
    [onUpload, files.length, maxFiles, maxSize, allowedTypes]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => {
      if (type === '.pdf') acc['application/pdf'] = ['.pdf'];
      if (type === '.doc') acc['application/msword'] = ['.doc'];
      if (type === '.docx')
        acc['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] =
          ['.docx'];
      if (type === '.xls') acc['application/vnd.ms-excel'] = ['.xls'];
      if (type === '.xlsx')
        acc['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] =
          ['.xlsx'];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    disabled: disabled || isUploading,
    multiple: true,
  });

  const handleDelete = async (fileId: string) => {
    if (onDelete) {
      try {
        await onDelete(fileId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    }
  };

  const getScanStatusBadge = (status: FileScanStatus) => {
    switch (status) {
      case FileScanStatus.CLEAN:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Verified
          </span>
        );
      case FileScanStatus.PENDING:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Scanning...
          </span>
        );
      case FileScanStatus.INFECTED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        );
      case FileScanStatus.ERROR:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : disabled || isUploading
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className={`mx-auto h-12 w-12 ${
              isDragActive ? 'text-primary-500' : 'text-gray-400'
            }`}
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
          {isDragActive ? (
            <p className="text-primary-600 font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-600">
                <span className="text-primary-600 font-medium">Click to upload</span> or
                drag and drop
              </p>
              <p className="text-sm text-gray-500">
                {allowedTypes.join(', ')} up to {formatFileSize(maxSize)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Uploading...</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between py-3 px-4"
            >
              <div className="flex items-center min-w-0 flex-1">
                <svg
                  className="h-5 w-5 text-gray-400 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalFilename}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {getScanStatusBadge(file.scanStatus)}
                {onDelete && !disabled && (
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove file"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* File Count */}
      <p className="text-sm text-gray-500">
        {files.length} of {maxFiles} files uploaded
      </p>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
