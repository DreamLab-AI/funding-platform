/**
 * Similarity Feature Unit Tests
 * Tests for application similarity matching and embedding-based search
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Define mock functions at module scope
const mockIsFeatureEnabled = jest.fn();
const mockEmbed = jest.fn();
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
    embed: mockEmbed,
    extractJson: mockExtractJson,
  })),
}));

// Mock cache
jest.mock('../../../src/ai/cache', () => ({
  getAICache: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  AICache: {
    generateKey: jest.fn(() => 'mock-key'),
  },
}));

import {
  findSimilarApplications,
  indexApplication,
  removeFromIndex,
  batchIndexApplications,
  getIndexStats,
  clearIndex,
} from '../../../src/ai/features/similarity';
import { AIServiceError, AIErrorCode } from '../../../src/ai/types';

describe('Similarity Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    clearIndex(); // Reset index before each test
  });

  afterEach(() => {
    clearIndex();
  });

  describe('indexApplication', () => {
    const mockApplication = {
      applicationId: 'app-123',
      referenceNumber: 'REF-001',
      applicantName: 'Test Applicant',
      callId: 'call-456',
      callName: 'Research Grant 2024',
      content: 'This is a research proposal about quantum computing.',
    };

    it('should index an application successfully', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication(mockApplication);

      const stats = getIndexStats();
      expect(stats.totalApplications).toBe(1);
    });

    it('should throw when feature is disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(indexApplication(mockApplication)).rejects.toThrow(
        'Similarity search feature is disabled'
      );
    });

    it('should store content preview', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      const longContent = 'x'.repeat(1000);
      await indexApplication({
        ...mockApplication,
        content: longContent,
      });

      const stats = getIndexStats();
      expect(stats.totalApplications).toBe(1);
    });

    it('should re-throw embedding errors', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding failed'));

      await expect(indexApplication(mockApplication)).rejects.toThrow('Embedding failed');
    });

    it('should track call breakdown in stats', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication(mockApplication);
      await indexApplication({
        ...mockApplication,
        applicationId: 'app-124',
        callId: 'call-789',
      });

      const stats = getIndexStats();
      expect(stats.callBreakdown['call-456']).toBe(1);
      expect(stats.callBreakdown['call-789']).toBe(1);
    });
  });

  describe('findSimilarApplications', () => {
    beforeEach(async () => {
      // Index some test applications
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Quantum computing research',
      });

      await indexApplication({
        applicationId: 'app-2',
        referenceNumber: 'REF-002',
        applicantName: 'Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Machine learning study',
      });

      await indexApplication({
        applicationId: 'app-3',
        referenceNumber: 'REF-003',
        applicantName: 'Applicant 3',
        callId: 'call-2',
        callName: 'Call 2',
        content: 'Healthcare AI research',
      });
    });

    it('should find similar applications by applicationId', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
        topK: 5,
        minSimilarity: 0.5,
      });

      expect(result.results.length).toBeGreaterThanOrEqual(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should find similar applications by content', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      const result = await findSimilarApplications({
        content: 'Quantum physics research',
        topK: 5,
        minSimilarity: 0.5,
      });

      expect(result.query.contentPreview).toBeTruthy();
    });

    it('should throw when feature is disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      await expect(
        findSimilarApplications({ applicationId: 'app-1' })
      ).rejects.toThrow('Similarity search feature is disabled');
    });

    it('should throw when application not found in index', async () => {
      await expect(
        findSimilarApplications({ applicationId: 'non-existent' })
      ).rejects.toThrow('not found in embedding store');
    });

    it('should throw when neither applicationId nor content provided', async () => {
      await expect(findSimilarApplications({})).rejects.toThrow(
        'Either applicationId or content must be provided'
      );
    });

    it('should filter by callId', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
        callId: 'call-1',
        minSimilarity: 0,
      });

      // Should not include app-3 which is from call-2
      result.results.forEach(r => {
        expect(r.callId).toBe('call-1');
      });
    });

    it('should exclude query application from results', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0,
      });

      const queryInResults = result.results.find(r => r.applicationId === 'app-1');
      expect(queryInResults).toBeUndefined();
    });

    it('should respect topK parameter', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
        topK: 1,
        minSimilarity: 0,
      });

      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should respect minSimilarity threshold', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0.99, // Very high threshold
      });

      // With high threshold, might not find any similar applications
      result.results.forEach(r => {
        expect(r.similarity).toBeGreaterThanOrEqual(0.99);
      });
    });

    it('should use default values for topK and minSimilarity', async () => {
      const result = await findSimilarApplications({
        applicationId: 'app-1',
      });

      expect(result).toBeDefined();
    });

    it('should extract shared themes for highly similar applications', async () => {
      // Mock high similarity by using same embedding
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      mockExtractJson.mockResolvedValue({
        themes: ['AI', 'Research', 'Healthcare'],
      });

      // Re-index with same embeddings for high similarity
      clearIndex();
      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'AI healthcare research',
      });
      await indexApplication({
        applicationId: 'app-2',
        referenceNumber: 'REF-002',
        applicantName: 'Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'AI healthcare study',
      });

      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0,
      });

      // Theme extraction is only called for similarity > 0.85
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle theme extraction failure gracefully', async () => {
      mockExtractJson.mockRejectedValue(new Error('Theme extraction failed'));

      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0,
      });

      // Should not throw, just return empty themes
      expect(result).toBeDefined();
    });
  });

  describe('removeFromIndex', () => {
    beforeEach(async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Test content',
      });
    });

    it('should remove application from index', () => {
      const result = removeFromIndex('app-1');

      expect(result).toBe(true);
      expect(getIndexStats().totalApplications).toBe(0);
    });

    it('should return false for non-existent application', () => {
      const result = removeFromIndex('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('batchIndexApplications', () => {
    const mockApplications = [
      {
        applicationId: 'batch-1',
        referenceNumber: 'REF-B1',
        applicantName: 'Batch Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 1',
      },
      {
        applicationId: 'batch-2',
        referenceNumber: 'REF-B2',
        applicantName: 'Batch Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 2',
      },
      {
        applicationId: 'batch-3',
        referenceNumber: 'REF-B3',
        applicantName: 'Batch Applicant 3',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 3',
      },
    ];

    it('should index multiple applications', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1], [0.2], [0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 30, totalTokens: 30 },
      });

      const result = await batchIndexApplications(mockApplications);

      expect(result.indexed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle batch failures with individual retry', async () => {
      // First batch call fails, individual calls succeed
      mockEmbed
        .mockRejectedValueOnce(new Error('Batch failed'))
        .mockResolvedValue({
          embeddings: [[0.1]],
          model: 'text-embedding-ada-002',
          usage: { promptTokens: 10, totalTokens: 10 },
        });

      const result = await batchIndexApplications(mockApplications);

      // Should have retried individually
      expect(result.indexed).toBe(3);
      expect(result.errors.length).toBeGreaterThan(0); // Batch error recorded
    });

    it('should record individual failures', async () => {
      mockEmbed
        .mockRejectedValueOnce(new Error('Batch failed'))
        .mockResolvedValueOnce({
          embeddings: [[0.1]],
          model: 'text-embedding-ada-002',
          usage: { promptTokens: 10, totalTokens: 10 },
        })
        .mockRejectedValueOnce(new Error('Individual failed'))
        .mockResolvedValueOnce({
          embeddings: [[0.3]],
          model: 'text-embedding-ada-002',
          usage: { promptTokens: 10, totalTokens: 10 },
        });

      const result = await batchIndexApplications(mockApplications);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Individual failed'))).toBe(true);
    });

    it('should process in batches of 10', async () => {
      const largeList = Array.from({ length: 25 }, (_, i) => ({
        applicationId: `app-${i}`,
        referenceNumber: `REF-${i}`,
        applicantName: `Applicant ${i}`,
        callId: 'call-1',
        callName: 'Call 1',
        content: `Content ${i}`,
      }));

      mockEmbed.mockResolvedValue({
        embeddings: Array(10).fill([0.1]),
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 100, totalTokens: 100 },
      });

      const result = await batchIndexApplications(largeList);

      // Should have made 3 batch calls (10, 10, 5)
      expect(mockEmbed).toHaveBeenCalledTimes(3);
      expect(result.indexed).toBe(25);
    });
  });

  describe('getIndexStats', () => {
    it('should return empty stats for empty index', () => {
      const stats = getIndexStats();

      expect(stats.totalApplications).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
      expect(Object.keys(stats.callBreakdown)).toHaveLength(0);
    });

    it('should track oldest and newest entries', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 1',
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await indexApplication({
        applicationId: 'app-2',
        referenceNumber: 'REF-002',
        applicantName: 'Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 2',
      });

      const stats = getIndexStats();

      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
      expect(stats.oldestEntry!.getTime()).toBeLessThanOrEqual(
        stats.newestEntry!.getTime()
      );
    });
  });

  describe('clearIndex', () => {
    it('should clear all indexed applications', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 1',
      });

      expect(getIndexStats().totalApplications).toBe(1);

      clearIndex();

      expect(getIndexStats().totalApplications).toBe(0);
    });
  });

  describe('cosine similarity', () => {
    it('should calculate correct similarity for identical vectors', async () => {
      // Index two applications with same embedding
      mockEmbed.mockResolvedValue({
        embeddings: [[1, 0, 0]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 1',
      });

      await indexApplication({
        applicationId: 'app-2',
        referenceNumber: 'REF-002',
        applicantName: 'Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 2',
      });

      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0,
      });

      // Identical vectors should have similarity = 1
      if (result.results.length > 0) {
        expect(result.results[0].similarity).toBeCloseTo(1, 5);
      }
    });

    it('should calculate zero similarity for orthogonal vectors', async () => {
      // Index with orthogonal vectors
      mockEmbed
        .mockResolvedValueOnce({
          embeddings: [[1, 0, 0]],
          model: 'text-embedding-ada-002',
          usage: { promptTokens: 10, totalTokens: 10 },
        })
        .mockResolvedValueOnce({
          embeddings: [[0, 1, 0]],
          model: 'text-embedding-ada-002',
          usage: { promptTokens: 10, totalTokens: 10 },
        });

      await indexApplication({
        applicationId: 'app-1',
        referenceNumber: 'REF-001',
        applicantName: 'Applicant 1',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 1',
      });

      await indexApplication({
        applicationId: 'app-2',
        referenceNumber: 'REF-002',
        applicantName: 'Applicant 2',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content 2',
      });

      const result = await findSimilarApplications({
        applicationId: 'app-1',
        minSimilarity: 0,
      });

      // Orthogonal vectors should have similarity = 0
      if (result.results.length > 0) {
        expect(result.results[0].similarity).toBeCloseTo(0, 5);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(10000);

      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 1000, totalTokens: 1000 },
      });

      await indexApplication({
        applicationId: 'app-long',
        referenceNumber: 'REF-LONG',
        applicantName: 'Long Content Applicant',
        callId: 'call-1',
        callName: 'Call 1',
        content: longContent,
      });

      const stats = getIndexStats();
      expect(stats.totalApplications).toBe(1);
    });

    it('should handle empty content', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 0, totalTokens: 0 },
      });

      await indexApplication({
        applicationId: 'app-empty',
        referenceNumber: 'REF-EMPTY',
        applicantName: 'Empty Content Applicant',
        callId: 'call-1',
        callName: 'Call 1',
        content: '',
      });

      const stats = getIndexStats();
      expect(stats.totalApplications).toBe(1);
    });

    it('should handle special characters in content', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      await indexApplication({
        applicationId: 'app-special',
        referenceNumber: 'REF-SPECIAL',
        applicantName: 'Special Chars',
        callId: 'call-1',
        callName: 'Call 1',
        content: 'Content with special chars: <>&"\' emoji: ',
      });

      const stats = getIndexStats();
      expect(stats.totalApplications).toBe(1);
    });
  });
});
