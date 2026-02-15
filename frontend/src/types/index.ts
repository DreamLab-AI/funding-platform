// =============================================================================
// Types - Funding Application Platform
// =============================================================================

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export enum UserRole {
  APPLICANT = 'applicant',
  ASSESSOR = 'assessor',
  COORDINATOR = 'coordinator',
  SCHEME_OWNER = 'scheme_owner',
}

export enum CallStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  IN_ASSESSMENT = 'in_assessment',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  ASSESSED = 'assessed',
  WITHDRAWN = 'withdrawn',
}

export enum AssignmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  RETURNED = 'returned',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  RETURNED = 'returned',
}

export enum FileScanStatus {
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
  ERROR = 'error',
}

export enum ConfirmationType {
  GUIDANCE_READ = 'guidance_read',
  EDI_COMPLETED = 'edi_completed',
  DATA_SHARING_CONSENT = 'data_sharing_consent',
}

// -----------------------------------------------------------------------------
// User Types
// -----------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  organisation?: string;
  role?: UserRole;
}

// -----------------------------------------------------------------------------
// Funding Call Types
// -----------------------------------------------------------------------------

export interface Criterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight?: number;
  commentsRequired: boolean;
}

export interface SubmissionRequirements {
  allowedFileTypes: string[];
  maxFileSize: number; // in bytes
  maxFiles: number;
  requiredConfirmations: ConfirmationType[];
  guidanceText?: string;
  guidanceUrl?: string;
  ediUrl?: string;
}

export interface FundingCall {
  id: string;
  name: string;
  description: string;
  openAt: string;
  closeAt: string;
  status: CallStatus;
  requirements: SubmissionRequirements;
  criteria: Criterion[];
  assessorsPerApplication: number;
  varianceThreshold?: number;
  retentionYears: number;
  createdAt: string;
  updatedAt: string;
}

export interface FundingCallSummary {
  id: string;
  name: string;
  description: string;
  openAt: string;
  closeAt: string;
  status: CallStatus;
  applicationCount?: number;
  assessmentProgress?: number;
}

export interface CreateCallData {
  name: string;
  description: string;
  openAt: string;
  closeAt: string;
  requirements: SubmissionRequirements;
  criteria: Criterion[];
  assessorsPerApplication: number;
  varianceThreshold?: number;
  retentionYears?: number;
}

// -----------------------------------------------------------------------------
// Application Types
// -----------------------------------------------------------------------------

export interface ApplicationFile {
  id: string;
  applicationId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  scanStatus: FileScanStatus;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface Confirmation {
  id: string;
  applicationId: string;
  type: ConfirmationType;
  confirmedAt: string;
  ipAddress: string;
}

export interface Application {
  id: string;
  callId: string;
  call?: FundingCallSummary;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantOrganisation?: string;
  reference: string;
  status: ApplicationStatus;
  files: ApplicationFile[];
  confirmations: Confirmation[];
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSummary {
  id: string;
  callId: string;
  reference: string;
  applicantName: string;
  applicantEmail: string;
  status: ApplicationStatus;
  fileCount: number;
  submittedAt?: string;
  assignmentCount: number;
  completedAssessmentCount: number;
}

export interface CreateApplicationData {
  callId: string;
}

export interface SubmitApplicationData {
  confirmations: ConfirmationType[];
}

// -----------------------------------------------------------------------------
// Assessor Types
// -----------------------------------------------------------------------------

export interface Assessor {
  id: string;
  userId: string;
  name: string;
  email: string;
  organisation?: string;
  expertiseTags: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AssessorPoolMember extends Assessor {
  callId: string;
  assignedCount: number;
  completedCount: number;
}

export interface AddAssessorData {
  email: string;
  name: string;
  organisation?: string;
  expertiseTags?: string[];
}

// -----------------------------------------------------------------------------
// Assignment Types
// -----------------------------------------------------------------------------

export interface Assignment {
  id: string;
  applicationId: string;
  application?: ApplicationSummary;
  assessorId: string;
  assessor?: Assessor;
  assignedAt: string;
  dueAt?: string;
  status: AssignmentStatus;
}

export interface AssignApplicationsData {
  applicationIds: string[];
  assessorIds: string[];
  assignmentMethod: 'round_robin' | 'manual';
  dueAt?: string;
}

// -----------------------------------------------------------------------------
// Assessment Types
// -----------------------------------------------------------------------------

export interface CriterionScore {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface Assessment {
  id: string;
  assignmentId: string;
  assignment?: Assignment;
  scores: CriterionScore[];
  overallScore: number;
  overallComment?: string;
  coiConfirmed: boolean;
  coiDetails?: string;
  status: AssessmentStatus;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentDraft {
  scores: Partial<CriterionScore>[];
  overallComment?: string;
  coiConfirmed: boolean;
  coiDetails?: string;
}

export interface SubmitAssessmentData {
  scores: CriterionScore[];
  overallComment?: string;
  coiConfirmed: boolean;
  coiDetails?: string;
}

// -----------------------------------------------------------------------------
// Master Results Types
// -----------------------------------------------------------------------------

export interface AssessorScore {
  assessorId: string;
  assessorName: string;
  scores: CriterionScore[];
  overallScore: number;
  overallComment?: string;
  submittedAt: string;
}

export interface ApplicationResult {
  applicationId: string;
  reference: string;
  applicantName: string;
  applicantOrganisation?: string;
  assessorScores: AssessorScore[];
  averageScore: number;
  totalScore: number;
  variance: number;
  varianceFlagged: boolean;
  assessmentCount: number;
  expectedAssessments: number;
  isComplete: boolean;
}

export interface MasterResults {
  callId: string;
  callName: string;
  results: ApplicationResult[];
  totalApplications: number;
  completedApplications: number;
  averageVariance: number;
  generatedAt: string;
}

// -----------------------------------------------------------------------------
// Progress & Dashboard Types
// -----------------------------------------------------------------------------

export interface AssessorProgress {
  assessorId: string;
  assessorName: string;
  email: string;
  assignedCount: number;
  completedCount: number;
  outstandingCount: number;
  lastActivityAt?: string;
}

export interface CallProgress {
  callId: string;
  callName: string;
  status: CallStatus;
  totalApplications: number;
  totalAssignments: number;
  completedAssessments: number;
  assessorProgress: AssessorProgress[];
}

export interface CoordinatorDashboard {
  activeCalls: FundingCallSummary[];
  recentApplications: ApplicationSummary[];
  overallProgress: {
    totalCalls: number;
    openCalls: number;
    totalApplications: number;
    pendingAssessments: number;
  };
}

// -----------------------------------------------------------------------------
// Export Types
// -----------------------------------------------------------------------------

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  columns?: string[];
  includeFiles?: boolean;
}

export interface ExportResult {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------

export interface SendReminderData {
  assessorIds: string[];
  subject?: string;
  message?: string;
}

export interface ReminderResult {
  sent: number;
  failed: number;
  errors?: string[];
}

// -----------------------------------------------------------------------------
// Audit Log Types
// -----------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: UserRole;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress: string;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

// -----------------------------------------------------------------------------
// Filter & Sort Types
// -----------------------------------------------------------------------------

export interface ApplicationFilters {
  status?: ApplicationStatus;
  search?: string;
  submittedAfter?: string;
  submittedBefore?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}
