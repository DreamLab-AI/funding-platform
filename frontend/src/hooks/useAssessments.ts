// =============================================================================
// useAssessments Hook - Assessments Data Management
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Assignment,
  Assessment,
  AssessmentDraft,
  SubmitAssessmentData,
  CallProgress,
  MasterResults,
  AssessorPoolMember,
  AddAssessorData,
  AssignApplicationsData,
  SendReminderData,
  ReminderResult,
  ExportOptions,
  ExportResult,
} from '../types';
import {
  assignmentsApi,
  assessmentsApi,
  assessorsApi,
  progressApi,
  resultsApi,
} from '../services/api';

// -----------------------------------------------------------------------------
// useMyAssignments - Assessor's assigned applications
// -----------------------------------------------------------------------------

interface UseMyAssignmentsReturn {
  assignments: Assignment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyAssignments(): UseMyAssignmentsReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await assignmentsApi.getMyAssignments();
      setAssignments(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch assignments';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { assignments, isLoading, error, refetch: fetchAssignments };
}

// -----------------------------------------------------------------------------
// useCallAssignments - Assignments for a specific call (assessor view)
// -----------------------------------------------------------------------------

interface UseCallAssignmentsReturn {
  assignments: Assignment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCallAssignments(
  callId: string | undefined
): UseCallAssignmentsReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await assignmentsApi.getAssignmentsByCall(callId);
      setAssignments(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch assignments';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { assignments, isLoading, error, refetch: fetchAssignments };
}

// -----------------------------------------------------------------------------
// useAssessment - Single assessment for an assignment
// -----------------------------------------------------------------------------

interface UseAssessmentReturn {
  assessment: Assessment | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssessment(
  assignmentId: string | undefined
): UseAssessmentReturn {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async () => {
    if (!assignmentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await assessmentsApi.getAssessment(assignmentId);
      setAssessment(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch assessment';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  return { assessment, isLoading, error, refetch: fetchAssessment };
}

// -----------------------------------------------------------------------------
// useAssessmentMutations - Save draft, submit assessment
// -----------------------------------------------------------------------------

interface UseAssessmentMutationsReturn {
  saveDraft: (assignmentId: string, data: AssessmentDraft) => Promise<Assessment>;
  submitAssessment: (
    assignmentId: string,
    data: SubmitAssessmentData
  ) => Promise<Assessment>;
  returnAssessment: (assessmentId: string, reason: string) => Promise<Assessment>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAssessmentMutations(): UseAssessmentMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDraft = useCallback(
    async (assignmentId: string, data: AssessmentDraft): Promise<Assessment> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await assessmentsApi.saveDraft(assignmentId, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save draft';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const submitAssessment = useCallback(
    async (
      assignmentId: string,
      data: SubmitAssessmentData
    ): Promise<Assessment> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await assessmentsApi.submitAssessment(assignmentId, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to submit assessment';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const returnAssessment = useCallback(
    async (assessmentId: string, reason: string): Promise<Assessment> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await assessmentsApi.returnAssessment(assessmentId, reason);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to return assessment';
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
    saveDraft,
    submitAssessment,
    returnAssessment,
    isLoading,
    error,
    clearError,
  };
}

// -----------------------------------------------------------------------------
// useCallAssessors - Assessor pool for a call
// -----------------------------------------------------------------------------

interface UseCallAssessorsReturn {
  assessors: AssessorPoolMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCallAssessors(
  callId: string | undefined
): UseCallAssessorsReturn {
  const [assessors, setAssessors] = useState<AssessorPoolMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessors = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await assessorsApi.getCallAssessors(callId);
      setAssessors(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch assessors';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchAssessors();
  }, [fetchAssessors]);

  return { assessors, isLoading, error, refetch: fetchAssessors };
}

// -----------------------------------------------------------------------------
// useAssessorMutations - Add, remove, update assessors
// -----------------------------------------------------------------------------

interface UseAssessorMutationsReturn {
  addAssessor: (callId: string, data: AddAssessorData) => Promise<void>;
  removeAssessor: (callId: string, assessorId: string) => Promise<void>;
  updateAssessor: (
    callId: string,
    assessorId: string,
    data: Partial<AddAssessorData>
  ) => Promise<void>;
  inviteAssessor: (callId: string, assessorId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAssessorMutations(): UseAssessorMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAssessor = useCallback(
    async (callId: string, data: AddAssessorData): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await assessorsApi.addAssessor(callId, data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add assessor';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeAssessor = useCallback(
    async (callId: string, assessorId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await assessorsApi.removeAssessor(callId, assessorId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to remove assessor';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateAssessor = useCallback(
    async (
      callId: string,
      assessorId: string,
      data: Partial<AddAssessorData>
    ): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await assessorsApi.updateAssessor(callId, assessorId, data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update assessor';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const inviteAssessor = useCallback(
    async (callId: string, assessorId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await assessorsApi.inviteAssessor(callId, assessorId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to send invitation';
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
    addAssessor,
    removeAssessor,
    updateAssessor,
    inviteAssessor,
    isLoading,
    error,
    clearError,
  };
}

// -----------------------------------------------------------------------------
// useAssignmentMutations - Assign applications to assessors
// -----------------------------------------------------------------------------

interface UseAssignmentMutationsReturn {
  assignApplications: (
    callId: string,
    data: AssignApplicationsData
  ) => Promise<Assignment[]>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAssignmentMutations(): UseAssignmentMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignApplications = useCallback(
    async (
      callId: string,
      data: AssignApplicationsData
    ): Promise<Assignment[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await assignmentsApi.assignApplications(callId, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to assign applications';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeAssignment = useCallback(
    async (assignmentId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        await assignmentsApi.removeAssignment(assignmentId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to remove assignment';
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
    assignApplications,
    removeAssignment,
    isLoading,
    error,
    clearError,
  };
}

// -----------------------------------------------------------------------------
// useCallProgress - Assessment progress for a call
// -----------------------------------------------------------------------------

interface UseCallProgressReturn {
  progress: CallProgress | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCallProgress(
  callId: string | undefined
): UseCallProgressReturn {
  const [progress, setProgress] = useState<CallProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await progressApi.getCallProgress(callId);
      setProgress(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch progress';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return { progress, isLoading, error, refetch: fetchProgress };
}

// -----------------------------------------------------------------------------
// useMasterResults - Aggregated results for a call
// -----------------------------------------------------------------------------

interface UseMasterResultsReturn {
  results: MasterResults | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  exportResults: (options: ExportOptions) => Promise<ExportResult>;
}

export function useMasterResults(
  callId: string | undefined
): UseMasterResultsReturn {
  const [results, setResults] = useState<MasterResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!callId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await resultsApi.getMasterResults(callId);
      setResults(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch results';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  const exportResults = useCallback(
    async (options: ExportOptions): Promise<ExportResult> => {
      if (!callId) {
        throw new Error('Call ID is required');
      }
      return resultsApi.exportResults(callId, options);
    },
    [callId]
  );

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, isLoading, error, refetch: fetchResults, exportResults };
}

// -----------------------------------------------------------------------------
// useReminders - Send reminder emails
// -----------------------------------------------------------------------------

interface UseRemindersReturn {
  sendReminders: (callId: string, data: SendReminderData) => Promise<ReminderResult>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useReminders(): UseRemindersReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReminders = useCallback(
    async (callId: string, data: SendReminderData): Promise<ReminderResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await progressApi.sendReminders(callId, data);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to send reminders';
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

  return { sendReminders, isLoading, error, clearError };
}
