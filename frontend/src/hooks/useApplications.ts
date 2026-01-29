// =============================================================================
// useApplications Hook - Applications Data Management
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Application,
  ApplicationSummary,
  CreateApplicationData,
  SubmitApplicationData,
  ApplicationFilters,
  PaginationOptions,
  SortOptions,
  PaginatedResponse,
  ExportOptions,
  ExportResult,
} from '../types';
import { applicationsApi } from '../services/api';

// -----------------------------------------------------------------------------
// useMyApplications - Applicant's own applications
// -----------------------------------------------------------------------------

interface UseMyApplicationsReturn {
  applications: Application[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyApplications(): UseMyApplicationsReturn {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await applicationsApi.getMyApplications();
      setApplications(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch applications';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return { applications, isLoading, error, refetch: fetchApplications };
}

// -----------------------------------------------------------------------------
// useApplication - Single application details
// -----------------------------------------------------------------------------

interface UseApplicationReturn {
  application: Application | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApplication(
  applicationId: string | undefined
): UseApplicationReturn {
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!applicationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await applicationsApi.getApplication(applicationId);
      setApplication(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch application';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  return { application, isLoading, error, refetch: fetchApplication };
}

// -----------------------------------------------------------------------------
// useCallApplications - Coordinator view of call applications
// -----------------------------------------------------------------------------

interface UseCallApplicationsOptions {
  filters?: ApplicationFilters;
  pagination?: PaginationOptions;
  sort?: SortOptions;
}

interface UseCallApplicationsReturn {
  applications: ApplicationSummary[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setFilters: (filters: ApplicationFilters) => void;
  setPagination: (pagination: PaginationOptions) => void;
  setSort: (sort: SortOptions) => void;
}

export function useCallApplications(
  callId: string | undefined,
  options?: UseCallApplicationsOptions
): UseCallApplicationsReturn {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ApplicationFilters>(
    options?.filters || {}
  );
  const [pagination, setPagination] = useState<PaginationOptions>(
    options?.pagination || { page: 1, pageSize: 20 }
  );
  const [sort, setSort] = useState<SortOptions | undefined>(options?.sort);

  const fetchApplications = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response: PaginatedResponse<ApplicationSummary> =
        await applicationsApi.getCallApplications(callId, filters, pagination, sort);
      setApplications(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch applications';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [callId, filters, pagination, sort]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    total,
    totalPages,
    isLoading,
    error,
    refetch: fetchApplications,
    setFilters,
    setPagination,
    setSort,
  };
}

// -----------------------------------------------------------------------------
// useApplicationMutations - Create, submit, upload files
// -----------------------------------------------------------------------------

interface UseApplicationMutationsReturn {
  createApplication: (data: CreateApplicationData) => Promise<Application>;
  uploadFile: (
    applicationId: string,
    file: File,
    onProgress?: (progress: number) => void
  ) => Promise<Application>;
  deleteFile: (applicationId: string, fileId: string) => Promise<void>;
  submitApplication: (
    applicationId: string,
    data: SubmitApplicationData
  ) => Promise<Application>;
  withdrawApplication: (applicationId: string) => Promise<void>;
  reopenApplication: (applicationId: string) => Promise<Application>;
  exportApplications: (callId: string, options: ExportOptions) => Promise<ExportResult>;
  downloadApplicationPack: (applicationId: string) => Promise<void>;
  downloadAllApplications: (callId: string) => Promise<void>;
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
  clearError: () => void;
}

export function useApplicationMutations(): UseApplicationMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const createApplication = useCallback(
    async (data: CreateApplicationData): Promise<Application> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await applicationsApi.createApplication(data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create application';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (
      applicationId: string,
      file: File,
      onProgress?: (progress: number) => void
    ): Promise<Application> => {
      setIsLoading(true);
      setError(null);
      setUploadProgress(0);
      try {
        const result = await applicationsApi.uploadFile(
          applicationId,
          file,
          (progress) => {
            setUploadProgress(progress);
            onProgress?.(progress);
          }
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload file';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
        setUploadProgress(0);
      }
    },
    []
  );

  const deleteFile = useCallback(
    async (applicationId: string, fileId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await applicationsApi.deleteFile(applicationId, fileId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete file';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const submitApplication = useCallback(
    async (
      applicationId: string,
      data: SubmitApplicationData
    ): Promise<Application> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await applicationsApi.submitApplication(applicationId, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to submit application';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const withdrawApplication = useCallback(
    async (applicationId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await applicationsApi.withdrawApplication(applicationId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to withdraw application';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reopenApplication = useCallback(
    async (applicationId: string): Promise<Application> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await applicationsApi.reopenApplication(applicationId);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to reopen application';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const exportApplications = useCallback(
    async (callId: string, options: ExportOptions): Promise<ExportResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await applicationsApi.exportApplications(callId, options);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to export applications';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const downloadApplicationPack = useCallback(
    async (applicationId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const blob = await applicationsApi.downloadApplicationPack(applicationId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `application-${applicationId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to download application';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const downloadAllApplications = useCallback(
    async (callId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const blob = await applicationsApi.downloadAllApplications(callId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `applications-${callId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to download applications';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createApplication,
    uploadFile,
    deleteFile,
    submitApplication,
    withdrawApplication,
    reopenApplication,
    exportApplications,
    downloadApplicationPack,
    downloadAllApplications,
    isLoading,
    uploadProgress,
    error,
    clearError,
  };
}
