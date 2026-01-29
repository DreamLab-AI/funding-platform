// =============================================================================
// AI Service - Main Service Interface with Caching
// =============================================================================

import {
  AIConfigOptions,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIServiceStatus,
  AIServiceError,
  AIErrorCode,
  AIHealthStatus,
} from './types';
import { getAIRouter, resetAIRouter, AIRouter } from './router';
import { getAICache, AICache } from './cache';
import { logger } from '../utils/logger';
import { aiConfig } from '../config/ai.config';

/**
 * Main AI Service - Provides unified access to AI capabilities
 */
export class AIService {
  private router: AIRouter;
  private cache: AICache;
  private requestCount: number = 0;
  private tokenCount: number = 0;
  private lastResetTime: Date = new Date();

  constructor(config?: AIConfigOptions) {
    const effectiveConfig = config || aiConfig;
    this.router = getAIRouter(effectiveConfig);
    this.cache = getAICache({
      maxEntries: effectiveConfig.cache.maxEntries,
      ttlSeconds: effectiveConfig.cache.ttlSeconds,
    });

    // Start health checks if enabled
    if (effectiveConfig.enabled) {
      this.router.startHealthChecks(60000);
    }

    logger.info('AI Service initialized');
  }

  // ---------------------------------------------------------------------------
  // Core Completion Methods
  // ---------------------------------------------------------------------------

  /**
   * Generate a completion with optional caching
   */
  async complete(
    request: AICompletionRequest,
    options?: { useCache?: boolean; cacheTtl?: number }
  ): Promise<AICompletionResponse> {
    const useCache = options?.useCache ?? true;

    if (useCache) {
      const cacheKey = AICache.generateKey({
        type: 'completion',
        messages: request.messages,
        model: request.model,
        temperature: request.temperature,
      });

      const cached = this.cache.get(cacheKey) as AICompletionResponse | undefined;
      if (cached) {
        logger.debug('AI completion cache hit');
        return cached;
      }
    }

    await this.checkRateLimits();

    const provider = this.router.getActiveProvider();
    const response = await provider.complete(request);

    // Update usage tracking
    this.requestCount++;
    this.tokenCount += response.usage.totalTokens;

    // Cache the response
    if (useCache) {
      const cacheKey = AICache.generateKey({
        type: 'completion',
        messages: request.messages,
        model: request.model,
        temperature: request.temperature,
      });
      this.cache.set(cacheKey, response, options?.cacheTtl);
    }

    return response;
  }

  /**
   * Generate a streaming completion
   */
  async *completeStream(
    request: AICompletionRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    await this.checkRateLimits();

    const provider = this.router.getActiveProvider();

    for await (const chunk of provider.completeStream(request)) {
      yield chunk;
    }

    this.requestCount++;
  }

  /**
   * Generate embeddings with optional caching
   */
  async embed(
    request: EmbeddingRequest,
    options?: { useCache?: boolean; cacheTtl?: number }
  ): Promise<EmbeddingResponse> {
    const useCache = options?.useCache ?? true;
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    if (useCache) {
      const cacheKey = AICache.generateKey({
        type: 'embedding',
        input: inputs,
        model: request.model,
      });

      const cached = this.cache.get(cacheKey) as EmbeddingResponse | undefined;
      if (cached) {
        logger.debug('AI embedding cache hit');
        return cached;
      }
    }

    await this.checkRateLimits();

    const provider = this.router.getActiveProvider();
    const response = await provider.embed(request);

    // Update usage tracking
    this.requestCount++;
    this.tokenCount += response.usage.totalTokens;

    // Cache the response
    if (useCache) {
      const cacheKey = AICache.generateKey({
        type: 'embedding',
        input: inputs,
        model: request.model,
      });
      this.cache.set(cacheKey, response, options?.cacheTtl);
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Simple text completion helper
   */
  async generateText(
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      useCache?: boolean;
    }
  ): Promise<string> {
    const messages = options?.systemPrompt
      ? [
          { role: 'system' as const, content: options.systemPrompt },
          { role: 'user' as const, content: prompt },
        ]
      : [{ role: 'user' as const, content: prompt }];

    const response = await this.complete(
      {
        messages,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      },
      { useCache: options?.useCache }
    );

    return response.content;
  }

  /**
   * Chat-style completion with history
   */
  async chat(
    userMessage: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const messages = [
      ...(options?.systemPrompt
        ? [{ role: 'system' as const, content: options.systemPrompt }]
        : []),
      ...history,
      { role: 'user' as const, content: userMessage },
    ];

    const response = await this.complete(
      {
        messages,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      },
      { useCache: false } // Don't cache chat responses
    );

    return response.content;
  }

  /**
   * Extract structured data from text
   */
  async extractJson<T>(
    text: string,
    schema: string,
    options?: { maxTokens?: number }
  ): Promise<T> {
    const systemPrompt = `You are a data extraction assistant. Extract the requested information from the text and return it as valid JSON matching this schema:

${schema}

Important:
- Return ONLY valid JSON, no other text
- Use null for missing values
- Follow the exact schema structure`;

    const response = await this.generateText(text, {
      systemPrompt,
      maxTokens: options?.maxTokens || 2048,
      temperature: 0.1, // Low temperature for consistent extraction
      useCache: true,
    });

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from AI response', { response, error });
      throw new AIServiceError(
        'Failed to parse structured data from AI response',
        AIErrorCode.INVALID_REQUEST
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------

  /**
   * Get the currently active provider type
   */
  getActiveProvider(): AIProviderType | null {
    return this.router.getActiveProviderType();
  }

  /**
   * Switch to a different provider
   */
  setProvider(provider: AIProviderType): void {
    this.router.setActiveProvider(provider);
  }

  /**
   * List available providers
   */
  listProviders(): { type: AIProviderType; name: string; configured: boolean }[] {
    return this.router.listProviders();
  }

  /**
   * Check if AI service is enabled
   */
  isEnabled(): boolean {
    return this.router.isEnabled();
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: 'summarization' | 'scoringAssist' | 'anomalyDetection' | 'similarity'): boolean {
    return this.router.isFeatureEnabled(feature);
  }

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Get full service status
   */
  async getStatus(): Promise<AIServiceStatus> {
    const healthResults = await this.router.healthCheckAll();
    const cacheStats = this.cache.getStats();
    const features = this.router.getFeatureStatus();

    return {
      enabled: this.router.isEnabled(),
      activeProvider: this.router.getActiveProviderType(),
      providers: healthResults,
      cacheStats: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size: cacheStats.size,
      },
      features,
      usage: {
        requestCount: this.requestCount,
        tokenCount: this.tokenCount,
        cacheHitRate: this.cache.getHitRate(),
        sinceTime: this.lastResetTime,
      },
    };
  }

  /**
   * Health check for the active provider
   */
  async healthCheck(): Promise<AIHealthStatus> {
    return this.router.healthCheck();
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    requestCount: number;
    tokenCount: number;
    cacheHitRate: number;
    sinceTime: Date;
  } {
    return {
      requestCount: this.requestCount,
      tokenCount: this.tokenCount,
      cacheHitRate: this.cache.getHitRate(),
      sinceTime: this.lastResetTime,
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.requestCount = 0;
    this.tokenCount = 0;
    this.lastResetTime = new Date();
    this.cache.resetStats();
  }

  // ---------------------------------------------------------------------------
  // Rate Limiting
  // ---------------------------------------------------------------------------

  private async checkRateLimits(): Promise<void> {
    const config = this.router.getConfig();
    const { requestsPerMinute, tokensPerMinute } = config.rateLimit;

    // Simple rate limiting - in production, use a proper rate limiter
    const minutesSinceReset =
      (Date.now() - this.lastResetTime.getTime()) / 60000;

    if (minutesSinceReset >= 1) {
      this.resetUsageStats();
    }

    if (this.requestCount >= requestsPerMinute) {
      throw new AIServiceError(
        'Rate limit exceeded: too many requests',
        AIErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    if (this.tokenCount >= tokensPerMinute) {
      throw new AIServiceError(
        'Rate limit exceeded: token limit reached',
        AIErrorCode.RATE_LIMIT_EXCEEDED
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prune expired cache entries
   */
  pruneCache(): number {
    return this.cache.prune();
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /**
   * Gracefully shutdown the service
   */
  shutdown(): void {
    this.router.stopHealthChecks();
    logger.info('AI Service shut down');
  }
}

// Singleton instance
let serviceInstance: AIService | null = null;

/**
 * Get or create the AI service singleton
 */
export function getAIService(config?: AIConfigOptions): AIService {
  if (!serviceInstance) {
    serviceInstance = new AIService(config);
  }
  return serviceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export function resetAIService(): void {
  if (serviceInstance) {
    serviceInstance.shutdown();
    serviceInstance = null;
  }
  resetAIRouter();
}

export default AIService;
