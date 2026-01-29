/**
 * Scoring Assistance Feature Unit Tests
 * Tests for AI-assisted scoring suggestions and score analysis
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
  generateScoringSuggestions,
  suggestCriterionScore,
  analyzeScoreConsistency,
  suggestFeedback,
} from '../../../src/ai/features/scoring-assist';
import {
  AIServiceError,
  AIErrorCode,
  CriterionDefinition,
  ScoreAssistRequest,
} from '../../../src/ai/types';

describe('Scoring Assistance Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
  });

  const mockCriteria: CriterionDefinition[] = [
    {
      criterionId: 'criterion-1',
      name: 'Innovation',
      description: 'Level of innovation in the proposal',
      maxPoints: 10,
      weight: 1.5,
    },
    {
      criterionId: 'criterion-2',
      name: 'Feasibility',
      description: 'Practical feasibility of the project',
      maxPoints: 10,
      weight: 1.0,
    },
    {
      criterionId: 'criterion-3',
      name: 'Impact',
      description: 'Potential impact of the research',
      maxPoints: 20,
      weight: 2.0,
    },
  ];

  describe('generateScoringSuggestions', () => {
    const mockRequest: ScoreAssistRequest = {
      applicationId: 'app-123',
      applicationContent: 'This is an innovative research proposal about quantum computing.',
      criteria: mockCriteria,
    };

    it('should generate scoring suggestions for all criteria', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [
          {
            criterionId: 'criterion-1',
            suggestedScore: 8,
            reasoning: 'High innovation level',
            confidence: 0.85,
            relevantExcerpts: ['quantum computing'],
          },
          {
            criterionId: 'criterion-2',
            suggestedScore: 7,
            reasoning: 'Good feasibility',
            confidence: 0.8,
            relevantExcerpts: ['practical approach'],
          },
          {
            criterionId: 'criterion-3',
            suggestedScore: 15,
            reasoning: 'Significant potential impact',
            confidence: 0.9,
            relevantExcerpts: ['breakthrough'],
          },
        ],
        overallAssessment: 'Strong proposal with high innovation.',
        strengthsIdentified: ['Innovation', 'Technical approach'],
        weaknessesIdentified: ['Budget justification'],
      });

      const result = await generateScoringSuggestions(mockRequest);

      expect(result.suggestions).toHaveLength(3);
      expect(result.overallAssessment).toContain('Strong proposal');
      expect(result.strengthsIdentified).toContain('Innovation');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw when feature is disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(generateScoringSuggestions(mockRequest)).rejects.toThrow(
        'Scoring assistance feature is disabled'
      );
    });

    it('should include existing scores in prompt', async () => {
      const requestWithScores = {
        ...mockRequest,
        existingScores: [
          { criterionId: 'criterion-1', score: 7 },
        ],
      };

      mockExtractJson.mockResolvedValue({
        suggestions: [],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      await generateScoringSuggestions(requestWithScores);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('Existing scores'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should normalize scores to valid ranges', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [
          {
            criterionId: 'criterion-1',
            suggestedScore: 15, // Exceeds maxPoints of 10
            reasoning: 'High score',
            confidence: 1.5, // Exceeds 1
            relevantExcerpts: [],
          },
          {
            criterionId: 'criterion-2',
            suggestedScore: -5, // Below 0
            reasoning: 'Low score',
            confidence: -0.5, // Below 0
            relevantExcerpts: [],
          },
        ],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      const result = await generateScoringSuggestions(mockRequest);

      expect(result.suggestions[0].suggestedScore).toBe(10); // Clamped to max
      expect(result.suggestions[0].confidence).toBe(1); // Clamped to 1
      expect(result.suggestions[1].suggestedScore).toBe(0); // Clamped to 0
      expect(result.suggestions[1].confidence).toBe(0); // Clamped to 0
    });

    it('should handle empty suggestions gracefully', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [],
        overallAssessment: 'Unable to assess',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      const result = await generateScoringSuggestions(mockRequest);

      expect(result.suggestions).toHaveLength(0);
      expect(result.overallAssessment).toBe('Unable to assess');
    });

    it('should wrap provider errors in AIServiceError', async () => {
      mockExtractJson.mockRejectedValue(new Error('Provider error'));

      await expect(generateScoringSuggestions(mockRequest)).rejects.toThrow(AIServiceError);
    });

    it('should re-throw AIServiceError as-is', async () => {
      const originalError = new AIServiceError('Rate limit', AIErrorCode.RATE_LIMIT_EXCEEDED);
      mockExtractJson.mockRejectedValue(originalError);

      await expect(generateScoringSuggestions(mockRequest)).rejects.toBe(originalError);
    });

    it('should include criterion weights in prompt', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      await generateScoringSuggestions(mockRequest);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('weight: 1.5'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should include all criteria in prompt', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      await generateScoringSuggestions(mockRequest);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('Innovation'),
        expect.any(String),
        expect.any(Object)
      );
      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('Feasibility'),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('suggestCriterionScore', () => {
    const criterion: CriterionDefinition = {
      criterionId: 'criterion-1',
      name: 'Innovation',
      description: 'Level of innovation',
      maxPoints: 10,
    };

    it('should suggest score for a single criterion', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedScore: 8,
        reasoning: 'High innovation demonstrated',
        confidence: 0.85,
        relevantExcerpts: ['novel approach', 'breakthrough'],
      });

      const result = await suggestCriterionScore('Application content', criterion);

      expect(result.criterionId).toBe('criterion-1');
      expect(result.suggestedScore).toBe(8);
      expect(result.reasoning).toContain('innovation');
    });

    it('should throw when feature disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(
        suggestCriterionScore('Content', criterion)
      ).rejects.toThrow('Scoring assistance feature is disabled');
    });

    it('should normalize score to valid range', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedScore: 15,
        reasoning: 'Exceptional',
        confidence: 1.5,
        relevantExcerpts: [],
      });

      const result = await suggestCriterionScore('Content', criterion);

      expect(result.suggestedScore).toBe(10); // Clamped to maxPoints
      expect(result.confidence).toBe(1); // Clamped to 1
    });

    it('should handle negative scores', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedScore: -5,
        reasoning: 'Poor',
        confidence: -0.1,
        relevantExcerpts: [],
      });

      const result = await suggestCriterionScore('Content', criterion);

      expect(result.suggestedScore).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle missing relevantExcerpts', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedScore: 7,
        reasoning: 'Good',
        confidence: 0.8,
      });

      const result = await suggestCriterionScore('Content', criterion);

      expect(result.relevantExcerpts).toEqual([]);
    });

    it('should wrap errors in AIServiceError', async () => {
      mockExtractJson.mockRejectedValue(new Error('API error'));

      await expect(suggestCriterionScore('Content', criterion)).rejects.toThrow(AIServiceError);
    });
  });

  describe('analyzeScoreConsistency', () => {
    const criterion: CriterionDefinition = {
      criterionId: 'criterion-1',
      name: 'Innovation',
      description: 'Level of innovation',
      maxPoints: 10,
    };

    const assessorScores = [
      { assessorId: 'assessor-1', criterionId: 'criterion-1', score: 8, comment: 'Excellent' },
      { assessorId: 'assessor-2', criterionId: 'criterion-1', score: 5, comment: 'Average' },
      { assessorId: 'assessor-3', criterionId: 'criterion-1', score: 9, comment: 'Outstanding' },
    ];

    it('should analyze score consistency', async () => {
      mockExtractJson.mockResolvedValue({
        analysis: 'Assessor 2 scored significantly lower than others.',
        suggestedResolution: 7,
        confidence: 0.75,
      });

      const result = await analyzeScoreConsistency(
        'Application content',
        assessorScores,
        criterion
      );

      expect(result.analysis).toContain('Assessor 2');
      expect(result.suggestedResolution).toBe(7);
      expect(result.confidence).toBe(0.75);
    });

    it('should throw when feature disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(
        analyzeScoreConsistency('Content', assessorScores, criterion)
      ).rejects.toThrow('Scoring assistance feature is disabled');
    });

    it('should include assessor comments in prompt', async () => {
      mockExtractJson.mockResolvedValue({
        analysis: 'Analysis',
        confidence: 0.8,
      });

      await analyzeScoreConsistency('Content', assessorScores, criterion);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('Excellent'),
        expect.any(String)
      );
      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('Average'),
        expect.any(String)
      );
    });

    it('should truncate long content', async () => {
      const longContent = 'x'.repeat(3000);

      mockExtractJson.mockResolvedValue({
        analysis: 'Analysis',
        confidence: 0.8,
      });

      await analyzeScoreConsistency(longContent, assessorScores, criterion);

      // Content should be truncated to 2000 chars
      const call = mockExtractJson.mock.calls[0][0] as string;
      expect(call.length).toBeLessThan(longContent.length + 500);
    });

    it('should handle scores without comments', async () => {
      const scoresWithoutComments = [
        { assessorId: 'assessor-1', criterionId: 'criterion-1', score: 8 },
        { assessorId: 'assessor-2', criterionId: 'criterion-1', score: 5 },
      ];

      mockExtractJson.mockResolvedValue({
        analysis: 'Analysis',
        confidence: 0.8,
      });

      await analyzeScoreConsistency('Content', scoresWithoutComments, criterion);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.not.stringContaining('undefined'),
        expect.any(String)
      );
    });
  });

  describe('suggestFeedback', () => {
    const criterion: CriterionDefinition = {
      criterionId: 'criterion-1',
      name: 'Innovation',
      description: 'Level of innovation',
      maxPoints: 10,
    };

    it('should suggest feedback comments', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedComments: [
          'The proposal demonstrates strong innovation.',
          'Consider expanding on the methodology.',
        ],
        improvementAreas: [
          'Budget justification',
          'Timeline details',
        ],
      });

      const result = await suggestFeedback('Application content', criterion, 8);

      expect(result.suggestedComments).toHaveLength(2);
      expect(result.improvementAreas).toHaveLength(2);
    });

    it('should return empty arrays when feature disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      const result = await suggestFeedback('Content', criterion, 8);

      expect(result.suggestedComments).toHaveLength(0);
      expect(result.improvementAreas).toHaveLength(0);
    });

    it('should return empty arrays on error', async () => {
      mockExtractJson.mockRejectedValue(new Error('API error'));

      const result = await suggestFeedback('Content', criterion, 8);

      expect(result.suggestedComments).toHaveLength(0);
      expect(result.improvementAreas).toHaveLength(0);
    });

    it('should include score in prompt', async () => {
      mockExtractJson.mockResolvedValue({
        suggestedComments: [],
        improvementAreas: [],
      });

      await suggestFeedback('Content', criterion, 7);

      expect(mockExtractJson).toHaveBeenCalledWith(
        expect.stringContaining('7/10'),
        expect.any(String)
      );
    });

    it('should truncate long content', async () => {
      const longContent = 'x'.repeat(2000);

      mockExtractJson.mockResolvedValue({
        suggestedComments: [],
        improvementAreas: [],
      });

      await suggestFeedback(longContent, criterion, 8);

      // Content should be truncated to 1500 chars
      const call = mockExtractJson.mock.calls[0][0] as string;
      expect(call.length).toBeLessThan(longContent.length + 500);
    });
  });

  describe('edge cases', () => {
    it('should handle criteria without weight', async () => {
      const criteriaWithoutWeight: CriterionDefinition[] = [
        {
          criterionId: 'criterion-1',
          name: 'Test',
          description: 'Test criterion',
          maxPoints: 10,
        },
      ];

      mockExtractJson.mockResolvedValue({
        suggestions: [],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      await generateScoringSuggestions({
        applicationId: 'app-1',
        applicationContent: 'Content',
        criteria: criteriaWithoutWeight,
      });

      // Should not include weight in prompt
      const call = mockExtractJson.mock.calls[0][0] as string;
      expect(call).not.toContain('weight:');
    });

    it('should handle missing response fields', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [
          {
            criterionId: 'criterion-1',
            suggestedScore: 7,
            reasoning: 'Good',
            confidence: 0.8,
          },
        ],
        // Missing overallAssessment, strengthsIdentified, weaknessesIdentified
      });

      const result = await generateScoringSuggestions({
        applicationId: 'app-1',
        applicationContent: 'Content',
        criteria: mockCriteria,
      });

      expect(result.overallAssessment).toBe('');
      expect(result.strengthsIdentified).toEqual([]);
      expect(result.weaknessesIdentified).toEqual([]);
    });

    it('should handle unknown criterion in suggestions', async () => {
      mockExtractJson.mockResolvedValue({
        suggestions: [
          {
            criterionId: 'unknown-criterion',
            suggestedScore: 7,
            reasoning: 'Good',
            confidence: 0.8,
            relevantExcerpts: [],
          },
        ],
        overallAssessment: '',
        strengthsIdentified: [],
        weaknessesIdentified: [],
      });

      const result = await generateScoringSuggestions({
        applicationId: 'app-1',
        applicationContent: 'Content',
        criteria: mockCriteria,
      });

      // Should keep suggestion as-is (no normalization for unknown criteria)
      expect(result.suggestions[0].suggestedScore).toBe(7);
    });
  });
});
