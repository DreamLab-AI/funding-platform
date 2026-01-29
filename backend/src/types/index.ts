import { Request } from 'express';

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  APPLICANT = 'applicant',
  ASSESSOR = 'assessor',
  COORDINATOR = 'coordinator',
  SCHEME_OWNER = 'scheme_owner',
  ADMIN = 'admin',
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
  WITHDRAWN = 'withdrawn',
  REOPENED = 'reopened',
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

export enum AuditAction {
  // User actions
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET = 'password_reset',

  // Call actions
  CALL_CREATED = 'call_created',
  CALL_UPDATED = 'call_updated',
  CALL_STATUS_CHANGED = 'call_status_changed',
  CALL_CLONED = 'call_cloned',

  // Application actions
  APPLICATION_CREATED = 'application_created',
  APPLICATION_UPDATED = 'application_updated',
  APPLICATION_SUBMITTED = 'application_submitted',
  APPLICATION_WITHDRAWN = 'application_withdrawn',
  APPLICATION_REOPENED = 'application_reopened',

  // File actions
  FILE_UPLOADED = 'file_uploaded',
  FILE_DOWNLOADED = 'file_downloaded',
  FILE_DELETED = 'file_deleted',

  // Assignment actions
  ASSESSOR_ASSIGNED = 'assessor_assigned',
  ASSESSOR_UNASSIGNED = 'assessor_unassigned',
  BULK_ASSIGNMENT = 'bulk_assignment',

  // Assessment actions
  ASSESSMENT_CREATED = 'assessment_created',
  ASSESSMENT_UPDATED = 'assessment_updated',
  ASSESSMENT_SUBMITTED = 'assessment_submitted',
  ASSESSMENT_RETURNED = 'assessment_returned',
  COI_DECLARED = 'coi_declared',

  // Export actions
  EXPORT_METADATA = 'export_metadata',
  EXPORT_RESULTS = 'export_results',
  EXPORT_FILES = 'export_files',

  // Admin actions
  CONFIG_CHANGED = 'config_changed',
  REMINDER_SENT = 'reminder_sent',

  // Nostr DID Authentication actions
  NOSTR_IDENTITY_LINKED = 'nostr_identity_linked',
  NOSTR_IDENTITY_UNLINKED = 'nostr_identity_unlinked',
  NOSTR_LOGIN = 'nostr_login',
  NOSTR_NIP05_VERIFIED = 'nostr_nip05_verified',
  NOSTR_CHALLENGE_CREATED = 'nostr_challenge_created',
  NOSTR_CHALLENGE_VERIFIED = 'nostr_challenge_verified',
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  user_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organisation?: string;
  expertise_tags?: string[];
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organisation?: string;
  expertise_tags?: string[];
}

export interface UserUpdateInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  organisation?: string;
  expertise_tags?: string[];
  is_active?: boolean;
}

export interface UserPublic {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organisation?: string;
  expertise_tags?: string[];
  is_active: boolean;
  created_at: Date;
}

export interface AuthenticatedUser {
  user_id: string;
  id: string; // Alias for user_id for Express compatibility
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// ============================================================================
// FUNDING CALL TYPES
// ============================================================================

export interface Criterion {
  criterion_id: string;
  name: string;
  description: string;
  max_points: number;
  weight?: number;
  comments_required: boolean;
  order: number;
}

export interface SubmissionRequirements {
  allowed_file_types: string[];
  max_file_size: number;
  required_confirmations: ConfirmationType[];
  guidance_text?: string;
  guidance_url?: string;
  edi_form_url?: string;
}

export interface FundingCall {
  call_id: string;
  name: string;
  description: string;
  open_at: Date;
  close_at: Date;
  status: CallStatus;
  submission_requirements: SubmissionRequirements;
  criteria: Criterion[];
  required_assessors_per_application: number;
  variance_threshold?: number;
  retention_years: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface FundingCallCreateInput {
  name: string;
  description: string;
  open_at: Date;
  close_at: Date;
  submission_requirements: SubmissionRequirements;
  criteria: Omit<Criterion, 'criterion_id'>[];
  required_assessors_per_application: number;
  variance_threshold?: number;
  retention_years?: number;
}

export interface FundingCallUpdateInput {
  name?: string;
  description?: string;
  open_at?: Date;
  close_at?: Date;
  status?: CallStatus;
  submission_requirements?: Partial<SubmissionRequirements>;
  criteria?: Partial<Criterion>[];
  required_assessors_per_application?: number;
  variance_threshold?: number;
  retention_years?: number;
}

export interface FundingCallSummary {
  call_id: string;
  name: string;
  description: string;
  open_at: Date;
  close_at: Date;
  status: CallStatus;
  application_count: number;
  assessor_count: number;
}

// ============================================================================
// APPLICATION TYPES
// ============================================================================

export interface ApplicationFile {
  file_id: string;
  application_id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  scan_status: FileScanStatus;
  uploaded_at: Date;
}

export interface Confirmation {
  confirmation_id: string;
  application_id: string;
  type: ConfirmationType;
  confirmed_at: Date;
  ip_address: string;
}

export interface Application {
  application_id: string;
  call_id: string;
  applicant_id: string;
  reference_number: string;
  applicant_name: string;
  applicant_email: string;
  applicant_organisation?: string;
  status: ApplicationStatus;
  files: ApplicationFile[];
  confirmations: Confirmation[];
  submitted_at?: Date;
  withdrawn_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationCreateInput {
  call_id: string;
}

export interface ApplicationUpdateInput {
  applicant_name?: string;
  applicant_organisation?: string;
}

export interface ApplicationListItem {
  application_id: string;
  reference_number: string;
  applicant_name: string;
  applicant_email: string;
  applicant_organisation?: string;
  status: ApplicationStatus;
  file_count: number;
  confirmation_count: number;
  assignment_count: number;
  completed_assessments: number;
  submitted_at?: Date;
  created_at: Date;
}

// ============================================================================
// ASSESSOR POOL TYPES
// ============================================================================

export interface AssessorPoolMember {
  pool_id: string;
  call_id: string;
  user_id: string;
  invited_at: Date;
  accepted_at?: Date;
  expertise_tags?: string[];
  is_active: boolean;
}

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

export interface Assignment {
  assignment_id: string;
  application_id: string;
  assessor_id: string;
  assigned_at: Date;
  assigned_by: string;
  due_at?: Date;
  status: AssignmentStatus;
  started_at?: Date;
  completed_at?: Date;
}

export interface AssignmentCreateInput {
  application_id: string;
  assessor_id: string;
  due_at?: Date;
}

export interface BulkAssignmentInput {
  application_ids: string[];
  assessor_ids: string[];
  strategy: 'round_robin' | 'random' | 'balanced';
  due_at?: Date;
}

export interface AssignmentWithDetails extends Assignment {
  application_reference: string;
  applicant_name: string;
  assessor_name: string;
  assessor_email: string;
  call_name: string;
}

// ============================================================================
// ASSESSMENT TYPES
// ============================================================================

export interface CriterionScore {
  criterion_id: string;
  score: number;
  comment?: string;
}

export interface Assessment {
  assessment_id: string;
  assignment_id: string;
  scores: CriterionScore[];
  overall_score: number;
  overall_comment?: string;
  coi_confirmed: boolean;
  coi_details?: string;
  status: AssessmentStatus;
  submitted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AssessmentCreateInput {
  assignment_id: string;
  scores?: CriterionScore[];
  overall_comment?: string;
  coi_confirmed?: boolean;
  coi_details?: string;
}

export interface AssessmentUpdateInput {
  scores?: CriterionScore[];
  overall_comment?: string;
  coi_confirmed?: boolean;
  coi_details?: string;
}

export interface AssessmentSubmitInput {
  scores: CriterionScore[];
  overall_comment?: string;
  coi_confirmed: boolean;
  coi_details?: string;
}

// ============================================================================
// MASTER RESULTS TYPES
// ============================================================================

export interface AssessorScore {
  assessor_id: string;
  assessor_name: string;
  scores: CriterionScore[];
  overall_score: number;
  overall_comment?: string;
  submitted_at?: Date;
}

export interface CriterionAggregate {
  criterion_id: string;
  criterion_name: string;
  max_points: number;
  weight?: number;
  scores: number[];
  average: number;
  min: number;
  max: number;
  variance: number;
  high_variance: boolean;
}

export interface ApplicationResult {
  application_id: string;
  reference_number: string;
  applicant_name: string;
  applicant_organisation?: string;
  assessor_scores: AssessorScore[];
  criterion_aggregates: CriterionAggregate[];
  total_average: number;
  weighted_average?: number;
  total_variance: number;
  high_variance_flag: boolean;
  assessments_completed: number;
  assessments_required: number;
}

export interface MasterResultsResponse {
  call_id: string;
  call_name: string;
  results: ApplicationResult[];
  summary: {
    total_applications: number;
    fully_assessed: number;
    partially_assessed: number;
    not_assessed: number;
    high_variance_count: number;
  };
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLog {
  event_id: string;
  actor_id?: string;
  actor_role?: UserRole;
  actor_email?: string;
  action: AuditAction;
  target_type: string;
  target_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

export interface AuditLogCreateInput {
  actor_id?: string;
  actor_role?: UserRole;
  actor_email?: string;
  action: AuditAction;
  target_type: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditLogQuery {
  actor_id?: string;
  action?: AuditAction;
  target_type?: string;
  target_id?: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  from_date?: Date;
  to_date?: Date;
}

// ============================================================================
// JWT TYPES
// ============================================================================

export interface JwtPayload {
  user_id: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface SubmissionReceiptData {
  applicant_name: string;
  application_reference: string;
  call_name: string;
  submitted_at: Date;
}

export interface AssessorAssignmentData {
  assessor_name: string;
  call_name: string;
  application_count: number;
  due_at?: Date;
  login_url: string;
}

export interface ReminderData {
  assessor_name: string;
  call_name: string;
  outstanding_count: number;
  due_at?: Date;
  login_url: string;
}

// ============================================================================
// PROGRESS/STATS TYPES
// ============================================================================

export interface AssessorProgress {
  assessor_id: string;
  assessor_name: string;
  assessor_email: string;
  assigned_count: number;
  completed_count: number;
  outstanding_count: number;
  last_activity?: Date;
}

export interface CallProgress {
  call_id: string;
  call_name: string;
  status: CallStatus;
  total_applications: number;
  total_assignments: number;
  completed_assessments: number;
  outstanding_assessments: number;
  completion_percentage: number;
  assessor_progress: AssessorProgress[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  columns?: string[];
  include_scores?: boolean;
  include_comments?: boolean;
}

export interface ExportResult {
  filename: string;
  content_type: string;
  buffer: Buffer;
}
