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
  CallStatus,
  MasterResults,
  AssessorPoolMember,
  AssignmentStatus,
  ApplicationStatus,
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

// =============================================================================
// Demo Data - Fallbacks for static deployment (no backend API)
// =============================================================================

const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 'demo-assign-001',
    applicationId: 'demo-app-001',
    application: {
      id: 'demo-app-001',
      callId: 'demo-001',
      reference: 'IRF-2026-0001',
      applicantName: 'Dr Eleanor Whitfield',
      applicantEmail: 'e.whitfield@imperial.ac.uk',
      status: ApplicationStatus.SUBMITTED,
      fileCount: 3,
      submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      assignmentCount: 2,
      completedAssessmentCount: 1,
    },
    assessorId: 'demo-assessor-001',
    assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: AssignmentStatus.IN_PROGRESS,
  },
  {
    id: 'demo-assign-002',
    applicationId: 'demo-app-002',
    application: {
      id: 'demo-app-002',
      callId: 'demo-001',
      reference: 'IRF-2026-0002',
      applicantName: 'Prof James Hargreaves',
      applicantEmail: 'j.hargreaves@ucl.ac.uk',
      status: ApplicationStatus.SUBMITTED,
      fileCount: 2,
      submittedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      assignmentCount: 2,
      completedAssessmentCount: 0,
    },
    assessorId: 'demo-assessor-001',
    assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
    status: AssignmentStatus.PENDING,
  },
  {
    id: 'demo-assign-003',
    applicationId: 'demo-app-003',
    application: {
      id: 'demo-app-003',
      callId: 'demo-002',
      reference: 'CARP-2026-0001',
      applicantName: 'Dr Amara Okonkwo',
      applicantEmail: 'a.okonkwo@oxford.ac.uk',
      status: ApplicationStatus.SUBMITTED,
      fileCount: 4,
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      assignmentCount: 2,
      completedAssessmentCount: 2,
    },
    assessorId: 'demo-assessor-002',
    assignedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: AssignmentStatus.COMPLETED,
  },
  {
    id: 'demo-assign-004',
    applicationId: 'demo-app-004',
    application: {
      id: 'demo-app-004',
      callId: 'demo-002',
      reference: 'CARP-2026-0002',
      applicantName: 'Dr Fiona Campbell',
      applicantEmail: 'f.campbell@edinburgh.ac.uk',
      status: ApplicationStatus.SUBMITTED,
      fileCount: 2,
      submittedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      assignmentCount: 2,
      completedAssessmentCount: 1,
    },
    assessorId: 'demo-assessor-003',
    assignedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: AssignmentStatus.IN_PROGRESS,
  },
];

const DEMO_ASSESSOR_POOL: AssessorPoolMember[] = [
  {
    id: 'demo-assessor-001',
    userId: 'demo-user-a001',
    name: 'Prof Margaret Thornton',
    email: 'm.thornton@cambridge.ac.uk',
    organisation: 'University of Cambridge',
    expertiseTags: ['quantum computing', 'materials science', 'nanotechnology'],
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    callId: 'demo-001',
    assignedCount: 4,
    completedCount: 2,
  },
  {
    id: 'demo-assessor-002',
    userId: 'demo-user-a002',
    name: 'Dr William Ashworth',
    email: 'w.ashworth@manchester.ac.uk',
    organisation: 'University of Manchester',
    expertiseTags: ['climate science', 'environmental modelling', 'sustainability'],
    isActive: true,
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    callId: 'demo-001',
    assignedCount: 3,
    completedCount: 3,
  },
  {
    id: 'demo-assessor-003',
    userId: 'demo-user-a003',
    name: 'Dr Sarah Pemberton',
    email: 's.pemberton@kcl.ac.uk',
    organisation: "King's College London",
    expertiseTags: ['digital health', 'bioinformatics', 'public health'],
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    callId: 'demo-001',
    assignedCount: 3,
    completedCount: 1,
  },
  {
    id: 'demo-assessor-004',
    userId: 'demo-user-a004',
    name: 'Prof Richard Llewellyn',
    email: 'r.llewellyn@cardiff.ac.uk',
    organisation: 'Cardiff University',
    expertiseTags: ['transport engineering', 'urban planning', 'energy systems'],
    isActive: true,
    createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    callId: 'demo-001',
    assignedCount: 2,
    completedCount: 0,
  },
];

const DEMO_CALL_PROGRESS: CallProgress = {
  callId: 'demo-001',
  callName: 'Innovation Research Fund 2026',
  status: CallStatus.IN_ASSESSMENT,
  totalApplications: 24,
  totalAssignments: 12,
  completedAssessments: 6,
  assessorProgress: [
    {
      assessorId: 'demo-assessor-001',
      assessorName: 'Prof Margaret Thornton',
      email: 'm.thornton@cambridge.ac.uk',
      assignedCount: 4,
      completedCount: 2,
      outstandingCount: 2,
      lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      assessorId: 'demo-assessor-002',
      assessorName: 'Dr William Ashworth',
      email: 'w.ashworth@manchester.ac.uk',
      assignedCount: 3,
      completedCount: 3,
      outstandingCount: 0,
      lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      assessorId: 'demo-assessor-003',
      assessorName: 'Dr Sarah Pemberton',
      email: 's.pemberton@kcl.ac.uk',
      assignedCount: 3,
      completedCount: 1,
      outstandingCount: 2,
      lastActivityAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      assessorId: 'demo-assessor-004',
      assessorName: 'Prof Richard Llewellyn',
      email: 'r.llewellyn@cardiff.ac.uk',
      assignedCount: 2,
      completedCount: 0,
      outstandingCount: 2,
    },
  ],
};

const DEMO_MASTER_RESULTS: MasterResults = {
  callId: 'demo-001',
  callName: 'Innovation Research Fund 2026',
  results: [
    {
      applicationId: 'demo-app-001',
      reference: 'IRF-2026-0001',
      applicantName: 'Dr Eleanor Whitfield',
      applicantOrganisation: 'Imperial College London',
      assessorScores: [
        {
          assessorId: 'demo-assessor-001',
          assessorName: 'Prof Margaret Thornton',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 85, maxScore: 100, comment: 'Excellent methodology and novel approach.' },
            { criterionId: 'c2', criterionName: 'Impact', score: 78, maxScore: 100, comment: 'Strong potential for real-world application.' },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 82, maxScore: 100, comment: 'Well-planned with clear milestones.' },
          ],
          overallScore: 82,
          overallComment: 'A strong proposal with clear innovation potential.',
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          assessorId: 'demo-assessor-002',
          assessorName: 'Dr William Ashworth',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 88, maxScore: 100, comment: 'Rigorous experimental design.' },
            { criterionId: 'c2', criterionName: 'Impact', score: 75, maxScore: 100, comment: 'Good societal benefit outlined.' },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 80, maxScore: 100, comment: 'Realistic timeline and budget.' },
          ],
          overallScore: 81,
          overallComment: 'Solid research plan with manageable scope.',
          submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      averageScore: 81.5,
      totalScore: 163,
      variance: 0.5,
      varianceFlagged: false,
      assessmentCount: 2,
      expectedAssessments: 2,
      isComplete: true,
    },
    {
      applicationId: 'demo-app-002',
      reference: 'IRF-2026-0002',
      applicantName: 'Prof James Hargreaves',
      applicantOrganisation: 'University College London',
      assessorScores: [
        {
          assessorId: 'demo-assessor-001',
          assessorName: 'Prof Margaret Thornton',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 72, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 68, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 75, maxScore: 100 },
          ],
          overallScore: 72,
          overallComment: 'Competent proposal but limited novelty.',
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          assessorId: 'demo-assessor-003',
          assessorName: 'Dr Sarah Pemberton',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 65, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 70, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 60, maxScore: 100 },
          ],
          overallScore: 65,
          overallComment: 'Needs clearer differentiation from existing work.',
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      averageScore: 68.5,
      totalScore: 137,
      variance: 24.5,
      varianceFlagged: true,
      assessmentCount: 2,
      expectedAssessments: 2,
      isComplete: true,
    },
    {
      applicationId: 'demo-app-003',
      reference: 'IRF-2026-0003',
      applicantName: 'Dr Amara Okonkwo',
      applicantOrganisation: 'University of Oxford',
      assessorScores: [
        {
          assessorId: 'demo-assessor-002',
          assessorName: 'Dr William Ashworth',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 90, maxScore: 100, comment: 'Outstanding theoretical framework.' },
            { criterionId: 'c2', criterionName: 'Impact', score: 88, maxScore: 100, comment: 'Transformative potential.' },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 85, maxScore: 100, comment: 'Strong team and infrastructure.' },
          ],
          overallScore: 88,
          overallComment: 'Exceptional proposal. Highly recommended for funding.',
          submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          assessorId: 'demo-assessor-003',
          assessorName: 'Dr Sarah Pemberton',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 86, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 84, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 82, maxScore: 100 },
          ],
          overallScore: 84,
          overallComment: 'Very strong application with clear societal benefits.',
          submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      averageScore: 86,
      totalScore: 172,
      variance: 8,
      varianceFlagged: false,
      assessmentCount: 2,
      expectedAssessments: 2,
      isComplete: true,
    },
    {
      applicationId: 'demo-app-005',
      reference: 'IRF-2026-0004',
      applicantName: 'Dr Fiona Campbell',
      applicantOrganisation: 'University of Edinburgh',
      assessorScores: [
        {
          assessorId: 'demo-assessor-001',
          assessorName: 'Prof Margaret Thornton',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 76, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 80, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 74, maxScore: 100 },
          ],
          overallScore: 77,
          overallComment: 'Good proposal with room for methodological improvement.',
          submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      averageScore: 77,
      totalScore: 77,
      variance: 0,
      varianceFlagged: false,
      assessmentCount: 1,
      expectedAssessments: 2,
      isComplete: false,
    },
    {
      applicationId: 'demo-app-006',
      reference: 'IRF-2026-0005',
      applicantName: 'Prof David Chen',
      applicantOrganisation: 'University of Bristol',
      assessorScores: [
        {
          assessorId: 'demo-assessor-002',
          assessorName: 'Dr William Ashworth',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 70, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 72, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 68, maxScore: 100 },
          ],
          overallScore: 70,
          overallComment: 'Adequate proposal but narrow scope limits impact.',
          submittedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          assessorId: 'demo-assessor-004',
          assessorName: 'Prof Richard Llewellyn',
          scores: [
            { criterionId: 'c1', criterionName: 'Scientific Merit', score: 74, maxScore: 100 },
            { criterionId: 'c2', criterionName: 'Impact', score: 69, maxScore: 100 },
            { criterionId: 'c3', criterionName: 'Feasibility', score: 71, maxScore: 100 },
          ],
          overallScore: 71,
          overallComment: 'Reasonable approach, recommend minor revisions.',
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      averageScore: 70.5,
      totalScore: 141,
      variance: 0.5,
      varianceFlagged: false,
      assessmentCount: 2,
      expectedAssessments: 2,
      isComplete: true,
    },
  ],
  totalApplications: 24,
  completedApplications: 4,
  averageVariance: 6.7,
  generatedAt: new Date().toISOString(),
};

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
    } catch {
      // Fallback to demo data when API is unavailable
      setAssignments(DEMO_ASSIGNMENTS);
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
    } catch {
      // Fallback to demo data when API is unavailable, filtered by callId
      const filtered = DEMO_ASSIGNMENTS.filter(
        (a) => a.application?.callId === callId
      );
      setAssignments(filtered);
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
    } catch {
      // Fallback to demo data when API is unavailable
      const pool = DEMO_ASSESSOR_POOL.map((a) => ({ ...a, callId: callId! }));
      setAssessors(pool);
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
    } catch {
      // Fallback to demo data when API is unavailable
      setProgress({ ...DEMO_CALL_PROGRESS, callId: callId! });
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
    } catch {
      // Fallback to demo data when API is unavailable
      setResults({ ...DEMO_MASTER_RESULTS, callId: callId! });
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
