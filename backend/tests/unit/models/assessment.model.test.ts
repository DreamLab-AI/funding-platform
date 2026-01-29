/**
 * Assessment Model Unit Tests
 *
 * Tests scoring, submission, variance calculation, and assessment lifecycle
 */

import { AssessmentModel, AssignmentModel } from '../../../src/models/assessment.model';
import {
  Assessment,
  AssessmentCreateInput,
  AssessmentUpdateInput,
  AssessmentStatus,
  Assignment,
  AssignmentCreateInput,
  AssignmentStatus,
  CriterionScore,
} from '../../../src/types';
import * as database from '../../../src/config/database';

// Mock the database module
jest.mock('../../../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock UUID and helpers
jest.mock('../../../src/utils/helpers', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-12345'),
  calculateAverage: jest.fn((nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length || 0),
}));

// Also mock uuid directly
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('AssignmentModel', () => {
  const mockQuery = database.query as jest.Mock;
  const mockTransaction = database.transaction as jest.Mock;

  const mockAssignment: Assignment = {
    assignment_id: 'assign-123',
    application_id: 'app-123',
    assessor_id: 'user-123',
    assigned_at: new Date(),
    assigned_by: 'coord-123',
    due_at: new Date(),
    status: AssignmentStatus.PENDING,
    started_at: undefined,
    completed_at: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: AssignmentCreateInput = {
      application_id: 'app-123',
      assessor_id: 'user-456',
      due_at: new Date('2025-06-30'),
    };

    it('should create a new assignment', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAssignment] });

      const result = await AssignmentModel.create(createInput, 'coord-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assignments'),
        expect.arrayContaining([
          'app-123',
          'user-456',
          'coord-123',
        ])
      );
      expect(result.status).toBe(AssignmentStatus.PENDING);
    });

    it('should handle missing due_at', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAssignment] });

      await AssignmentModel.create({ application_id: 'app-1', assessor_id: 'user-1' }, 'coord-1');

      const queryArgs = mockQuery.mock.calls[0][1];
      expect(queryArgs).toContain(null); // due_at should be null
    });
  });

  describe('createBulk', () => {
    it('should create assignments using round-robin strategy', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [mockAssignment] }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await AssignmentModel.createBulk(
        ['app-1', 'app-2', 'app-3'],
        ['user-1', 'user-2'],
        'coord-123',
        new Date()
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for empty inputs', async () => {
      const result = await AssignmentModel.createBulk([], ['user-1'], 'coord-123');
      expect(result).toEqual([]);

      const result2 = await AssignmentModel.createBulk(['app-1'], [], 'coord-123');
      expect(result2).toEqual([]);
    });

    it('should handle ON CONFLICT gracefully', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockAssignment] })
          .mockResolvedValueOnce({ rows: [] }), // conflict, no return
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await AssignmentModel.createBulk(['app-1', 'app-2'], ['user-1'], 'coord-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return assignment when found', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAssignment] });

      const result = await AssignmentModel.findById('assign-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM assignments WHERE assignment_id = $1',
        ['assign-123']
      );
      expect(result).toEqual(mockAssignment);
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await AssignmentModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findWithDetails', () => {
    it('should return assignment with related details', async () => {
      const detailedAssignment = {
        ...mockAssignment,
        application_reference: '2025-TEST-000001',
        applicant_name: 'John Doe',
        assessor_name: 'Jane Smith',
        assessor_email: 'jane@example.com',
        call_name: 'Test Call',
      };
      mockQuery.mockResolvedValue({ rows: [detailedAssignment] });

      const result = await AssignmentModel.findWithDetails('assign-123');

      expect(mockQuery.mock.calls[0][0]).toContain('JOIN applications');
      expect(mockQuery.mock.calls[0][0]).toContain('JOIN users');
      expect(mockQuery.mock.calls[0][0]).toContain('JOIN funding_calls');
      expect(result?.applicant_name).toBe('John Doe');
    });
  });

  describe('listByAssessor', () => {
    it('should list assignments for an assessor with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }] })
        .mockResolvedValueOnce({ rows: [mockAssignment] });

      const result = await AssignmentModel.listByAssessor('user-123', { page: 1, limit: 10 });

      expect(result.total).toBe(15);
      expect(result.assignments).toHaveLength(1);
    });

    it('should filter by call_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AssignmentModel.listByAssessor('user-123', { call_id: 'call-123' });

      expect(mockQuery.mock.calls[0][0]).toContain('a.call_id = $2');
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AssignmentModel.listByAssessor('user-123', { status: AssignmentStatus.PENDING });

      expect(mockQuery.mock.calls[0][0]).toContain('asn.status = $2');
    });
  });

  describe('listByApplication', () => {
    it('should list assignments for an application', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAssignment] });

      const result = await AssignmentModel.listByApplication('app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('asn.application_id = $1'),
        ['app-123']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update status to IN_PROGRESS with started_at', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AssignmentModel.updateStatus('assign-123', AssignmentStatus.IN_PROGRESS);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('started_at = COALESCE(started_at, NOW())'),
        [AssignmentStatus.IN_PROGRESS, 'assign-123']
      );
    });

    it('should update status to COMPLETED with completed_at', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AssignmentModel.updateStatus('assign-123', AssignmentStatus.COMPLETED);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('completed_at = NOW()'),
        [AssignmentStatus.COMPLETED, 'assign-123']
      );
    });

    it('should update status without extra fields for other statuses', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AssignmentModel.updateStatus('assign-123', AssignmentStatus.RETURNED);

      expect(mockQuery.mock.calls[0][0]).not.toContain('started_at');
      expect(mockQuery.mock.calls[0][0]).not.toContain('completed_at');
    });
  });

  describe('delete', () => {
    it('should delete assignment', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AssignmentModel.delete('assign-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM assignments WHERE assignment_id = $1',
        ['assign-123']
      );
    });
  });

  describe('exists', () => {
    it('should return true when assignment exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await AssignmentModel.exists('app-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when assignment does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await AssignmentModel.exists('app-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  describe('belongsToAssessor', () => {
    it('should return true when assignment belongs to assessor', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await AssignmentModel.belongsToAssessor('assign-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when assignment does not belong to assessor', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await AssignmentModel.belongsToAssessor('assign-123', 'user-456');

      expect(result).toBe(false);
    });
  });
});

describe('AssessmentModel', () => {
  const mockQuery = database.query as jest.Mock;

  const mockScores: CriterionScore[] = [
    { criterion_id: 'crit-1', score: 8, comment: 'Good innovation' },
    { criterion_id: 'crit-2', score: 7, comment: 'Decent impact' },
  ];

  const mockAssessment: Assessment = {
    assessment_id: 'assess-123',
    assignment_id: 'assign-123',
    scores: mockScores,
    overall_score: 7.5,
    overall_comment: 'Generally good proposal',
    coi_confirmed: true,
    coi_details: undefined,
    status: AssessmentStatus.DRAFT,
    submitted_at: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrGet', () => {
    const createInput: AssessmentCreateInput = {
      assignment_id: 'assign-123',
      scores: mockScores,
      overall_comment: 'Initial comment',
      coi_confirmed: false,
    };

    it('should return existing assessment if one exists', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      const result = await AssessmentModel.createOrGet(createInput);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result.assessment_id).toBe('assess-123');
    });

    it('should create new assessment when none exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // findByAssignment returns null
        .mockResolvedValueOnce({ rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }] }) // create
        .mockResolvedValueOnce({ rows: [] }); // updateStatus

      const result = await AssessmentModel.createOrGet(createInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assessments'),
        expect.any(Array)
      );
      expect(result).toBeDefined();
    });

    it('should update assignment status to IN_PROGRESS when creating', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...mockAssessment, scores: '[]' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AssessmentModel.createOrGet({ assignment_id: 'assign-123' });

      // Check that updateStatus was called
      expect(mockQuery.mock.calls[2][0]).toContain('UPDATE assignments SET status');
    });
  });

  describe('findById', () => {
    it('should return assessment with parsed scores', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      const result = await AssessmentModel.findById('assess-123');

      expect(result).not.toBeNull();
      expect(Array.isArray(result?.scores)).toBe(true);
      expect(result?.scores[0].score).toBe(8);
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await AssessmentModel.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle already-parsed scores', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAssessment] });

      const result = await AssessmentModel.findById('assess-123');

      expect(result?.scores).toEqual(mockScores);
    });
  });

  describe('findByAssignment', () => {
    it('should find assessment by assignment ID', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      const result = await AssessmentModel.findByAssignment('assign-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM assessments WHERE assignment_id = $1',
        ['assign-123']
      );
      expect(result).not.toBeNull();
    });
  });

  describe('update', () => {
    it('should update scores and recalculate overall score', async () => {
      const updateInput: AssessmentUpdateInput = {
        scores: [
          { criterion_id: 'crit-1', score: 9 },
          { criterion_id: 'crit-2', score: 8 },
        ],
      };

      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(updateInput.scores), overall_score: 8.5 }],
      });

      const result = await AssessmentModel.update('assess-123', updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assessments SET'),
        expect.arrayContaining([expect.any(String)]) // stringified scores
      );
      expect(mockQuery.mock.calls[0][0]).toContain('overall_score');
    });

    it('should update comment fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      await AssessmentModel.update('assess-123', { overall_comment: 'Updated comment' });

      expect(mockQuery.mock.calls[0][0]).toContain('overall_comment');
    });

    it('should update COI fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      await AssessmentModel.update('assess-123', {
        coi_confirmed: true,
        coi_details: 'No conflict',
      });

      expect(mockQuery.mock.calls[0][0]).toContain('coi_confirmed');
      expect(mockQuery.mock.calls[0][0]).toContain('coi_details');
    });

    it('should return existing assessment when no fields to update', async () => {
      const findByIdSpy = jest.spyOn(AssessmentModel, 'findById').mockResolvedValue(mockAssessment);

      const result = await AssessmentModel.update('assess-123', {});

      expect(result).toEqual(mockAssessment);
      findByIdSpy.mockRestore();
    });

    it('should return null when assessment not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await AssessmentModel.update('nonexistent', { overall_comment: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('submit', () => {
    it('should update status to submitted and set submitted_at', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...mockAssessment, status: AssessmentStatus.SUBMITTED, scores: JSON.stringify(mockScores) }] })
        .mockResolvedValueOnce({ rows: [] }); // updateStatus

      const result = await AssessmentModel.submit('assess-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $1, submitted_at = NOW()'),
        [AssessmentStatus.SUBMITTED, 'assess-123']
      );
      expect(result?.status).toBe(AssessmentStatus.SUBMITTED);
    });

    it('should update assignment status to COMPLETED', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ ...mockAssessment, status: AssessmentStatus.SUBMITTED, scores: JSON.stringify(mockScores) }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await AssessmentModel.submit('assess-123');

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE assignments SET status'),
        expect.any(Array)
      );
    });
  });

  describe('returnForRevision', () => {
    it('should update assessment and assignment status to returned', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // update assessment
        .mockResolvedValueOnce({ rows: [] }); // update assignment

      await AssessmentModel.returnForRevision('assess-123');

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE assessments SET status = $1'),
        [AssessmentStatus.RETURNED, 'assess-123']
      );
    });

    it('should do nothing when assessment not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await AssessmentModel.returnForRevision('nonexistent');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('listByApplication', () => {
    it('should list submitted assessments for an application', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(mockScores) }],
      });

      const result = await AssessmentModel.listByApplication('app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ass.status = $2'),
        ['app-123', AssessmentStatus.SUBMITTED]
      );
      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].scores)).toBe(true);
    });
  });

  describe('getWithAssessorInfo', () => {
    it('should return assessments with assessor details', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          ...mockAssessment,
          scores: JSON.stringify(mockScores),
          assessor_name: 'Jane Smith',
          assessor_id: 'user-456',
        }],
      });

      const result = await AssessmentModel.getWithAssessorInfo('app-123');

      expect(mockQuery.mock.calls[0][0]).toContain('CONCAT(u.first_name');
      expect(result[0].assessor_name).toBe('Jane Smith');
      expect(result[0].assessor_id).toBe('user-456');
    });
  });

  describe('delete', () => {
    it('should delete assessment', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AssessmentModel.delete('assess-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM assessments WHERE assessment_id = $1',
        ['assess-123']
      );
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      await expect(AssessmentModel.findById('assess-123')).rejects.toThrow('Database error');
    });
  });

  describe('score calculation', () => {
    it('should handle empty scores array', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: '[]', overall_score: 0 }],
      });

      const result = await AssessmentModel.findById('assess-123');

      expect(result?.scores).toEqual([]);
    });

    it('should handle scores with comments', async () => {
      const scoresWithComments: CriterionScore[] = [
        { criterion_id: 'crit-1', score: 10, comment: 'Excellent work' },
        { criterion_id: 'crit-2', score: 5 }, // no comment
      ];

      mockQuery.mockResolvedValue({
        rows: [{ ...mockAssessment, scores: JSON.stringify(scoresWithComments) }],
      });

      const result = await AssessmentModel.findById('assess-123');

      expect(result?.scores[0].comment).toBe('Excellent work');
      expect(result?.scores[1].comment).toBeUndefined();
    });
  });
});
