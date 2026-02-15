// =============================================================================
// useCalls Hook - Funding Calls Data Management
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  FundingCall,
  FundingCallSummary,
  CreateCallData,
  CallStatus,
  ConfirmationType,
  PaginationOptions,
  SortOptions,
  PaginatedResponse,
} from '../types';

// Demo data for when API is unavailable
const DEMO_CALLS: FundingCallSummary[] = [
  {
    id: 'demo-001',
    name: 'Innovation Research Fund 2026',
    description: 'Supporting innovative research projects across STEM disciplines with grants up to £500,000.',
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.OPEN,
    applicationCount: 24,
  },
  {
    id: 'demo-002',
    name: 'Climate Action Research Programme',
    description: 'Funding for research addressing climate change challenges.',
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.OPEN,
    applicationCount: 18,
  },
  {
    id: 'demo-003',
    name: 'Digital Health Innovation Grant',
    description: 'Supporting digital health solutions.',
    openAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    closeAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.CLOSED,
    applicationCount: 42,
  },
  {
    id: 'demo-004',
    name: 'Future Transport Research',
    description: 'Research into sustainable transportation.',
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.DRAFT,
    applicationCount: 0,
  },
];
// Demo data for single call details when API is unavailable
const DEMO_FULL_CALLS: FundingCall[] = [
  {
    id: 'demo-001',
    name: 'Innovation Research Fund 2026',
    description: 'Supporting innovative research projects across STEM disciplines with grants up to £500,000.',
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.OPEN,
    requirements: {
      allowedFileTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxFileSize: 20 * 1024 * 1024,
      maxFiles: 5,
      requiredConfirmations: [ConfirmationType.GUIDANCE_READ, ConfirmationType.DATA_SHARING_CONSENT],
      guidanceText: 'Please read the full guidance notes before submitting your application.',
      guidanceUrl: 'https://example.org/guidance/innovation-2026',
    },
    criteria: [
      { id: 'c-001', name: 'Scientific Excellence', description: 'Quality and novelty of the proposed research methodology and approach.', maxPoints: 100, weight: 0.3, commentsRequired: true },
      { id: 'c-002', name: 'Impact & Innovation', description: 'Potential for societal, economic, or environmental impact and degree of innovation.', maxPoints: 100, weight: 0.3, commentsRequired: true },
      { id: 'c-003', name: 'Feasibility', description: 'Realistic work plan, appropriate resources, and achievable milestones.', maxPoints: 100, weight: 0.2, commentsRequired: true },
      { id: 'c-004', name: 'Value for Money', description: 'Justification of costs and efficient use of funding.', maxPoints: 100, weight: 0.2, commentsRequired: false },
    ],
    assessorsPerApplication: 3,
    varianceThreshold: 20,
    retentionYears: 7,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-002',
    name: 'Climate Action Research Programme',
    description: 'Funding for research addressing climate change challenges.',
    openAt: new Date().toISOString(),
    closeAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: CallStatus.OPEN,
    requirements: {
      allowedFileTypes: ['application/pdf'],
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 3,
      requiredConfirmations: [ConfirmationType.GUIDANCE_READ, ConfirmationType.EDI_COMPLETED, ConfirmationType.DATA_SHARING_CONSENT],
      guidanceText: 'Applicants must demonstrate alignment with UN Sustainable Development Goals.',
      guidanceUrl: 'https://example.org/guidance/climate-2026',
      ediUrl: 'https://example.org/edi/climate-2026',
    },
    criteria: [
      { id: 'c-005', name: 'Scientific Excellence', description: 'Rigour of research design and contribution to climate science.', maxPoints: 100, weight: 0.25, commentsRequired: true },
      { id: 'c-006', name: 'Impact & Innovation', description: 'Potential to deliver measurable climate action outcomes.', maxPoints: 100, weight: 0.3, commentsRequired: true },
      { id: 'c-007', name: 'Feasibility', description: 'Deliverability within the proposed timeline and budget.', maxPoints: 100, weight: 0.25, commentsRequired: true },
      { id: 'c-008', name: 'Value for Money', description: 'Cost-effectiveness and appropriate resource allocation.', maxPoints: 100, weight: 0.2, commentsRequired: false },
    ],
    assessorsPerApplication: 2,
    varianceThreshold: 25,
    retentionYears: 10,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

import { callsApi } from '../services/api';

// -----------------------------------------------------------------------------
// useOpenCalls - For applicants viewing available calls
// -----------------------------------------------------------------------------

interface UseOpenCallsReturn {
  calls: FundingCallSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOpenCalls(): UseOpenCallsReturn {
  const [calls, setCalls] = useState<FundingCallSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await callsApi.getOpenCalls();
      setCalls(data);
    } catch {
      // Fallback to demo data when API is unavailable
      const openDemoCalls = DEMO_CALLS.filter(c => c.status === CallStatus.OPEN);
      setCalls(openDemoCalls);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return { calls, isLoading, error, refetch: fetchCalls };
}

// -----------------------------------------------------------------------------
// useAllCalls - For coordinators managing all calls
// -----------------------------------------------------------------------------

interface UseAllCallsOptions {
  pagination?: PaginationOptions;
  sort?: SortOptions;
}

interface UseAllCallsReturn {
  calls: FundingCallSummary[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setPagination: (pagination: PaginationOptions) => void;
  setSort: (sort: SortOptions) => void;
}

export function useAllCalls(options?: UseAllCallsOptions): UseAllCallsReturn {
  const [calls, setCalls] = useState<FundingCallSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationOptions>(
    options?.pagination || { page: 1, pageSize: 10 }
  );
  const [sort, setSort] = useState<SortOptions | undefined>(options?.sort);

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response: PaginatedResponse<FundingCallSummary> = await callsApi.getAllCalls(
        pagination,
        sort
      );
      setCalls(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch {
      // Fallback to demo data when API is unavailable
      setCalls(DEMO_CALLS);
      setTotal(DEMO_CALLS.length);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [pagination, sort]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return {
    calls,
    total,
    totalPages,
    isLoading,
    error,
    refetch: fetchCalls,
    setPagination,
    setSort,
  };
}

// -----------------------------------------------------------------------------
// useCall - Single call details
// -----------------------------------------------------------------------------

interface UseCallReturn {
  call: FundingCall | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCall(callId: string | undefined): UseCallReturn {
  const [call, setCall] = useState<FundingCall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCall = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await callsApi.getCall(callId);
      setCall(data);
    } catch {
      // Fallback to demo data when API is unavailable
      const demoCall = DEMO_FULL_CALLS.find(c => c.id === callId) || null;
      if (demoCall) {
        setCall(demoCall);
      } else {
        setError('Call not found');
      }
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchCall();
  }, [fetchCall]);

  return { call, isLoading, error, refetch: fetchCall };
}

// -----------------------------------------------------------------------------
// useCallMutations - Create, update, delete calls
// -----------------------------------------------------------------------------

interface UseCallMutationsReturn {
  createCall: (data: CreateCallData) => Promise<FundingCall>;
  updateCall: (callId: string, data: Partial<CreateCallData>) => Promise<FundingCall>;
  updateStatus: (callId: string, status: CallStatus) => Promise<FundingCall>;
  deleteCall: (callId: string) => Promise<void>;
  cloneCall: (callId: string, name: string) => Promise<FundingCall>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCallMutations(): UseCallMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCall = useCallback(async (data: CreateCallData): Promise<FundingCall> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callsApi.createCall(data);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create call';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCall = useCallback(
    async (callId: string, data: Partial<CreateCallData>): Promise<FundingCall> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await callsApi.updateCall(callId, data);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update call';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateStatus = useCallback(
    async (callId: string, status: CallStatus): Promise<FundingCall> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await callsApi.updateCallStatus(callId, status);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update status';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteCall = useCallback(async (callId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await callsApi.deleteCall(callId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete call';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cloneCall = useCallback(
    async (callId: string, name: string): Promise<FundingCall> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await callsApi.cloneCall(callId, name);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone call';
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
    createCall,
    updateCall,
    updateStatus,
    deleteCall,
    cloneCall,
    isLoading,
    error,
    clearError,
  };
}
