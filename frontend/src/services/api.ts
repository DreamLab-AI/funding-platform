// =============================================================================
// API Service - Funding Application Platform
// =============================================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  AuthUser,
  LoginCredentials,
  RegisterData,
  User,
  FundingCall,
  FundingCallSummary,
  CreateCallData,
  Application,
  ApplicationSummary,
  CreateApplicationData,
  SubmitApplicationData,
  ApplicationFilters,
  Assessor,
  AssessorPoolMember,
  AddAssessorData,
  Assignment,
  AssignApplicationsData,
  Assessment,
  AssessmentDraft,
  SubmitAssessmentData,
  MasterResults,
  CallProgress,
  CoordinatorDashboard,
  ExportOptions,
  ExportResult,
  SendReminderData,
  ReminderResult,
  AuditLogEntry,
  PaginationOptions,
  SortOptions,
} from '../types';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// -----------------------------------------------------------------------------
// Axios Instance
// -----------------------------------------------------------------------------

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config;

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return apiClient(originalRequest);
        } catch {
          // Refresh failed - clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function buildQueryParams(
  filters?: object,
  pagination?: PaginationOptions,
  sort?: SortOptions
): string {
  const params = new URLSearchParams();

  if (filters) {
    Object.entries(filters as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  if (pagination) {
    params.append('page', String(pagination.page));
    params.append('pageSize', String(pagination.pageSize));
  }

  if (sort) {
    params.append('sortBy', sort.field);
    params.append('sortDir', sort.direction);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// -----------------------------------------------------------------------------
// Auth API
// -----------------------------------------------------------------------------

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const response = await apiClient.post<ApiResponse<AuthUser>>(
      '/auth/login',
      credentials
    );
    return response.data.data;
  },

  register: async (data: RegisterData): Promise<AuthUser> => {
    const response = await apiClient.post<ApiResponse<AuthUser>>(
      '/auth/register',
      data
    );
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const response = await apiClient.post<ApiResponse<{ accessToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put('/auth/password', { currentPassword, newPassword });
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post('/auth/password-reset', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/password-reset/confirm', { token, newPassword });
  },
};

// -----------------------------------------------------------------------------
// Funding Calls API
// -----------------------------------------------------------------------------

export const callsApi = {
  getOpenCalls: async (): Promise<FundingCallSummary[]> => {
    const response = await apiClient.get<ApiResponse<FundingCallSummary[]>>(
      '/calls/open'
    );
    return response.data.data;
  },

  getAllCalls: async (
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<FundingCallSummary>> => {
    const queryString = buildQueryParams(undefined, pagination, sort);
    const response = await apiClient.get<PaginatedResponse<FundingCallSummary>>(
      `/calls${queryString}`
    );
    return response.data;
  },

  getCall: async (callId: string): Promise<FundingCall> => {
    const response = await apiClient.get<ApiResponse<FundingCall>>(
      `/calls/${callId}`
    );
    return response.data.data;
  },

  createCall: async (data: CreateCallData): Promise<FundingCall> => {
    const response = await apiClient.post<ApiResponse<FundingCall>>(
      '/calls',
      data
    );
    return response.data.data;
  },

  updateCall: async (
    callId: string,
    data: Partial<CreateCallData>
  ): Promise<FundingCall> => {
    const response = await apiClient.put<ApiResponse<FundingCall>>(
      `/calls/${callId}`,
      data
    );
    return response.data.data;
  },

  updateCallStatus: async (
    callId: string,
    status: string
  ): Promise<FundingCall> => {
    const response = await apiClient.patch<ApiResponse<FundingCall>>(
      `/calls/${callId}/status`,
      { status }
    );
    return response.data.data;
  },

  deleteCall: async (callId: string): Promise<void> => {
    await apiClient.delete(`/calls/${callId}`);
  },

  cloneCall: async (callId: string, name: string): Promise<FundingCall> => {
    const response = await apiClient.post<ApiResponse<FundingCall>>(
      `/calls/${callId}/clone`,
      { name }
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Applications API
// -----------------------------------------------------------------------------

export const applicationsApi = {
  // Applicant endpoints
  getMyApplications: async (): Promise<Application[]> => {
    const response = await apiClient.get<ApiResponse<Application[]>>(
      '/applications/me'
    );
    return response.data.data;
  },

  getApplication: async (applicationId: string): Promise<Application> => {
    const response = await apiClient.get<ApiResponse<Application>>(
      `/applications/${applicationId}`
    );
    return response.data.data;
  },

  createApplication: async (data: CreateApplicationData): Promise<Application> => {
    const response = await apiClient.post<ApiResponse<Application>>(
      '/applications',
      data
    );
    return response.data.data;
  },

  uploadFile: async (
    applicationId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Application> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<Application>>(
      `/applications/${applicationId}/files`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );
    return response.data.data;
  },

  deleteFile: async (applicationId: string, fileId: string): Promise<void> => {
    await apiClient.delete(`/applications/${applicationId}/files/${fileId}`);
  },

  submitApplication: async (
    applicationId: string,
    data: SubmitApplicationData
  ): Promise<Application> => {
    const response = await apiClient.post<ApiResponse<Application>>(
      `/applications/${applicationId}/submit`,
      data
    );
    return response.data.data;
  },

  withdrawApplication: async (applicationId: string): Promise<void> => {
    await apiClient.post(`/applications/${applicationId}/withdraw`);
  },

  // Coordinator endpoints
  getCallApplications: async (
    callId: string,
    filters?: ApplicationFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<ApplicationSummary>> => {
    const queryString = buildQueryParams(filters, pagination, sort);
    const response = await apiClient.get<PaginatedResponse<ApplicationSummary>>(
      `/calls/${callId}/applications${queryString}`
    );
    return response.data;
  },

  exportApplications: async (
    callId: string,
    options: ExportOptions
  ): Promise<ExportResult> => {
    const response = await apiClient.post<ApiResponse<ExportResult>>(
      `/calls/${callId}/applications/export`,
      options
    );
    return response.data.data;
  },

  downloadApplicationPack: async (applicationId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/applications/${applicationId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  downloadAllApplications: async (callId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/calls/${callId}/applications/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  reopenApplication: async (applicationId: string): Promise<Application> => {
    const response = await apiClient.post<ApiResponse<Application>>(
      `/applications/${applicationId}/reopen`
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Assessors API
// -----------------------------------------------------------------------------

export const assessorsApi = {
  getCallAssessors: async (callId: string): Promise<AssessorPoolMember[]> => {
    const response = await apiClient.get<ApiResponse<AssessorPoolMember[]>>(
      `/calls/${callId}/assessors`
    );
    return response.data.data;
  },

  addAssessor: async (
    callId: string,
    data: AddAssessorData
  ): Promise<Assessor> => {
    const response = await apiClient.post<ApiResponse<Assessor>>(
      `/calls/${callId}/assessors`,
      data
    );
    return response.data.data;
  },

  removeAssessor: async (callId: string, assessorId: string): Promise<void> => {
    await apiClient.delete(`/calls/${callId}/assessors/${assessorId}`);
  },

  updateAssessor: async (
    callId: string,
    assessorId: string,
    data: Partial<AddAssessorData>
  ): Promise<Assessor> => {
    const response = await apiClient.put<ApiResponse<Assessor>>(
      `/calls/${callId}/assessors/${assessorId}`,
      data
    );
    return response.data.data;
  },

  inviteAssessor: async (callId: string, assessorId: string): Promise<void> => {
    await apiClient.post(`/calls/${callId}/assessors/${assessorId}/invite`);
  },
};

// -----------------------------------------------------------------------------
// Assignments API
// -----------------------------------------------------------------------------

export const assignmentsApi = {
  getAssignments: async (callId: string): Promise<Assignment[]> => {
    const response = await apiClient.get<ApiResponse<Assignment[]>>(
      `/calls/${callId}/assignments`
    );
    return response.data.data;
  },

  assignApplications: async (
    callId: string,
    data: AssignApplicationsData
  ): Promise<Assignment[]> => {
    const response = await apiClient.post<ApiResponse<Assignment[]>>(
      `/calls/${callId}/assignments`,
      data
    );
    return response.data.data;
  },

  removeAssignment: async (assignmentId: string): Promise<void> => {
    await apiClient.delete(`/assignments/${assignmentId}`);
  },

  getMyAssignments: async (): Promise<Assignment[]> => {
    const response = await apiClient.get<ApiResponse<Assignment[]>>(
      '/assignments/me'
    );
    return response.data.data;
  },

  getAssignmentsByCall: async (callId: string): Promise<Assignment[]> => {
    const response = await apiClient.get<ApiResponse<Assignment[]>>(
      `/calls/${callId}/assignments/me`
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Assessments API
// -----------------------------------------------------------------------------

export const assessmentsApi = {
  getAssessment: async (assignmentId: string): Promise<Assessment | null> => {
    try {
      const response = await apiClient.get<ApiResponse<Assessment>>(
        `/assignments/${assignmentId}/assessment`
      );
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  saveDraft: async (
    assignmentId: string,
    data: AssessmentDraft
  ): Promise<Assessment> => {
    const response = await apiClient.put<ApiResponse<Assessment>>(
      `/assignments/${assignmentId}/assessment/draft`,
      data
    );
    return response.data.data;
  },

  submitAssessment: async (
    assignmentId: string,
    data: SubmitAssessmentData
  ): Promise<Assessment> => {
    const response = await apiClient.post<ApiResponse<Assessment>>(
      `/assignments/${assignmentId}/assessment/submit`,
      data
    );
    return response.data.data;
  },

  returnAssessment: async (
    assessmentId: string,
    reason: string
  ): Promise<Assessment> => {
    const response = await apiClient.post<ApiResponse<Assessment>>(
      `/assessments/${assessmentId}/return`,
      { reason }
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Results API
// -----------------------------------------------------------------------------

export const resultsApi = {
  getMasterResults: async (callId: string): Promise<MasterResults> => {
    const response = await apiClient.get<ApiResponse<MasterResults>>(
      `/calls/${callId}/results`
    );
    return response.data.data;
  },

  exportResults: async (
    callId: string,
    options: ExportOptions
  ): Promise<ExportResult> => {
    const response = await apiClient.post<ApiResponse<ExportResult>>(
      `/calls/${callId}/results/export`,
      options
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Progress API
// -----------------------------------------------------------------------------

export const progressApi = {
  getCallProgress: async (callId: string): Promise<CallProgress> => {
    const response = await apiClient.get<ApiResponse<CallProgress>>(
      `/calls/${callId}/progress`
    );
    return response.data.data;
  },

  sendReminders: async (
    callId: string,
    data: SendReminderData
  ): Promise<ReminderResult> => {
    const response = await apiClient.post<ApiResponse<ReminderResult>>(
      `/calls/${callId}/reminders`,
      data
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Dashboard API
// -----------------------------------------------------------------------------

export const dashboardApi = {
  getCoordinatorDashboard: async (): Promise<CoordinatorDashboard> => {
    const response = await apiClient.get<ApiResponse<CoordinatorDashboard>>(
      '/dashboard/coordinator'
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Audit API
// -----------------------------------------------------------------------------

export const auditApi = {
  getAuditLogs: async (
    filters?: {
      targetType?: string;
      targetId?: string;
      actorId?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
    },
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<AuditLogEntry>> => {
    const queryString = buildQueryParams(filters, pagination);
    const response = await apiClient.get<PaginatedResponse<AuditLogEntry>>(
      `/audit${queryString}`
    );
    return response.data;
  },
};

// -----------------------------------------------------------------------------
// Nostr Authentication API
// -----------------------------------------------------------------------------

export interface NostrAuthChallenge {
  challenge: string;
  timestamp: number;
  expiresAt: number;
  relay?: string;
}

export interface NostrLoginRequest {
  pubkey: string;
  signedEvent: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: [string, ...string[]][];
    content: string;
    sig: string;
  };
  nip05?: string;
}

export interface NostrIdentityResponse {
  identity_id: string;
  pubkey: string;
  did: string;
  nip05?: string;
  nip05_verified: boolean;
  did_document: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DIDResolutionResult {
  didDocument: Record<string, unknown> | null;
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
  };
  didResolutionMetadata: {
    contentType?: string;
    error?: string;
    errorMessage?: string;
  };
}

export const nostrApi = {
  /**
   * Get authentication challenge for Nostr login
   */
  getChallenge: async (relay?: string): Promise<NostrAuthChallenge> => {
    const response = await apiClient.post<ApiResponse<NostrAuthChallenge>>(
      '/auth/nostr/challenge',
      relay ? { relay } : {}
    );
    return response.data.data;
  },

  /**
   * Login with Nostr signed challenge
   */
  login: async (data: NostrLoginRequest): Promise<AuthUser> => {
    const response = await apiClient.post<ApiResponse<AuthUser>>(
      '/auth/nostr/login',
      data
    );
    return response.data.data;
  },

  /**
   * Get challenge for linking Nostr identity to existing account
   * Requires JWT authentication
   */
  getLinkChallenge: async (relay?: string): Promise<NostrAuthChallenge> => {
    const response = await apiClient.post<ApiResponse<NostrAuthChallenge>>(
      '/auth/nostr/link-challenge',
      relay ? { relay } : {}
    );
    return response.data.data;
  },

  /**
   * Link Nostr identity to existing account
   * Requires JWT authentication
   */
  linkIdentity: async (data: NostrLoginRequest): Promise<{
    identity_id: string;
    did: string;
    nip05?: string;
    nip05_verified: boolean;
  }> => {
    const response = await apiClient.post<ApiResponse<{
      identity_id: string;
      did: string;
      nip05?: string;
      nip05_verified: boolean;
    }>>('/auth/nostr/link', data);
    return response.data.data;
  },

  /**
   * Unlink Nostr identity from account
   * Requires JWT authentication
   */
  unlinkIdentity: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      '/auth/nostr/unlink'
    );
    return response.data.data;
  },

  /**
   * Get current user's Nostr identity
   * Requires JWT authentication
   */
  getIdentity: async (): Promise<NostrIdentityResponse | null> => {
    const response = await apiClient.get<ApiResponse<NostrIdentityResponse | null>>(
      '/auth/nostr/identity'
    );
    return response.data.data;
  },

  /**
   * Resolve a DID document
   * @param did - DID to resolve (format: did:nostr:<pubkey>)
   */
  resolveDid: async (did: string): Promise<DIDResolutionResult> => {
    const response = await apiClient.get<ApiResponse<DIDResolutionResult>>(
      `/auth/nostr/did/${encodeURIComponent(did)}`
    );
    return response.data.data;
  },
};

// -----------------------------------------------------------------------------
// Export API Client
// -----------------------------------------------------------------------------

export default apiClient;
