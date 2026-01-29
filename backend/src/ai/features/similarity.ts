// =============================================================================
// Similarity Feature - Find Similar Applications
// =============================================================================

import {
  SimilaritySearchRequest,
  SimilaritySearchResponse,
  SimilarApplication,
  AIServiceError,
  AIErrorCode,
  EmbeddingResponse,
} from '../types';
import { getAIService } from '../ai.service';
import { AICache, getAICache } from '../cache';
import { logger } from '../../utils/logger';

// In-memory embedding store (in production, use a vector database like RuVector)
interface StoredEmbedding {
  applicationId: string;
  referenceNumber: string;
  applicantName: string;
  callId: string;
  callName: string;
  embedding: number[];
  contentPreview: string;
  createdAt: Date;
}

// Simple in-memory store (replace with vector database in production)
const embeddingStore: Map<string, StoredEmbedding> = new Map();

/**
 * Search for similar applications
 */
export async function findSimilarApplications(
  request: SimilaritySearchRequest
): Promise<SimilaritySearchResponse> {
  const startTime = Date.now();
  const service = getAIService();

  if (!service.isFeatureEnabled('similarity')) {
    throw new AIServiceError(
      'Similarity search feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  const topK = request.topK || 5;
  const minSimilarity = request.minSimilarity || 0.7;

  let queryEmbedding: number[];
  let contentPreview: string | undefined;

  // Get embedding for the query
  if (request.applicationId) {
    const stored = embeddingStore.get(request.applicationId);
    if (stored) {
      queryEmbedding = stored.embedding;
      contentPreview = stored.contentPreview;
    } else {
      throw new AIServiceError(
        `Application ${request.applicationId} not found in embedding store`,
        AIErrorCode.INVALID_REQUEST
      );
    }
  } else if (request.content) {
    const embeddingResponse = await service.embed({
      input: request.content,
    });
    queryEmbedding = embeddingResponse.embeddings[0];
    contentPreview = request.content.substring(0, 200);
  } else {
    throw new AIServiceError(
      'Either applicationId or content must be provided',
      AIErrorCode.INVALID_REQUEST
    );
  }

  // Find similar applications
  const similarities: { stored: StoredEmbedding; similarity: number }[] = [];

  for (const [id, stored] of embeddingStore) {
    // Skip the query application itself
    if (id === request.applicationId) continue;

    // Filter by call if specified
    if (request.callId && stored.callId !== request.callId) continue;

    const similarity = cosineSimilarity(queryEmbedding, stored.embedding);

    if (similarity >= minSimilarity) {
      similarities.push({ stored, similarity });
    }
  }

  // Sort by similarity and take top K
  similarities.sort((a, b) => b.similarity - a.similarity);
  const topSimilar = similarities.slice(0, topK);

  // Extract shared themes using AI
  const results: SimilarApplication[] = [];

  for (const { stored, similarity } of topSimilar) {
    let sharedThemes: string[] = [];

    // Only extract themes for highly similar applications
    if (similarity > 0.85 && contentPreview) {
      try {
        sharedThemes = await extractSharedThemes(
          contentPreview,
          stored.contentPreview,
          service
        );
      } catch {
        // Continue without themes on error
      }
    }

    results.push({
      applicationId: stored.applicationId,
      referenceNumber: stored.referenceNumber,
      applicantName: stored.applicantName,
      similarity,
      sharedThemes,
      callId: stored.callId,
      callName: stored.callName,
    });
  }

  logger.info('Similarity search completed', {
    queryApplicationId: request.applicationId,
    resultsCount: results.length,
    processingTimeMs: Date.now() - startTime,
  });

  return {
    query: {
      applicationId: request.applicationId,
      contentPreview: contentPreview?.substring(0, 100),
    },
    results,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Index an application for similarity search
 */
export async function indexApplication(
  application: {
    applicationId: string;
    referenceNumber: string;
    applicantName: string;
    callId: string;
    callName: string;
    content: string;
  }
): Promise<void> {
  const service = getAIService();

  if (!service.isFeatureEnabled('similarity')) {
    throw new AIServiceError(
      'Similarity search feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  try {
    // Generate embedding
    const embeddingResponse = await service.embed({
      input: application.content,
    });

    // Store the embedding
    embeddingStore.set(application.applicationId, {
      applicationId: application.applicationId,
      referenceNumber: application.referenceNumber,
      applicantName: application.applicantName,
      callId: application.callId,
      callName: application.callName,
      embedding: embeddingResponse.embeddings[0],
      contentPreview: application.content.substring(0, 500),
      createdAt: new Date(),
    });

    logger.debug('Application indexed for similarity search', {
      applicationId: application.applicationId,
    });
  } catch (error) {
    logger.error('Failed to index application', {
      applicationId: application.applicationId,
      error,
    });
    throw error;
  }
}

/**
 * Remove an application from the similarity index
 */
export function removeFromIndex(applicationId: string): boolean {
  return embeddingStore.delete(applicationId);
}

/**
 * Batch index multiple applications
 */
export async function batchIndexApplications(
  applications: Array<{
    applicationId: string;
    referenceNumber: string;
    applicantName: string;
    callId: string;
    callName: string;
    content: string;
  }>
): Promise<{ indexed: number; failed: number; errors: string[] }> {
  const service = getAIService();
  const errors: string[] = [];
  let indexed = 0;

  // Process in batches to avoid rate limits
  const batchSize = 10;

  for (let i = 0; i < applications.length; i += batchSize) {
    const batch = applications.slice(i, i + batchSize);

    try {
      // Generate embeddings for the batch
      const contents = batch.map((a) => a.content);
      const embeddingResponse = await service.embed({
        input: contents,
      });

      // Store each embedding
      for (let j = 0; j < batch.length; j++) {
        const app = batch[j];
        embeddingStore.set(app.applicationId, {
          applicationId: app.applicationId,
          referenceNumber: app.referenceNumber,
          applicantName: app.applicantName,
          callId: app.callId,
          callName: app.callName,
          embedding: embeddingResponse.embeddings[j],
          contentPreview: app.content.substring(0, 500),
          createdAt: new Date(),
        });
        indexed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Batch ${i / batchSize}: ${errorMessage}`);

      // Try indexing individually on batch failure
      for (const app of batch) {
        try {
          await indexApplication(app);
          indexed++;
        } catch (individualError) {
          const msg = individualError instanceof Error
            ? individualError.message
            : 'Unknown error';
          errors.push(`${app.applicationId}: ${msg}`);
        }
      }
    }
  }

  logger.info('Batch indexing completed', {
    total: applications.length,
    indexed,
    failed: applications.length - indexed,
  });

  return {
    indexed,
    failed: applications.length - indexed,
    errors,
  };
}

/**
 * Get index statistics
 */
export function getIndexStats(): {
  totalApplications: number;
  callBreakdown: Record<string, number>;
  oldestEntry: Date | null;
  newestEntry: Date | null;
} {
  const callBreakdown: Record<string, number> = {};
  let oldestEntry: Date | null = null;
  let newestEntry: Date | null = null;

  for (const stored of embeddingStore.values()) {
    callBreakdown[stored.callId] = (callBreakdown[stored.callId] || 0) + 1;

    if (!oldestEntry || stored.createdAt < oldestEntry) {
      oldestEntry = stored.createdAt;
    }
    if (!newestEntry || stored.createdAt > newestEntry) {
      newestEntry = stored.createdAt;
    }
  }

  return {
    totalApplications: embeddingStore.size,
    callBreakdown,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Clear the similarity index
 */
export function clearIndex(): void {
  embeddingStore.clear();
  logger.info('Similarity index cleared');
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Extract shared themes between two application contents
 */
async function extractSharedThemes(
  content1: string,
  content2: string,
  service: ReturnType<typeof getAIService>
): Promise<string[]> {
  const prompt = `Identify 3-5 shared themes between these two application excerpts:

Application 1:
${content1}

Application 2:
${content2}

List only the themes they have in common.`;

  try {
    const result = await service.extractJson<{ themes: string[] }>(
      prompt,
      '{ "themes": ["array of shared themes"] }'
    );
    return result.themes || [];
  } catch {
    return [];
  }
}
