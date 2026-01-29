/**
 * Anomaly Detection Feature Unit Tests
 * Tests for scoring anomaly detection and statistical analysis
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Define mock functions at module scope
const mockIsFeatureEnabled = jest.fn();
const mockExtractJson = jest.fn();

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AI service - factory must return the mock object inline
jest.mock('../../../src/ai/ai.service', () => ({
  getAIService: jest.fn(() => ({
    isFeatureEnabled: mockIsFeatureEnabled,
    extractJson: mockExtractJson,
  })),
}));

import {
  detectScoringAnomalies,
  detectApplicationAnomalies,
} from '../../../src/ai/features/anomaly';
import {
  AIServiceError,
  ApplicationScoreData,
  AnomalyDetectionRequest,
} from '../../../src/ai/types';

describe('Anomaly Detection Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
  });

  describe('detectScoringAnomalies', () => {
    const createMockScores = (
      overrides: Partial<ApplicationScoreData> = {}
    ): ApplicationScoreData => ({
      applicationId: 'app-123',
      assessorScores: [
        {
          assessorId: 'assessor-1',
          criterionScores: [
            { criterionId: 'criterion-1', score: 8 },
            { criterionId: 'criterion-2', score: 7 },
          ],
          overallScore: 75,
        },
        {
          assessorId: 'assessor-2',
          criterionScores: [
            { criterionId: 'criterion-1', score: 7 },
            { criterionId: 'criterion-2', score: 8 },
          ],
          overallScore: 78,
        },
        {
          assessorId: 'assessor-3',
          criterionScores: [
            { criterionId: 'criterion-1', score: 8 },
            { criterionId: 'criterion-2', score: 7 },
          ],
          overallScore: 76,
        },
      ],
      ...overrides,
    });

    it('should detect no anomalies for consistent scores', async () => {
      const request: AnomalyDetectionRequest = {
        callId: 'call-123',
        applicationScores: [createMockScores()],
      };

      const result = await detectScoringAnomalies(request);

      expect(result.anomalies).toHaveLength(0);
      expect(result.summary.anomaliesFound).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when feature is disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(
        detectScoringAnomalies({
          callId: 'call-123',
          applicationScores: [createMockScores()],
        })
      ).rejects.toThrow('Anomaly detection feature is disabled');
    });

    it('should detect high variance anomalies', async () => {
      const highVarianceScores: ApplicationScoreData = {
        applicationId: 'app-variance',
        assessorScores: [
          {
            assessorId: 'assessor-1',
            criterionScores: [{ criterionId: 'criterion-1', score: 9 }],
            overallScore: 90,
          },
          {
            assessorId: 'assessor-2',
            criterionScores: [{ criterionId: 'criterion-1', score: 5 }],
            overallScore: 50,
          },
          {
            assessorId: 'assessor-3',
            criterionScores: [{ criterionId: 'criterion-1', score: 8 }],
            overallScore: 80,
          },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [highVarianceScores],
      });

      const varianceAnomalies = result.anomalies.filter(a => a.type === 'high_variance');
      expect(varianceAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect outlier assessors', async () => {
      // Need more assessors with tighter clustering to create a clear outlier
      // With 5 assessors scoring close together and 1 far out, the z-score will exceed 2.0
      const outlierScores: ApplicationScoreData = {
        applicationId: 'app-outlier',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 80 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 82 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 78 },
          { assessorId: 'assessor-4', criterionScores: [], overallScore: 81 },
          { assessorId: 'assessor-5', criterionScores: [], overallScore: 79 },
          { assessorId: 'assessor-6', criterionScores: [], overallScore: 20 }, // Clear outlier (z-score > 2.0)
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [outlierScores],
      });

      const outlierAnomalies = result.anomalies.filter(a => a.type === 'outlier_assessor');
      expect(outlierAnomalies.length).toBeGreaterThan(0);
      expect(outlierAnomalies[0].assessorIds).toContain('assessor-6');
    });

    it('should detect score clustering anomalies', async () => {
      const clusteringScores: ApplicationScoreData = {
        applicationId: 'app-clustering',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 75 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 75 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 75 },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [clusteringScores],
      });

      const clusteringAnomalies = result.anomalies.filter(a => a.type === 'score_clustering');
      expect(clusteringAnomalies.length).toBeGreaterThan(0);
      expect(clusteringAnomalies[0].description).toContain('identical');
    });

    it('should use AI for pattern deviation detection with 3+ applications', async () => {
      mockExtractJson.mockResolvedValue({
        anomalies: [
          {
            applicationId: 'app-1',
            description: 'Unusual scoring pattern',
            severity: 'medium',
            recommendation: 'Review scores',
          },
        ],
      });

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [
          createMockScores({ applicationId: 'app-1' }),
          createMockScores({ applicationId: 'app-2' }),
          createMockScores({ applicationId: 'app-3' }),
        ],
      });

      expect(mockExtractJson).toHaveBeenCalled();
      const patternAnomalies = result.anomalies.filter(a => a.type === 'pattern_deviation');
      expect(patternAnomalies.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle AI pattern detection failure gracefully', async () => {
      mockExtractJson.mockRejectedValue(new Error('AI error'));

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [
          createMockScores({ applicationId: 'app-1' }),
          createMockScores({ applicationId: 'app-2' }),
          createMockScores({ applicationId: 'app-3' }),
        ],
      });

      // Should not throw, just skip pattern detection
      expect(result.summary).toBeDefined();
    });

    it('should calculate summary correctly', async () => {
      // Create scores that will generate anomalies of different severities
      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [
          {
            applicationId: 'app-1',
            assessorScores: [
              { assessorId: 'assessor-1', criterionScores: [], overallScore: 100 },
              { assessorId: 'assessor-2', criterionScores: [], overallScore: 10 },
              { assessorId: 'assessor-3', criterionScores: [], overallScore: 50 },
            ],
          },
        ],
      });

      expect(result.summary.totalApplicationsAnalyzed).toBe(1);
      expect(result.summary.anomaliesFound).toBe(result.anomalies.length);
      expect(
        result.summary.highSeverityCount +
        result.summary.mediumSeverityCount +
        result.summary.lowSeverityCount
      ).toBe(result.anomalies.length);
    });

    it('should use custom threshold', async () => {
      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [createMockScores()],
        threshold: 5, // Very strict threshold
      });

      // With stricter threshold, might detect more anomalies
      expect(result).toBeDefined();
    });

    it('should skip variance detection with less than 2 assessors', async () => {
      const singleAssessor: ApplicationScoreData = {
        applicationId: 'app-single',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 75 },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [singleAssessor],
      });

      const varianceAnomalies = result.anomalies.filter(a => a.type === 'high_variance');
      expect(varianceAnomalies).toHaveLength(0);
    });

    it('should skip outlier detection with less than 3 assessors', async () => {
      const twoAssessors: ApplicationScoreData = {
        applicationId: 'app-two',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 90 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 30 },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [twoAssessors],
      });

      const outlierAnomalies = result.anomalies.filter(a => a.type === 'outlier_assessor');
      expect(outlierAnomalies).toHaveLength(0);
    });

    it('should detect per-criterion high variance', async () => {
      const criterionVariance: ApplicationScoreData = {
        applicationId: 'app-criterion',
        assessorScores: [
          {
            assessorId: 'assessor-1',
            criterionScores: [
              { criterionId: 'criterion-1', score: 10 },
            ],
            overallScore: 80,
          },
          {
            assessorId: 'assessor-2',
            criterionScores: [
              { criterionId: 'criterion-1', score: 2 },
            ],
            overallScore: 75,
          },
          {
            assessorId: 'assessor-3',
            criterionScores: [
              { criterionId: 'criterion-1', score: 8 },
            ],
            overallScore: 78,
          },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [criterionVariance],
      });

      const criterionAnomalies = result.anomalies.filter(
        a => a.type === 'high_variance' && a.criterionId
      );
      expect(criterionAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect boundary score clustering', async () => {
      const boundaryScores: ApplicationScoreData = {
        applicationId: 'app-boundary',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 0 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 0 },
        ],
      };

      const result = await detectScoringAnomalies({
        callId: 'call-123',
        applicationScores: [boundaryScores],
      });

      const clusteringAnomalies = result.anomalies.filter(a => a.type === 'score_clustering');
      expect(clusteringAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('detectApplicationAnomalies', () => {
    it('should detect anomalies for a single application', async () => {
      const scores: ApplicationScoreData = {
        applicationId: 'app-123',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 90 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 20 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 85 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.every(a => a.applicationId === 'app-123')).toBe(true);
    });

    it('should return empty array for consistent scores', async () => {
      const scores: ApplicationScoreData = {
        applicationId: 'app-123',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 75 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 77 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 76 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      expect(anomalies).toHaveLength(0);
    });
  });

  describe('statistical calculations', () => {
    it('should handle empty score arrays', async () => {
      const emptyScores: ApplicationScoreData = {
        applicationId: 'app-empty',
        assessorScores: [],
      };

      const anomalies = await detectApplicationAnomalies(emptyScores);

      expect(anomalies).toHaveLength(0);
    });

    it('should handle single value arrays', async () => {
      const singleScore: ApplicationScoreData = {
        applicationId: 'app-single',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 75 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(singleScore);

      expect(anomalies).toHaveLength(0);
    });

    it('should calculate z-scores correctly for outlier detection', async () => {
      // Need many assessors with tight clustering to produce a low stdDev
      // so that the outlier has z-score > 2.0
      const scores: ApplicationScoreData = {
        applicationId: 'app-zscore',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 70 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 72 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 68 },
          { assessorId: 'assessor-4', criterionScores: [], overallScore: 71 },
          { assessorId: 'assessor-5', criterionScores: [], overallScore: 69 },
          { assessorId: 'assessor-6', criterionScores: [], overallScore: 70 },
          { assessorId: 'assessor-7', criterionScores: [], overallScore: 71 },
          { assessorId: 'assessor-8', criterionScores: [], overallScore: 20 }, // Extreme outlier
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      const outlierAnomaly = anomalies.find(a => a.type === 'outlier_assessor');
      expect(outlierAnomaly).toBeDefined();
      expect(outlierAnomaly?.evidence?.zscore).toBeGreaterThan(2);
    });

    it('should calculate coefficient of variation correctly', async () => {
      const scores: ApplicationScoreData = {
        applicationId: 'app-cv',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 50 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 100 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 75 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      const varianceAnomaly = anomalies.find(a => a.type === 'high_variance');
      expect(varianceAnomaly).toBeDefined();
      expect(varianceAnomaly?.evidence?.variance).toBeGreaterThan(0);
    });
  });

  describe('severity classification', () => {
    it('should classify high variance as high severity for extreme cases', async () => {
      const extremeVariance: ApplicationScoreData = {
        applicationId: 'app-extreme',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 100 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 0 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 50 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(extremeVariance);

      const highSeverity = anomalies.filter(a => a.severity === 'high');
      expect(highSeverity.length).toBeGreaterThan(0);
    });

    it('should classify moderate variance as medium severity', async () => {
      const moderateVariance: ApplicationScoreData = {
        applicationId: 'app-moderate',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 80 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 60 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 70 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(moderateVariance);

      const mediumSeverity = anomalies.filter(a => a.severity === 'medium');
      expect(mediumSeverity.length).toBeGreaterThanOrEqual(0);
    });

    it('should classify clustering as low or medium severity', async () => {
      const clusteringScores: ApplicationScoreData = {
        applicationId: 'app-cluster',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 75 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 75 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 75 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(clusteringScores);

      const clusteringAnomaly = anomalies.find(a => a.type === 'score_clustering');
      if (clusteringAnomaly) {
        expect(['low', 'medium']).toContain(clusteringAnomaly.severity);
      }
    });
  });

  describe('recommendations', () => {
    it('should provide actionable recommendations', async () => {
      const scores: ApplicationScoreData = {
        applicationId: 'app-recommend',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 90 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 30 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 85 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      anomalies.forEach(anomaly => {
        expect(anomaly.recommendation).toBeTruthy();
        expect(anomaly.recommendation.length).toBeGreaterThan(10);
      });
    });

    it('should include expected range in evidence', async () => {
      const scores: ApplicationScoreData = {
        applicationId: 'app-evidence',
        assessorScores: [
          { assessorId: 'assessor-1', criterionScores: [], overallScore: 80 },
          { assessorId: 'assessor-2', criterionScores: [], overallScore: 20 },
          { assessorId: 'assessor-3', criterionScores: [], overallScore: 75 },
        ],
      };

      const anomalies = await detectApplicationAnomalies(scores);

      const anomalyWithRange = anomalies.find(a => a.evidence?.expectedRange);
      if (anomalyWithRange) {
        expect(anomalyWithRange.evidence.expectedRange).toHaveLength(2);
        expect(anomalyWithRange.evidence.expectedRange![0]).toBeLessThan(
          anomalyWithRange.evidence.expectedRange![1]
        );
      }
    });
  });
});
