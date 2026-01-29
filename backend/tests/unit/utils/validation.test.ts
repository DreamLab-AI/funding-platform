/**
 * Validation Schemas Unit Tests
 * Tests all Zod schemas in utils/validation.ts
 */

import { ZodError } from 'zod';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  paginationSchema,
  dateRangeSchema,
  userCreateSchema,
  userUpdateSchema,
  loginSchema,
  refreshTokenSchema,
  criterionSchema,
  submissionRequirementsSchema,
  fundingCallCreateSchema,
  fundingCallUpdateSchema,
  applicationCreateSchema,
  applicationUpdateSchema,
  confirmationSchema,
  assignmentCreateSchema,
  bulkAssignmentSchema,
  criterionScoreSchema,
  assessmentCreateSchema,
  assessmentUpdateSchema,
  assessmentSubmitSchema,
  assessorPoolAddSchema,
  assessorInviteSchema,
  exportOptionsSchema,
  applicationQuerySchema,
  assessmentQuerySchema,
  auditLogQuerySchema,
  validateData,
  validatePartialData,
} from '../../../src/utils/validation';
import { UserRole, CallStatus, ApplicationStatus, ConfirmationType } from '../../../src/types';

describe('Validation Schemas', () => {
  // ============================================================================
  // UUID SCHEMA
  // ============================================================================
  describe('uuidSchema', () => {
    it('should accept valid UUID v4', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => uuidSchema.parse(validUUID)).not.toThrow();
    });

    it('should accept valid UUID with lowercase', () => {
      const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(() => uuidSchema.parse(validUUID)).not.toThrow();
    });

    it('should reject invalid UUID format', () => {
      expect(() => uuidSchema.parse('invalid-uuid')).toThrow(ZodError);
      expect(() => uuidSchema.parse('123')).toThrow(ZodError);
      expect(() => uuidSchema.parse('')).toThrow(ZodError);
    });

    it('should reject non-string values', () => {
      expect(() => uuidSchema.parse(123)).toThrow(ZodError);
      expect(() => uuidSchema.parse(null)).toThrow(ZodError);
      expect(() => uuidSchema.parse(undefined)).toThrow(ZodError);
    });

    it('should provide correct error message for invalid UUID', () => {
      try {
        uuidSchema.parse('not-a-uuid');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].message).toBe('Invalid UUID format');
      }
    });
  });

  // ============================================================================
  // EMAIL SCHEMA
  // ============================================================================
  describe('emailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com',
      ];
      validEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    });

    it('should convert email to lowercase', () => {
      const result = emailSchema.parse('Test@Example.COM');
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'missing@.com',
        'spaces in@email.com',
        '',
      ];
      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow(ZodError);
      });
    });

    it('should provide correct error message', () => {
      try {
        emailSchema.parse('invalid');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].message).toBe('Invalid email format');
      }
    });
  });

  // ============================================================================
  // PASSWORD SCHEMA
  // ============================================================================
  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      const validPasswords = [
        'Password1!',
        'StrongP@ss123',
        'MySecure$Pass99',
        'Abcd1234!efgh',
      ];
      validPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).not.toThrow();
      });
    });

    it('should reject passwords that are too short', () => {
      expect(() => passwordSchema.parse('Pass1!')).toThrow(ZodError);
    });

    it('should reject passwords without uppercase', () => {
      expect(() => passwordSchema.parse('password1!')).toThrow(ZodError);
    });

    it('should reject passwords without lowercase', () => {
      expect(() => passwordSchema.parse('PASSWORD1!')).toThrow(ZodError);
    });

    it('should reject passwords without numbers', () => {
      expect(() => passwordSchema.parse('Password!')).toThrow(ZodError);
    });

    it('should reject passwords without special characters', () => {
      expect(() => passwordSchema.parse('Password123')).toThrow(ZodError);
    });

    it('should reject passwords that are too long', () => {
      const longPassword = 'P@ss1' + 'a'.repeat(130);
      expect(() => passwordSchema.parse(longPassword)).toThrow(ZodError);
    });

    it('should provide descriptive error messages', () => {
      try {
        passwordSchema.parse('short');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors.some((e) => e.message.includes('8 characters'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // PAGINATION SCHEMA
  // ============================================================================
  describe('paginationSchema', () => {
    it('should accept valid pagination params', () => {
      const result = paginationSchema.parse({
        page: 1,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sort_order).toBe('desc');
    });

    it('should apply default values', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sort_order).toBe('asc');
    });

    it('should coerce string numbers to integers', () => {
      const result = paginationSchema.parse({
        page: '5',
        limit: '50',
      });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ page: -1 })).toThrow(ZodError);
    });

    it('should reject limit greater than 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow(ZodError);
    });

    it('should reject invalid sort_order', () => {
      expect(() => paginationSchema.parse({ sort_order: 'invalid' })).toThrow(ZodError);
    });
  });

  // ============================================================================
  // DATE RANGE SCHEMA
  // ============================================================================
  describe('dateRangeSchema', () => {
    it('should accept valid date range', () => {
      const result = dateRangeSchema.parse({
        from_date: '2024-01-01',
        to_date: '2024-12-31',
      });
      expect(result.from_date).toBeInstanceOf(Date);
      expect(result.to_date).toBeInstanceOf(Date);
    });

    it('should accept Date objects', () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const result = dateRangeSchema.parse({ from_date: from, to_date: to });
      expect(result.from_date).toBeInstanceOf(Date);
      expect(result.to_date).toBeInstanceOf(Date);
    });

    it('should allow optional dates', () => {
      const result = dateRangeSchema.parse({});
      expect(result.from_date).toBeUndefined();
      expect(result.to_date).toBeUndefined();
    });

    it('should reject invalid date strings', () => {
      expect(() => dateRangeSchema.parse({ from_date: 'not-a-date' })).toThrow(ZodError);
    });
  });

  // ============================================================================
  // USER CREATE SCHEMA
  // ============================================================================
  describe('userCreateSchema', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'SecureP@ss123',
      first_name: 'John',
      last_name: 'Doe',
      role: UserRole.APPLICANT,
    };

    it('should accept valid user data', () => {
      const result = userCreateSchema.parse(validUser);
      expect(result.email).toBe('test@example.com');
      expect(result.first_name).toBe('John');
    });

    it('should apply default role', () => {
      const { role, ...userWithoutRole } = validUser;
      const result = userCreateSchema.parse(userWithoutRole);
      expect(result.role).toBe(UserRole.APPLICANT);
    });

    it('should accept optional fields', () => {
      const result = userCreateSchema.parse({
        ...validUser,
        organisation: 'Test Org',
        expertise_tags: ['AI', 'ML'],
      });
      expect(result.organisation).toBe('Test Org');
      expect(result.expertise_tags).toEqual(['AI', 'ML']);
    });

    it('should reject missing required fields', () => {
      expect(() => userCreateSchema.parse({ email: 'test@example.com' })).toThrow(ZodError);
      expect(() => userCreateSchema.parse({ password: 'SecureP@ss123' })).toThrow(ZodError);
    });

    it('should reject empty first_name', () => {
      expect(() => userCreateSchema.parse({ ...validUser, first_name: '' })).toThrow(ZodError);
    });

    it('should reject first_name exceeding max length', () => {
      expect(() =>
        userCreateSchema.parse({ ...validUser, first_name: 'a'.repeat(101) })
      ).toThrow(ZodError);
    });

    it('should reject invalid role enum', () => {
      expect(() =>
        userCreateSchema.parse({ ...validUser, role: 'invalid_role' })
      ).toThrow(ZodError);
    });

    it('should accept all valid roles', () => {
      Object.values(UserRole).forEach((role) => {
        expect(() => userCreateSchema.parse({ ...validUser, role })).not.toThrow();
      });
    });
  });

  // ============================================================================
  // USER UPDATE SCHEMA
  // ============================================================================
  describe('userUpdateSchema', () => {
    it('should accept partial updates', () => {
      const result = userUpdateSchema.parse({ first_name: 'Jane' });
      expect(result.first_name).toBe('Jane');
    });

    it('should accept empty object', () => {
      const result = userUpdateSchema.parse({});
      expect(result).toEqual({});
    });

    it('should validate email format when provided', () => {
      expect(() => userUpdateSchema.parse({ email: 'invalid' })).toThrow(ZodError);
    });

    it('should accept is_active boolean', () => {
      const result = userUpdateSchema.parse({ is_active: false });
      expect(result.is_active).toBe(false);
    });
  });

  // ============================================================================
  // LOGIN SCHEMA
  // ============================================================================
  describe('loginSchema', () => {
    it('should accept valid login credentials', () => {
      const result = loginSchema.parse({
        email: 'user@example.com',
        password: 'mypassword',
      });
      expect(result.email).toBe('user@example.com');
    });

    it('should reject empty password', () => {
      expect(() =>
        loginSchema.parse({ email: 'user@example.com', password: '' })
      ).toThrow(ZodError);
    });

    it('should convert email to lowercase', () => {
      const result = loginSchema.parse({
        email: 'USER@EXAMPLE.COM',
        password: 'password',
      });
      expect(result.email).toBe('user@example.com');
    });
  });

  // ============================================================================
  // REFRESH TOKEN SCHEMA
  // ============================================================================
  describe('refreshTokenSchema', () => {
    it('should accept valid refresh token', () => {
      const result = refreshTokenSchema.parse({ refresh_token: 'some-token-value' });
      expect(result.refresh_token).toBe('some-token-value');
    });

    it('should reject empty refresh token', () => {
      expect(() => refreshTokenSchema.parse({ refresh_token: '' })).toThrow(ZodError);
    });

    it('should provide correct error message', () => {
      try {
        refreshTokenSchema.parse({ refresh_token: '' });
        fail('Should have thrown');
      } catch (error) {
        const zodError = error as ZodError;
        expect(zodError.errors[0].message).toBe('Refresh token is required');
      }
    });
  });

  // ============================================================================
  // CRITERION SCHEMA
  // ============================================================================
  describe('criterionSchema', () => {
    it('should accept valid criterion', () => {
      const criterion = {
        name: 'Impact',
        max_points: 10,
      };
      const result = criterionSchema.parse(criterion);
      expect(result.name).toBe('Impact');
      expect(result.max_points).toBe(10);
    });

    it('should apply defaults', () => {
      const result = criterionSchema.parse({ name: 'Test', max_points: 5 });
      expect(result.description).toBe('');
      expect(result.comments_required).toBe(false);
      expect(result.order).toBe(0);
    });

    it('should accept optional fields', () => {
      const result = criterionSchema.parse({
        criterion_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        max_points: 10,
        weight: 2.5,
        comments_required: true,
        order: 1,
      });
      expect(result.weight).toBe(2.5);
      expect(result.comments_required).toBe(true);
    });

    it('should reject empty name', () => {
      expect(() => criterionSchema.parse({ name: '', max_points: 10 })).toThrow(ZodError);
    });

    it('should reject max_points below 1', () => {
      expect(() => criterionSchema.parse({ name: 'Test', max_points: 0 })).toThrow(ZodError);
    });

    it('should reject max_points above 1000', () => {
      expect(() => criterionSchema.parse({ name: 'Test', max_points: 1001 })).toThrow(ZodError);
    });

    it('should reject weight above 10', () => {
      expect(() =>
        criterionSchema.parse({ name: 'Test', max_points: 10, weight: 11 })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // SUBMISSION REQUIREMENTS SCHEMA
  // ============================================================================
  describe('submissionRequirementsSchema', () => {
    const validRequirements = {
      allowed_file_types: ['pdf', 'docx'],
      max_file_size: 10485760, // 10MB
    };

    it('should accept valid requirements', () => {
      const result = submissionRequirementsSchema.parse(validRequirements);
      expect(result.allowed_file_types).toEqual(['pdf', 'docx']);
      expect(result.max_file_size).toBe(10485760);
    });

    it('should apply defaults', () => {
      const result = submissionRequirementsSchema.parse(validRequirements);
      expect(result.required_confirmations).toEqual([]);
    });

    it('should accept optional URLs', () => {
      const result = submissionRequirementsSchema.parse({
        ...validRequirements,
        guidance_url: 'https://example.com/guide',
        edi_form_url: 'https://example.com/edi',
      });
      expect(result.guidance_url).toBe('https://example.com/guide');
    });

    it('should reject empty allowed_file_types array', () => {
      expect(() =>
        submissionRequirementsSchema.parse({
          allowed_file_types: [],
          max_file_size: 1000,
        })
      ).toThrow(ZodError);
    });

    it('should reject max_file_size above 100MB', () => {
      expect(() =>
        submissionRequirementsSchema.parse({
          allowed_file_types: ['pdf'],
          max_file_size: 104857601,
        })
      ).toThrow(ZodError);
    });

    it('should reject invalid guidance_url', () => {
      expect(() =>
        submissionRequirementsSchema.parse({
          ...validRequirements,
          guidance_url: 'not-a-url',
        })
      ).toThrow(ZodError);
    });

    it('should accept valid confirmation types', () => {
      const result = submissionRequirementsSchema.parse({
        ...validRequirements,
        required_confirmations: [ConfirmationType.GUIDANCE_READ, ConfirmationType.EDI_COMPLETED],
      });
      expect(result.required_confirmations).toHaveLength(2);
    });
  });

  // ============================================================================
  // FUNDING CALL CREATE SCHEMA
  // ============================================================================
  describe('fundingCallCreateSchema', () => {
    const validCall = {
      name: 'Research Grant 2024',
      open_at: new Date('2024-01-01'),
      close_at: new Date('2024-06-30'),
      submission_requirements: {
        allowed_file_types: ['pdf'],
        max_file_size: 10485760,
      },
      criteria: [{ name: 'Impact', max_points: 10 }],
    };

    it('should accept valid funding call', () => {
      const result = fundingCallCreateSchema.parse(validCall);
      expect(result.name).toBe('Research Grant 2024');
      expect(result.criteria).toHaveLength(1);
    });

    it('should apply defaults', () => {
      const result = fundingCallCreateSchema.parse(validCall);
      expect(result.description).toBe('');
      expect(result.required_assessors_per_application).toBe(2);
      expect(result.retention_years).toBe(7);
    });

    it('should reject empty name', () => {
      expect(() => fundingCallCreateSchema.parse({ ...validCall, name: '' })).toThrow(ZodError);
    });

    it('should reject close_at before open_at', () => {
      expect(() =>
        fundingCallCreateSchema.parse({
          ...validCall,
          open_at: new Date('2024-06-30'),
          close_at: new Date('2024-01-01'),
        })
      ).toThrow(ZodError);
    });

    it('should reject empty criteria array', () => {
      expect(() => fundingCallCreateSchema.parse({ ...validCall, criteria: [] })).toThrow(
        ZodError
      );
    });

    it('should reject required_assessors above 10', () => {
      expect(() =>
        fundingCallCreateSchema.parse({
          ...validCall,
          required_assessors_per_application: 11,
        })
      ).toThrow(ZodError);
    });

    it('should reject retention_years above 25', () => {
      expect(() =>
        fundingCallCreateSchema.parse({
          ...validCall,
          retention_years: 26,
        })
      ).toThrow(ZodError);
    });

    it('should coerce date strings to Date objects', () => {
      const result = fundingCallCreateSchema.parse({
        ...validCall,
        open_at: '2024-01-01',
        close_at: '2024-06-30',
      });
      expect(result.open_at).toBeInstanceOf(Date);
      expect(result.close_at).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // FUNDING CALL UPDATE SCHEMA
  // ============================================================================
  describe('fundingCallUpdateSchema', () => {
    it('should accept partial updates', () => {
      const result = fundingCallUpdateSchema.parse({ name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should accept status update', () => {
      const result = fundingCallUpdateSchema.parse({ status: CallStatus.OPEN });
      expect(result.status).toBe(CallStatus.OPEN);
    });

    it('should accept empty object', () => {
      const result = fundingCallUpdateSchema.parse({});
      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // APPLICATION CREATE SCHEMA
  // ============================================================================
  describe('applicationCreateSchema', () => {
    it('should accept valid call_id', () => {
      const result = applicationCreateSchema.parse({
        call_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.call_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid call_id', () => {
      expect(() => applicationCreateSchema.parse({ call_id: 'invalid' })).toThrow(ZodError);
    });

    it('should reject missing call_id', () => {
      expect(() => applicationCreateSchema.parse({})).toThrow(ZodError);
    });
  });

  // ============================================================================
  // APPLICATION UPDATE SCHEMA
  // ============================================================================
  describe('applicationUpdateSchema', () => {
    it('should accept valid updates', () => {
      const result = applicationUpdateSchema.parse({
        applicant_name: 'Jane Doe',
        applicant_organisation: 'University',
      });
      expect(result.applicant_name).toBe('Jane Doe');
    });

    it('should reject empty applicant_name when provided', () => {
      expect(() => applicationUpdateSchema.parse({ applicant_name: '' })).toThrow(ZodError);
    });

    it('should accept empty object', () => {
      const result = applicationUpdateSchema.parse({});
      expect(result).toEqual({});
    });
  });

  // ============================================================================
  // CONFIRMATION SCHEMA
  // ============================================================================
  describe('confirmationSchema', () => {
    it('should accept valid confirmation types', () => {
      Object.values(ConfirmationType).forEach((type) => {
        expect(() => confirmationSchema.parse({ type })).not.toThrow();
      });
    });

    it('should reject invalid confirmation type', () => {
      expect(() => confirmationSchema.parse({ type: 'invalid' })).toThrow(ZodError);
    });
  });

  // ============================================================================
  // ASSIGNMENT CREATE SCHEMA
  // ============================================================================
  describe('assignmentCreateSchema', () => {
    it('should accept valid assignment', () => {
      const result = assignmentCreateSchema.parse({
        application_id: '123e4567-e89b-12d3-a456-426614174000',
        assessor_id: '223e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.application_id).toBeDefined();
      expect(result.assessor_id).toBeDefined();
    });

    it('should accept optional due_at', () => {
      const result = assignmentCreateSchema.parse({
        application_id: '123e4567-e89b-12d3-a456-426614174000',
        assessor_id: '223e4567-e89b-12d3-a456-426614174001',
        due_at: '2024-12-31',
      });
      expect(result.due_at).toBeInstanceOf(Date);
    });

    it('should reject invalid UUIDs', () => {
      expect(() =>
        assignmentCreateSchema.parse({
          application_id: 'invalid',
          assessor_id: '223e4567-e89b-12d3-a456-426614174001',
        })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // BULK ASSIGNMENT SCHEMA
  // ============================================================================
  describe('bulkAssignmentSchema', () => {
    it('should accept valid bulk assignment', () => {
      const result = bulkAssignmentSchema.parse({
        application_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        assessor_ids: ['223e4567-e89b-12d3-a456-426614174001'],
        strategy: 'round_robin',
      });
      expect(result.strategy).toBe('round_robin');
    });

    it('should apply default strategy', () => {
      const result = bulkAssignmentSchema.parse({
        application_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        assessor_ids: ['223e4567-e89b-12d3-a456-426614174001'],
      });
      expect(result.strategy).toBe('round_robin');
    });

    it('should reject empty application_ids', () => {
      expect(() =>
        bulkAssignmentSchema.parse({
          application_ids: [],
          assessor_ids: ['223e4567-e89b-12d3-a456-426614174001'],
        })
      ).toThrow(ZodError);
    });

    it('should reject empty assessor_ids', () => {
      expect(() =>
        bulkAssignmentSchema.parse({
          application_ids: ['123e4567-e89b-12d3-a456-426614174000'],
          assessor_ids: [],
        })
      ).toThrow(ZodError);
    });

    it('should reject invalid strategy', () => {
      expect(() =>
        bulkAssignmentSchema.parse({
          application_ids: ['123e4567-e89b-12d3-a456-426614174000'],
          assessor_ids: ['223e4567-e89b-12d3-a456-426614174001'],
          strategy: 'invalid',
        })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // CRITERION SCORE SCHEMA
  // ============================================================================
  describe('criterionScoreSchema', () => {
    it('should accept valid score', () => {
      const result = criterionScoreSchema.parse({
        criterion_id: '123e4567-e89b-12d3-a456-426614174000',
        score: 8,
      });
      expect(result.score).toBe(8);
    });

    it('should accept optional comment', () => {
      const result = criterionScoreSchema.parse({
        criterion_id: '123e4567-e89b-12d3-a456-426614174000',
        score: 8,
        comment: 'Good work',
      });
      expect(result.comment).toBe('Good work');
    });

    it('should reject negative score', () => {
      expect(() =>
        criterionScoreSchema.parse({
          criterion_id: '123e4567-e89b-12d3-a456-426614174000',
          score: -1,
        })
      ).toThrow(ZodError);
    });

    it('should reject comment exceeding max length', () => {
      expect(() =>
        criterionScoreSchema.parse({
          criterion_id: '123e4567-e89b-12d3-a456-426614174000',
          score: 5,
          comment: 'a'.repeat(5001),
        })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // ASSESSMENT CREATE SCHEMA
  // ============================================================================
  describe('assessmentCreateSchema', () => {
    it('should accept valid assessment', () => {
      const result = assessmentCreateSchema.parse({
        assignment_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.assignment_id).toBeDefined();
    });

    it('should accept optional fields', () => {
      const result = assessmentCreateSchema.parse({
        assignment_id: '123e4567-e89b-12d3-a456-426614174000',
        scores: [
          { criterion_id: '223e4567-e89b-12d3-a456-426614174001', score: 8 },
        ],
        overall_comment: 'Great application',
        coi_confirmed: true,
        coi_details: 'None',
      });
      expect(result.scores).toHaveLength(1);
      expect(result.coi_confirmed).toBe(true);
    });
  });

  // ============================================================================
  // ASSESSMENT UPDATE SCHEMA
  // ============================================================================
  describe('assessmentUpdateSchema', () => {
    it('should accept partial updates', () => {
      const result = assessmentUpdateSchema.parse({
        overall_comment: 'Updated comment',
      });
      expect(result.overall_comment).toBe('Updated comment');
    });

    it('should accept empty object', () => {
      const result = assessmentUpdateSchema.parse({});
      expect(result).toEqual({});
    });

    it('should reject overall_comment exceeding max length', () => {
      expect(() =>
        assessmentUpdateSchema.parse({ overall_comment: 'a'.repeat(10001) })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // ASSESSMENT SUBMIT SCHEMA
  // ============================================================================
  describe('assessmentSubmitSchema', () => {
    const validSubmission = {
      scores: [
        { criterion_id: '123e4567-e89b-12d3-a456-426614174000', score: 8 },
      ],
      coi_confirmed: true,
    };

    it('should accept valid submission', () => {
      const result = assessmentSubmitSchema.parse(validSubmission);
      expect(result.scores).toHaveLength(1);
      expect(result.coi_confirmed).toBe(true);
    });

    it('should reject empty scores array', () => {
      expect(() =>
        assessmentSubmitSchema.parse({
          scores: [],
          coi_confirmed: true,
        })
      ).toThrow(ZodError);
    });

    it('should reject coi_confirmed as false', () => {
      expect(() =>
        assessmentSubmitSchema.parse({
          ...validSubmission,
          coi_confirmed: false,
        })
      ).toThrow(ZodError);
    });

    it('should provide correct error message for COI', () => {
      try {
        assessmentSubmitSchema.parse({
          ...validSubmission,
          coi_confirmed: false,
        });
        fail('Should have thrown');
      } catch (error) {
        const zodError = error as ZodError;
        expect(
          zodError.errors.some((e) => e.message.includes('COI declaration must be confirmed'))
        ).toBe(true);
      }
    });
  });

  // ============================================================================
  // ASSESSOR POOL ADD SCHEMA
  // ============================================================================
  describe('assessorPoolAddSchema', () => {
    it('should accept valid assessor', () => {
      const result = assessorPoolAddSchema.parse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.user_id).toBeDefined();
    });

    it('should accept optional expertise_tags', () => {
      const result = assessorPoolAddSchema.parse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        expertise_tags: ['AI', 'ML', 'NLP'],
      });
      expect(result.expertise_tags).toEqual(['AI', 'ML', 'NLP']);
    });
  });

  // ============================================================================
  // ASSESSOR INVITE SCHEMA
  // ============================================================================
  describe('assessorInviteSchema', () => {
    it('should accept valid invite', () => {
      const result = assessorInviteSchema.parse({
        email: 'assessor@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
      });
      expect(result.email).toBe('assessor@example.com');
    });

    it('should accept optional fields', () => {
      const result = assessorInviteSchema.parse({
        email: 'assessor@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        organisation: 'University',
        expertise_tags: ['Physics'],
      });
      expect(result.organisation).toBe('University');
    });

    it('should reject empty first_name', () => {
      expect(() =>
        assessorInviteSchema.parse({
          email: 'assessor@example.com',
          first_name: '',
          last_name: 'Doe',
        })
      ).toThrow(ZodError);
    });
  });

  // ============================================================================
  // EXPORT OPTIONS SCHEMA
  // ============================================================================
  describe('exportOptionsSchema', () => {
    it('should accept valid export options', () => {
      const result = exportOptionsSchema.parse({
        format: 'csv',
      });
      expect(result.format).toBe('csv');
    });

    it('should apply defaults', () => {
      const result = exportOptionsSchema.parse({});
      expect(result.format).toBe('xlsx');
      expect(result.include_scores).toBe(true);
      expect(result.include_comments).toBe(true);
    });

    it('should accept optional columns', () => {
      const result = exportOptionsSchema.parse({
        columns: ['name', 'score', 'comment'],
      });
      expect(result.columns).toEqual(['name', 'score', 'comment']);
    });

    it('should reject invalid format', () => {
      expect(() => exportOptionsSchema.parse({ format: 'pdf' })).toThrow(ZodError);
    });
  });

  // ============================================================================
  // APPLICATION QUERY SCHEMA
  // ============================================================================
  describe('applicationQuerySchema', () => {
    it('should extend pagination with application-specific fields', () => {
      const result = applicationQuerySchema.parse({
        page: 2,
        limit: 10,
        status: ApplicationStatus.SUBMITTED,
        search: 'test',
      });
      expect(result.page).toBe(2);
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
      expect(result.search).toBe('test');
    });

    it('should apply pagination defaults', () => {
      const result = applicationQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  // ============================================================================
  // ASSESSMENT QUERY SCHEMA
  // ============================================================================
  describe('assessmentQuerySchema', () => {
    it('should extend pagination with assessment-specific fields', () => {
      const result = assessmentQuerySchema.parse({
        status: ApplicationStatus.SUBMITTED,
      });
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
    });
  });

  // ============================================================================
  // AUDIT LOG QUERY SCHEMA
  // ============================================================================
  describe('auditLogQuerySchema', () => {
    it('should accept all filter options', () => {
      const result = auditLogQuerySchema.parse({
        actor_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'user_login',
        target_type: 'user',
        target_id: '223e4567-e89b-12d3-a456-426614174001',
        from_date: '2024-01-01',
        to_date: '2024-12-31',
      });
      expect(result.actor_id).toBeDefined();
      expect(result.from_date).toBeInstanceOf(Date);
    });

    it('should apply pagination defaults', () => {
      const result = auditLogQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================
  describe('validateData', () => {
    it('should return parsed data for valid input', () => {
      const result = validateData(uuidSchema, '123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw ZodError for invalid input', () => {
      expect(() => validateData(uuidSchema, 'invalid')).toThrow(ZodError);
    });
  });

  describe('validatePartialData', () => {
    it('should return partial parsed data', () => {
      const result = validatePartialData(userCreateSchema, { first_name: 'John' });
      expect(result.first_name).toBe('John');
      expect(result.email).toBeUndefined();
    });

    it('should validate provided fields', () => {
      expect(() =>
        validatePartialData(userCreateSchema, { email: 'invalid-email' })
      ).toThrow(ZodError);
    });
  });
});
