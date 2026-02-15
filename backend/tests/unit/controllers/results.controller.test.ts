/**
 * Results Controller Unit Tests
 * Tests for results aggregation, analytics, and export functionality
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
  calculateBreakdown: jest.fn(),
};
jest.mock('../../../src/services/scoring.service', () => ({
  scoringService: mockScoringService,
}));

// Mock export service
const mockExportService = {
  toCSV: jest.fn(),
  toDetailedCSV: jest.fn(),
};
jest.mock('../../../src/services/export.service', () => ({
  exportService: mockExportService,
}));

import { resultsController } from '../../../src/controllers/results.controller';

describe('Results Controller', () => {
  let mockReq: any;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  const mockUserId = uuidv4();
  const mockCallId = uuidv4();
  const mockApplicationId = uuidv4();

  const mockMasterResult = {
    id: mockApplicationId,
    reference_number: 'REF-001',
    status: 'submitted',
    submitted_at: new Date(),
    assessor_count: 2,
    average_score: 85.5,
    score_stddev: 3.2,
    min_score: 82,
    max_score: 89,
    assessments: [
      { assessor_id: 'a1', total_score: 82, submitted_at: new Date() },
      { assessor_id: 'a2', total_score: 89, submitted_at: new Date() },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = { id: mockUserId, role: UserRole.COORDINATOR };
  });

  // =========================================================================
  // GET MASTER RESULTS TESTS
  // =========================================================================

  describe('getMasterResults', () => {
    it('should return master results for a call (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const results = [mockMasterResult];
      mockQuery.mockResolvedValue({ rows: results });

      resultsController.getMasterResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.call_id = $1'),
        [mockCallId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: results,
      });
    });

    it('should return empty array when no submitted applications', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getMasterResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should aggregate scores correctly', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [mockMasterResult] });

      resultsController.getMasterResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AVG(asmt.total_score)'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('STDDEV(asmt.total_score)'),
        expect.any(Array)
      );
    });

    it('should order by average score descending', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getMasterResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY average_score DESC'),
        expect.any(Array)
      );
    });

    it('should return demo data on database error', async () => {
      mockReq.params = { callId: mockCallId };
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      await resultsController.getMasterResults(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meta: expect.objectContaining({ demo: true }),
        })
      );
    });
  });

  // =========================================================================
  // GET SUMMARY TESTS
  // =========================================================================

  describe('getSummary', () => {
    it('should return call summary statistics (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const summary = {
        total_applications: 50,
        submitted: 45,
        total_assignments: 90,
        completed_assessments: 85,
        overall_average: 78.5,
        overall_stddev: 12.3,
      };
      mockQuery.mockResolvedValue({ rows: [summary] });

      resultsController.getSummary(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: summary,
      });
    });

    it('should return zeros for empty call', async () => {
      mockReq.params = { callId: mockCallId };
      const emptySummary = {
        total_applications: 0,
        submitted: 0,
        total_assignments: 0,
        completed_assessments: 0,
        overall_average: null,
        overall_stddev: null,
      };
      mockQuery.mockResolvedValue({ rows: [emptySummary] });

      resultsController.getSummary(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: emptySummary,
      });
    });
  });

  // =========================================================================
  // GET VARIANCE FLAGS TESTS
  // =========================================================================

  describe('getVarianceFlags', () => {
    it('should return applications with high score variance (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const flaggedApps = [
        {
          id: mockApplicationId,
          reference_number: 'REF-001',
          avg_score: 75,
          score_stddev: 15,
          assessment_count: 3,
          scores: [60, 75, 90],
          flagged: true,
        },
      ];
      mockQuery.mockResolvedValue({ rows: flaggedApps });

      resultsController.getVarianceFlags(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: flaggedApps,
      });
    });

    it('should use variance threshold of 2 standard deviations', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getVarianceFlags(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('score_stddev > $2'),
        expect.arrayContaining([mockCallId, 2])
      );
    });

    it('should only include applications with multiple assessments', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getVarianceFlags(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(asmt.id) > 1'),
        expect.any(Array)
      );
    });

    it('should order by standard deviation descending', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getVarianceFlags(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY score_stddev DESC'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // GET RANKING TESTS
  // =========================================================================

  describe('getRanking', () => {
    it('should return applications ranked by average score (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const rankings = [
        { id: 'a1', reference_number: 'REF-001', average_score: 92, assessment_count: 2, rank: 1 },
        { id: 'a2', reference_number: 'REF-002', average_score: 88, assessment_count: 2, rank: 2 },
        { id: 'a3', reference_number: 'REF-003', average_score: 85, assessment_count: 2, rank: 3 },
      ];
      mockQuery.mockResolvedValue({ rows: rankings });

      resultsController.getRanking(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: rankings,
      });
    });

    it('should use SQL RANK window function', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getRanking(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('RANK() OVER'),
        expect.any(Array)
      );
    });

    it('should only rank assessed applications', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getRanking(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(asmt.id) > 0'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // EXPORT RESULTS TESTS
  // =========================================================================

  describe('exportResults', () => {
    it('should export results as CSV (200)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = { format: 'csv' };
      const results = [
        { reference_number: 'REF-001', status: 'submitted', average_score: 85, rank: 1 },
      ];
      mockQuery.mockResolvedValue({ rows: results });
      const csvContent = 'reference_number,status,average_score,rank\nREF-001,submitted,85,1';
      mockExportService.toCSV.mockReturnValue(csvContent);

      resultsController.exportResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('results-')
      );
      expect(mockRes.send).toHaveBeenCalledWith(csvContent);
    });

    it('should return JSON when format is not csv', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = { format: 'json' };
      const results = [{ reference_number: 'REF-001', average_score: 85 }];
      mockQuery.mockResolvedValue({ rows: results });

      resultsController.exportResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: results,
      });
    });

    it('should use default csv format when not specified', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = {};
      mockQuery.mockResolvedValue({ rows: [] });
      mockExportService.toCSV.mockReturnValue('');

      resultsController.exportResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockExportService.toCSV).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPORT DETAILED RESULTS TESTS
  // =========================================================================

  describe('exportDetailedResults', () => {
    it('should export detailed results with all assessments (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const detailedResults = [
        {
          reference_number: 'REF-001',
          content: { title: 'Test' },
          assessor_id: 'a1',
          assessor_email: 'assessor1@example.com',
          scores: [{ criterion_id: 'c1', score: 8 }],
          overall_comment: 'Good',
          total_score: 85,
          submitted_at: new Date(),
        },
      ];
      mockQuery.mockResolvedValue({ rows: detailedResults });
      const csvContent = 'detailed,csv,content';
      mockExportService.toDetailedCSV.mockReturnValue(csvContent);

      resultsController.exportDetailedResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('detailed-results-')
      );
      expect(mockRes.send).toHaveBeenCalledWith(csvContent);
    });

    it('should order by reference number and assessor', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });
      mockExportService.toDetailedCSV.mockReturnValue('');

      resultsController.exportDetailedResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.reference_number, ass.assessor_id'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // GET APPLICATION RESULTS TESTS
  // =========================================================================

  describe('getApplicationResults', () => {
    it('should return aggregated results for single application (200)', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      const results = [
        {
          reference_number: 'REF-001',
          status: 'submitted',
          assessor_id: 'a1',
          assessor_email: 'assessor1@example.com',
          total_score: 85,
          submitted_at: new Date(),
        },
        {
          reference_number: 'REF-001',
          status: 'submitted',
          assessor_id: 'a2',
          assessor_email: 'assessor2@example.com',
          total_score: 88,
          submitted_at: new Date(),
        },
      ];
      mockQuery.mockResolvedValue({ rows: results });

      resultsController.getApplicationResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          application: 'REF-001',
          assessmentCount: 2,
          averageScore: 86.5,
          assessments: expect.any(Array),
        }),
      });
    });

    it('should throw 404 when application not found', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getApplicationResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found',
        })
      );
    });

    it('should handle application with no assessments', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      const results = [
        {
          reference_number: 'REF-001',
          status: 'submitted',
          assessor_id: null,
          total_score: null,
        },
      ];
      mockQuery.mockResolvedValue({ rows: results });

      resultsController.getApplicationResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          assessmentCount: 0,
          averageScore: null,
        }),
      });
    });
  });

  // =========================================================================
  // GET SCORE BREAKDOWN TESTS
  // =========================================================================

  describe('getScoreBreakdown', () => {
    it('should return score breakdown by criterion (200)', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      const callResult = { criteria_config: [{ id: 'c1', name: 'Innovation', max_points: 10 }] };
      const assessments = [
        { scores: [{ criterion_id: 'c1', score: 8 }] },
        { scores: [{ criterion_id: 'c1', score: 9 }] },
      ];
      const breakdown = [{ criterion_id: 'c1', average: 8.5, min: 8, max: 9 }];

      mockQuery
        .mockResolvedValueOnce({ rows: [callResult] })
        .mockResolvedValueOnce({ rows: assessments });
      mockScoringService.calculateBreakdown.mockReturnValue(breakdown);

      resultsController.getScoreBreakdown(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockScoringService.calculateBreakdown).toHaveBeenCalledWith(
        callResult.criteria_config,
        assessments
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: breakdown,
      });
    });

    it('should throw 404 when application not found', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      mockQuery.mockResolvedValueOnce({ rows: [] });

      resultsController.getScoreBreakdown(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found',
        })
      );
    });

    it('should handle empty criteria config', async () => {
      mockReq.params = { applicationId: mockApplicationId };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ criteria_config: null }] })
        .mockResolvedValueOnce({ rows: [] });
      mockScoringService.calculateBreakdown.mockReturnValue([]);

      resultsController.getScoreBreakdown(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockScoringService.calculateBreakdown).toHaveBeenCalledWith([], []);
    });
  });

  // =========================================================================
  // GET ANALYTICS TESTS
  // =========================================================================

  describe('getAnalytics', () => {
    it('should return comprehensive analytics (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const scoreStats = {
        mean: 78.5,
        median: 80,
        stddev: 12.3,
        min: 45,
        max: 98,
      };
      const assessorStats = [
        { assessor_id: 'a1', email: 'a1@test.com', completed: 10, avg_score: 75, avg_hours: 2.5 },
      ];
      const timeStats = [
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-16', count: 8 },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [scoreStats] })
        .mockResolvedValueOnce({ rows: assessorStats })
        .mockResolvedValueOnce({ rows: timeStats });

      resultsController.getAnalytics(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          scores: scoreStats,
          assessors: assessorStats,
          timeline: timeStats,
        },
      });
    });

    it('should execute three parallel queries', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getAnalytics(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should calculate percentile for median', async () => {
      mockReq.params = { callId: mockCallId };
      mockQuery.mockResolvedValue({ rows: [{}] });

      resultsController.getAnalytics(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('PERCENTILE_CONT(0.5)'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // GET SCORE DISTRIBUTION TESTS
  // =========================================================================

  describe('getScoreDistribution', () => {
    it('should return score distribution with default 10 buckets (200)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = {};
      const distribution = [
        { bucket: 1, count: 5, range_start: 0, range_end: 10 },
        { bucket: 2, count: 8, range_start: 10, range_end: 20 },
      ];
      mockQuery.mockResolvedValue({ rows: distribution });

      resultsController.getScoreDistribution(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockCallId, 10])
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: distribution,
      });
    });

    it('should allow custom number of buckets', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = { buckets: '5' };
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getScoreDistribution(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockCallId, 5])
      );
    });

    it('should use WIDTH_BUCKET for distribution', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = {};
      mockQuery.mockResolvedValue({ rows: [] });

      resultsController.getScoreDistribution(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WIDTH_BUCKET'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // ERROR HANDLING TESTS
  // =========================================================================

  describe('Error Handling', () => {
    it('should return demo data on database connection errors', async () => {
      mockReq.params = { callId: mockCallId };
      const dbError = new Error('Connection refused');
      mockQuery.mockRejectedValue(dbError);

      await resultsController.getMasterResults(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meta: expect.objectContaining({ demo: true }),
        })
      );
    });

    it('should return demo data on invalid UUID format', async () => {
      mockReq.params = { callId: 'invalid-uuid' };
      const dbError = new Error('invalid input syntax for type uuid');
      mockQuery.mockRejectedValue(dbError);

      await resultsController.getMasterResults(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          meta: expect.objectContaining({ demo: true }),
        })
      );
    });

    it('should handle export service errors', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.query = { format: 'csv' };
      mockQuery.mockResolvedValue({ rows: [{}] });
      const exportError = new Error('Export failed');
      mockExportService.toCSV.mockImplementation(() => {
        throw exportError;
      });

      resultsController.exportResults(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(exportError);
    });
  });
});
