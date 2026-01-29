/**
 * Assessments Controller Unit Tests
 * Tests for assessment creation, scoring, updating, and submission
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from '../../helpers/testUtils';
import { UserRole } from '../../../src/types';

// Helper to flush promises - asyncHandler returns void
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock database pool
const mockQuery = jest.fn();
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: (...args: any[]) => mockQuery(...args),
  },
}));

// Mock scoring service
const mockScoringService = {
  calculateTotal: jest.fn(),
  validateScores: jest.fn(),
};
jest.mock('../../../src/services/scoring.service', () => ({
  scoringService: mockScoringService,
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

import { assessmentsController } from '../../../src/controllers/assessments.controller';

describe('Assessments Controller', () => {
  let mockReq: any;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  const mockUserId = uuidv4();
  const mockAssignmentId = uuidv4();
  const mockApplicationId = uuidv4();
  const mockAssessmentId = uuidv4();
  const mockCallId = uuidv4();

  const mockAssignment = {
    id: mockAssignmentId,
    application_id: mockApplicationId,
    assessor_id: mockUserId,
    due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending',
  };

  const mockAssessment = {
    id: mockAssessmentId,
    assignment_id: mockAssignmentId,
    scores: JSON.stringify([
      { criterion_id: 'c1', score: 8 },
      { criterion_id: 'c2', score: 7 },
    ]),
    overall_comment: 'Good application',
    coi_confirmed: true,
    total_score: 15,
    status: 'draft',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = { id: mockUserId, role: UserRole.ASSESSOR };
  });

  // =========================================================================
  // GET MY ASSESSMENTS TESTS
  // =========================================================================

  describe('getMyAssessments', () => {
    it('should return assessor assignments successfully (200)', async () => {
      const assignments = [
        {
          ...mockAssignment,
          reference_number: 'REF001',
          call_name: 'Test Call',
          assessment_id: mockAssessmentId,
          assessment_status: 'draft',
        },
      ];
      mockQuery.mockResolvedValue({ rows: assignments });

      assessmentsController.getMyAssessments(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ass.assessor_id = $1'),
        [mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assignments,
      });
    });

    it('should return empty array when no assignments', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.getMyAssessments(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error (500)', async () => {
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      assessmentsController.getMyAssessments(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // =========================================================================
  // GET BY ASSIGNMENT TESTS
  // =========================================================================

  describe('getByAssignment', () => {
    it('should return assessment by assignment ID (200)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      const assessmentData = {
        ...mockAssessment,
        application_content: { title: 'Test' },
        criteria_config: [{ id: 'c1', name: 'Criterion 1' }],
      };
      mockQuery.mockResolvedValue({ rows: [assessmentData] });

      assessmentsController.getByAssignment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ass.id = $1 AND ass.assessor_id = $2'),
        [mockAssignmentId, mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assessmentData,
      });
    });

    it('should throw 404 when assignment not found', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.getByAssignment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Assignment not found',
        })
      );
    });

    it('should not allow accessing another assessor assignment (404)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockQuery.mockResolvedValue({ rows: [] }); // Empty because assessor_id doesn't match

      assessmentsController.getByAssignment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // SUBMIT ASSESSMENT TESTS
  // =========================================================================

  describe('submitAssessment', () => {
    const assessmentData = {
      scores: [
        { criterion_id: 'c1', score: 8 },
        { criterion_id: 'c2', score: 7 },
      ],
      overallComment: 'Good application overall',
      coiConfirmed: true,
    };

    it('should create/update assessment successfully (200)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = assessmentData;

      // Mock assignment verification
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockAssignmentId }] })
        .mockResolvedValueOnce({ rows: [mockAssessment] });

      assessmentsController.submitAssessment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM assignments'),
        [mockAssignmentId, mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAssessment,
      });
    });

    it('should calculate total score correctly', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = assessmentData;

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockAssignmentId }] })
        .mockResolvedValueOnce({ rows: [mockAssessment] });

      assessmentsController.submitAssessment(mockReq, mockRes, mockNext);
      await flushPromises();

      // Check that INSERT was called with calculated total score (8 + 7 = 15)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assessments'),
        expect.arrayContaining([15]) // total_score
      );
    });

    it('should throw 404 when assignment not found', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = assessmentData;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      assessmentsController.submitAssessment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Assignment not found',
        })
      );
    });

    it('should use upsert for existing assessment', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = assessmentData;

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockAssignmentId }] })
        .mockResolvedValueOnce({ rows: [mockAssessment] });

      assessmentsController.submitAssessment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // UPDATE DRAFT TESTS
  // =========================================================================

  describe('updateDraft', () => {
    const updateData = {
      scores: [
        { criterion_id: 'c1', score: 9 },
        { criterion_id: 'c2', score: 8 },
      ],
      overallComment: 'Updated comment',
      coiConfirmed: true,
    };

    it('should update draft assessment successfully (200)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = updateData;
      const updatedAssessment = { ...mockAssessment, total_score: 17 };
      mockQuery.mockResolvedValue({ rows: [updatedAssessment] });

      assessmentsController.updateDraft(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE assignment_id = $5 AND status = 'draft'"),
        expect.any(Array)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedAssessment,
      });
    });

    it('should throw 404 when assessment not found or not editable', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = updateData;
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.updateDraft(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Assessment not found or not editable',
        })
      );
    });

    it('should not allow updating submitted assessment (404)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = updateData;
      mockQuery.mockResolvedValue({ rows: [] }); // No rows because status != 'draft'

      assessmentsController.updateDraft(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // FINAL SUBMIT TESTS
  // =========================================================================

  describe('finalSubmit', () => {
    it('should submit assessment successfully (200)', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      const submittedAssessment = { ...mockAssessment, status: 'submitted', submitted_at: new Date() };

      mockQuery
        .mockResolvedValueOnce({ rows: [submittedAssessment] }) // Update assessment
        .mockResolvedValueOnce({ rows: [] }); // Update assignment status

      assessmentsController.finalSubmit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'submitted'"),
        expect.any(Array)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: submittedAssessment,
      });
    });

    it('should update assignment status to completed', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      const submittedAssessment = { ...mockAssessment, status: 'submitted' };

      mockQuery
        .mockResolvedValueOnce({ rows: [submittedAssessment] })
        .mockResolvedValueOnce({ rows: [] });

      assessmentsController.finalSubmit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE assignments SET status = $1 WHERE id = $2',
        ['completed', mockAssignmentId]
      );
    });

    it('should throw 400 when assessment not found or already submitted', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockQuery.mockResolvedValueOnce({ rows: [] });

      assessmentsController.finalSubmit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Assessment not found or already submitted',
        })
      );
    });
  });

  // =========================================================================
  // LIST ASSESSMENTS TESTS
  // =========================================================================

  describe('list', () => {
    it('should list all assessments with pagination (200)', async () => {
      mockReq.query = { page: '1', limit: '20' };
      const assessments = [mockAssessment];
      mockQuery.mockResolvedValue({ rows: assessments });

      assessmentsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.any(Array)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assessments,
      });
    });

    it('should filter by status', async () => {
      mockReq.query = { status: 'submitted', page: '1', limit: '20' };
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('asmt.status = $'),
        expect.arrayContaining(['submitted'])
      );
    });

    it('should use default pagination values', async () => {
      mockReq.query = {};
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        expect.arrayContaining([20, 0])
      );
    });
  });

  // =========================================================================
  // LIST BY CALL TESTS
  // =========================================================================

  describe('listByCall', () => {
    it('should list assessments for a specific call (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const assessments = [mockAssessment];
      mockQuery.mockResolvedValue({ rows: assessments });

      assessmentsController.listByCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.call_id = $1'),
        [mockCallId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assessments,
      });
    });
  });

  // =========================================================================
  // LIST BY APPLICATION TESTS
  // =========================================================================

  describe('listByApplication', () => {
    it('should list assessments for a specific application (200)', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      const assessments = [mockAssessment];
      mockQuery.mockResolvedValue({ rows: assessments });

      assessmentsController.listByApplication(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ass.application_id = $1'),
        [mockApplicationId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assessments,
      });
    });
  });

  // =========================================================================
  // RETURN FOR REVISION TESTS
  // =========================================================================

  describe('returnForRevision', () => {
    it('should return assessment for revision successfully (200)', async () => {
      mockReq.params = { id: mockAssessmentId };
      mockReq.body = { reason: 'Need more detail on scoring rationale' };
      const returnedAssessment = {
        ...mockAssessment,
        status: 'revision_required',
        revision_reason: mockReq.body.reason,
      };
      mockQuery.mockResolvedValue({ rows: [returnedAssessment] });

      assessmentsController.returnForRevision(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'revision_required'"),
        [mockReq.body.reason, mockAssessmentId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: returnedAssessment,
      });
    });

    it('should throw 404 when assessment not found or cannot be returned', async () => {
      mockReq.params = { id: mockAssessmentId };
      mockReq.body = { reason: 'Reason' };
      mockQuery.mockResolvedValue({ rows: [] });

      assessmentsController.returnForRevision(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Assessment not found or cannot be returned',
        })
      );
    });

    it('should not return draft assessment (404)', async () => {
      mockReq.params = { id: mockAssessmentId };
      mockReq.body = { reason: 'Reason' };
      mockQuery.mockResolvedValue({ rows: [] }); // No rows because status != 'submitted'

      assessmentsController.returnForRevision(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // ERROR HANDLING TESTS
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle database connection errors (500)', async () => {
      mockReq.query = {};
      const dbError = new Error('Connection refused');
      mockQuery.mockRejectedValue(dbError);

      assessmentsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('should handle invalid UUID format', async () => {
      mockReq.params = { assignmentId: 'invalid-uuid' };
      const dbError = new Error('invalid input syntax for type uuid');
      mockQuery.mockRejectedValue(dbError);

      assessmentsController.getByAssignment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // =========================================================================
  // AUTHORIZATION TESTS
  // =========================================================================

  describe('Authorization', () => {
    it('should restrict assessment submission to assigned assessor', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.body = { scores: [], overallComment: '', coiConfirmed: true };
      mockReq.user = { id: 'different-user-id', role: UserRole.ASSESSOR };

      // Return empty because user is not the assigned assessor
      mockQuery.mockResolvedValueOnce({ rows: [] });

      assessmentsController.submitAssessment(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Assignment not found',
        })
      );
    });

    it('should restrict final submission to assigned assessor', async () => {
      mockReq.params = { assignmentId: mockAssignmentId };
      mockReq.user = { id: 'different-user-id', role: UserRole.ASSESSOR };
      mockQuery.mockResolvedValueOnce({ rows: [] });

      assessmentsController.finalSubmit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
        })
      );
    });
  });
});
