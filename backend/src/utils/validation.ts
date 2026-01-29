import { z } from 'zod';
import {
  UserRole,
  CallStatus,
  ApplicationStatus,
  ConfirmationType,
} from '../types';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z.string().email('Invalid email format').toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

export const dateRangeSchema = z.object({
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  role: z.nativeEnum(UserRole).default(UserRole.APPLICANT),
  organisation: z.string().max(200).optional(),
  expertise_tags: z.array(z.string()).optional(),
});

export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  organisation: z.string().max(200).optional(),
  expertise_tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// ============================================================================
// FUNDING CALL SCHEMAS
// ============================================================================

export const criterionSchema = z.object({
  criterion_id: uuidSchema.optional(),
  name: z.string().min(1, 'Criterion name is required').max(200),
  description: z.string().max(2000).optional().default(''),
  max_points: z.number().int().min(1).max(1000),
  weight: z.number().min(0).max(10).optional(),
  comments_required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

export const submissionRequirementsSchema = z.object({
  allowed_file_types: z.array(z.string()).min(1, 'At least one file type is required'),
  max_file_size: z.number().int().min(1).max(104857600), // Max 100MB
  required_confirmations: z.array(z.nativeEnum(ConfirmationType)).default([]),
  guidance_text: z.string().max(10000).optional(),
  guidance_url: z.string().url().optional(),
  edi_form_url: z.string().url().optional(),
});

export const fundingCallCreateSchema = z
  .object({
    name: z.string().min(1, 'Call name is required').max(200),
    description: z.string().max(10000).optional().default(''),
    open_at: z.coerce.date(),
    close_at: z.coerce.date(),
    submission_requirements: submissionRequirementsSchema,
    criteria: z.array(criterionSchema).min(1, 'At least one criterion is required'),
    required_assessors_per_application: z.number().int().min(1).max(10).default(2),
    variance_threshold: z.number().min(0).max(100).optional(),
    retention_years: z.number().int().min(1).max(25).default(7),
  })
  .refine((data) => data.close_at > data.open_at, {
    message: 'Close date must be after open date',
    path: ['close_at'],
  });

export const fundingCallUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  open_at: z.coerce.date().optional(),
  close_at: z.coerce.date().optional(),
  status: z.nativeEnum(CallStatus).optional(),
  submission_requirements: submissionRequirementsSchema.partial().optional(),
  criteria: z.array(criterionSchema).optional(),
  required_assessors_per_application: z.number().int().min(1).max(10).optional(),
  variance_threshold: z.number().min(0).max(100).optional(),
  retention_years: z.number().int().min(1).max(25).optional(),
});

// ============================================================================
// APPLICATION SCHEMAS
// ============================================================================

export const applicationCreateSchema = z.object({
  call_id: uuidSchema,
});

export const applicationUpdateSchema = z.object({
  applicant_name: z.string().min(1).max(200).optional(),
  applicant_organisation: z.string().max(200).optional(),
});

export const confirmationSchema = z.object({
  type: z.nativeEnum(ConfirmationType),
});

// ============================================================================
// ASSIGNMENT SCHEMAS
// ============================================================================

export const assignmentCreateSchema = z.object({
  application_id: uuidSchema,
  assessor_id: uuidSchema,
  due_at: z.coerce.date().optional(),
});

export const bulkAssignmentSchema = z.object({
  application_ids: z.array(uuidSchema).min(1, 'At least one application is required'),
  assessor_ids: z.array(uuidSchema).min(1, 'At least one assessor is required'),
  strategy: z.enum(['round_robin', 'random', 'balanced']).default('round_robin'),
  due_at: z.coerce.date().optional(),
});

// ============================================================================
// ASSESSMENT SCHEMAS
// ============================================================================

export const criterionScoreSchema = z.object({
  criterion_id: uuidSchema,
  score: z.number().min(0),
  comment: z.string().max(5000).optional(),
});

export const assessmentCreateSchema = z.object({
  assignment_id: uuidSchema,
  scores: z.array(criterionScoreSchema).optional(),
  overall_comment: z.string().max(10000).optional(),
  coi_confirmed: z.boolean().optional(),
  coi_details: z.string().max(2000).optional(),
});

export const assessmentUpdateSchema = z.object({
  scores: z.array(criterionScoreSchema).optional(),
  overall_comment: z.string().max(10000).optional(),
  coi_confirmed: z.boolean().optional(),
  coi_details: z.string().max(2000).optional(),
});

export const assessmentSubmitSchema = z.object({
  scores: z.array(criterionScoreSchema).min(1, 'At least one score is required'),
  overall_comment: z.string().max(10000).optional(),
  coi_confirmed: z.boolean().refine((val) => val === true, {
    message: 'COI declaration must be confirmed',
  }),
  coi_details: z.string().max(2000).optional(),
});

// ============================================================================
// ASSESSOR POOL SCHEMAS
// ============================================================================

export const assessorPoolAddSchema = z.object({
  user_id: uuidSchema,
  expertise_tags: z.array(z.string()).optional(),
});

export const assessorInviteSchema = z.object({
  email: emailSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  organisation: z.string().max(200).optional(),
  expertise_tags: z.array(z.string()).optional(),
});

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const exportOptionsSchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
  columns: z.array(z.string()).optional(),
  include_scores: z.boolean().default(true),
  include_comments: z.boolean().default(true),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

export const applicationQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ApplicationStatus).optional(),
  search: z.string().optional(),
});

export const assessmentQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ApplicationStatus).optional(),
});

export const auditLogQuerySchema = paginationSchema.extend({
  actor_id: uuidSchema.optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: uuidSchema.optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export type ValidatedData<T extends z.ZodSchema> = z.infer<T>;

export function validateData<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

export function validatePartialData<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  data: unknown
): Partial<z.infer<T>> {
  const partialSchema = schema.partial();
  return partialSchema.parse(data) as Partial<z.infer<T>>;
}
