// =============================================================================
// useApplications Hook - Applications Data Management
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Application,
  ApplicationSummary,
  ApplicationStatus,
  CallStatus,
  FileScanStatus,
  ConfirmationType,
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

// Demo data for when API is unavailable (static GitHub Pages deployment)
const DEMO_APPLICATIONS: ApplicationSummary[] = [
  {
    id: 'app-001',
    callId: 'demo-001',
    reference: 'APP-2026-001',
    applicantName: 'Dr Eleanor Whitfield',
    applicantEmail: 'e.whitfield@imperial.ac.uk',
    status: ApplicationStatus.SUBMITTED,
    fileCount: 3,
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 1,
  },
  {
    id: 'app-002',
    callId: 'demo-001',
    reference: 'APP-2026-002',
    applicantName: 'Prof James Hargreaves',
    applicantEmail: 'j.hargreaves@ucl.ac.uk',
    status: ApplicationStatus.UNDER_REVIEW,
    fileCount: 5,
    submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 2,
  },
  {
    id: 'app-003',
    callId: 'demo-001',
    reference: 'APP-2026-003',
    applicantName: 'Dr Priya Chakraborty',
    applicantEmail: 'p.chakraborty@cam.ac.uk',
    status: ApplicationStatus.ASSESSED,
    fileCount: 4,
    submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 2,
  },
  {
    id: 'app-004',
    callId: 'demo-002',
    reference: 'APP-2026-004',
    applicantName: 'Dr Samuel Okonkwo',
    applicantEmail: 's.okonkwo@ox.ac.uk',
    status: ApplicationStatus.SUBMITTED,
    fileCount: 2,
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 1,
    completedAssessmentCount: 0,
  },
  {
    id: 'app-005',
    callId: 'demo-002',
    reference: 'APP-2026-005',
    applicantName: 'Prof Hannah McLaren',
    applicantEmail: 'h.mclaren@ed.ac.uk',
    status: ApplicationStatus.UNDER_REVIEW,
    fileCount: 6,
    submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 1,
  },
  {
    id: 'app-006',
    callId: 'demo-003',
    reference: 'APP-2026-006',
    applicantName: 'Dr Rajesh Patel',
    applicantEmail: 'r.patel@kcl.ac.uk',
    status: ApplicationStatus.ASSESSED,
    fileCount: 3,
    submittedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 2,
  },
  {
    id: 'app-007',
    callId: 'demo-003',
    reference: 'APP-2026-007',
    applicantName: 'Dr Fiona Campbell',
    applicantEmail: 'f.campbell@gla.ac.uk',
    status: ApplicationStatus.ASSESSED,
    fileCount: 4,
    submittedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 2,
    completedAssessmentCount: 2,
  },
  {
    id: 'app-008',
    callId: 'demo-001',
    reference: 'APP-2026-008',
    applicantName: 'Prof David Llewellyn',
    applicantEmail: 'd.llewellyn@cardiff.ac.uk',
    status: ApplicationStatus.SUBMITTED,
    fileCount: 3,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentCount: 0,
    completedAssessmentCount: 0,
  },
];

const DEMO_MY_APPLICATIONS: Application[] = [
  {
    id: 'app-001',
    callId: 'demo-001',
    call: {
      id: 'demo-001',
      name: 'Innovation Research Fund 2026',
      description: 'Supporting innovative research projects across STEM disciplines with grants up to £500,000.',
      openAt: new Date().toISOString(),
      closeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: CallStatus.OPEN,
      applicationCount: 24,
    },
    applicantId: 'user-demo-001',
    applicantName: 'Dr Eleanor Whitfield',
    applicantEmail: 'e.whitfield@imperial.ac.uk',
    applicantOrganisation: 'Imperial College London',
    reference: 'APP-2026-001',
    status: ApplicationStatus.SUBMITTED,
    files: [
      {
        id: 'file-001',
        applicationId: 'app-001',
        filename: 'research-proposal.pdf',
        originalFilename: 'research-proposal.pdf',
        fileSize: 2048000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'file-002',
        applicationId: 'app-001',
        filename: 'budget-justification.pdf',
        originalFilename: 'budget-justification.pdf',
        fileSize: 512000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'file-003',
        applicationId: 'app-001',
        filename: 'cv-whitfield.pdf',
        originalFilename: 'cv-whitfield.pdf',
        fileSize: 256000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    confirmations: [
      {
        id: 'conf-001',
        applicationId: 'app-001',
        type: ConfirmationType.GUIDANCE_READ,
        confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
      {
        id: 'conf-002',
        applicationId: 'app-001',
        type: ConfirmationType.DATA_SHARING_CONSENT,
        confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
    ],
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'app-004',
    callId: 'demo-002',
    call: {
      id: 'demo-002',
      name: 'Climate Action Research Programme',
      description: 'Funding for research addressing climate change challenges.',
      openAt: new Date().toISOString(),
      closeAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      status: CallStatus.OPEN,
      applicationCount: 18,
    },
    applicantId: 'user-demo-001',
    applicantName: 'Dr Eleanor Whitfield',
    applicantEmail: 'e.whitfield@imperial.ac.uk',
    applicantOrganisation: 'Imperial College London',
    reference: 'APP-2026-004',
    status: ApplicationStatus.SUBMITTED,
    files: [
      {
        id: 'file-004',
        applicationId: 'app-004',
        filename: 'climate-research-proposal.pdf',
        originalFilename: 'climate-research-proposal.pdf',
        fileSize: 3072000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'file-005',
        applicationId: 'app-004',
        filename: 'data-management-plan.pdf',
        originalFilename: 'data-management-plan.pdf',
        fileSize: 384000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    confirmations: [
      {
        id: 'conf-003',
        applicationId: 'app-004',
        type: ConfirmationType.GUIDANCE_READ,
        confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
      {
        id: 'conf-004',
        applicationId: 'app-004',
        type: ConfirmationType.EDI_COMPLETED,
        confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
      {
        id: 'conf-005',
        applicationId: 'app-004',
        type: ConfirmationType.DATA_SHARING_CONSENT,
        confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
    ],
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'app-009',
    callId: 'demo-003',
    call: {
      id: 'demo-003',
      name: 'Digital Health Innovation Grant',
      description: 'Supporting digital health solutions.',
      openAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      closeAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: CallStatus.CLOSED,
      applicationCount: 42,
    },
    applicantId: 'user-demo-001',
    applicantName: 'Dr Eleanor Whitfield',
    applicantEmail: 'e.whitfield@imperial.ac.uk',
    applicantOrganisation: 'Imperial College London',
    reference: 'APP-2026-009',
    status: ApplicationStatus.ASSESSED,
    files: [
      {
        id: 'file-006',
        applicationId: 'app-009',
        filename: 'digital-health-proposal.pdf',
        originalFilename: 'digital-health-proposal.pdf',
        fileSize: 1536000,
        mimeType: 'application/pdf',
        scanStatus: FileScanStatus.CLEAN,
        uploadedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    confirmations: [
      {
        id: 'conf-006',
        applicationId: 'app-009',
        type: ConfirmationType.GUIDANCE_READ,
        confirmedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
      {
        id: 'conf-007',
        applicationId: 'app-009',
        type: ConfirmationType.DATA_SHARING_CONSENT,
        confirmedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.1',
      },
    ],
    submittedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

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
    } catch {
      // Fallback to demo data when API is unavailable
      setApplications(DEMO_MY_APPLICATIONS);
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
    } catch {
      // Fallback to demo data when API is unavailable
      const demoApp = DEMO_MY_APPLICATIONS.find(a => a.id === applicationId) || null;
      setApplication(demoApp);
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
    } catch {
      // Fallback to demo data when API is unavailable
      const filtered = DEMO_APPLICATIONS.filter(a => a.callId === callId);
      const pageSize = pagination?.pageSize || 20;
      setApplications(filtered);
      setTotal(filtered.length);
      setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
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
