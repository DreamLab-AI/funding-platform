// =============================================================================
// AI Provider Interface - Abstract Contract for All Providers
// =============================================================================

import {
  AIProviderConfig,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIHealthStatus,
} from './types';

/**
 * Abstract base class for AI providers.
 * All provider implementations must extend this class.
 */
export abstract class AIProvider {
  protected config: AIProviderConfig;
  protected lastHealthCheck: AIHealthStatus | null = null;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Get the provider type identifier
   */
  abstract get providerType(): AIProviderType;

  /**
   * Get the display name for this provider
   */
  abstract get displayName(): string;

  /**
   * Check if the provider is properly configured
   */
  abstract isConfigured(): boolean;

  /**
   * Validate the provider configuration
   */
  abstract validateConfig(): { valid: boolean; errors: string[] };

  /**
   * Generate a completion from the AI model
   */
  abstract complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Generate a streaming completion from the AI model
   */
  abstract completeStream(
    request: AICompletionRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown>;

  /**
   * Generate embeddings for the given input
   */
  abstract embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Check the health of the provider
   */
  abstract healthCheck(): Promise<AIHealthStatus>;

  /**
   * Get available models from this provider
   */
  abstract listModels(): Promise<string[]>;

  /**
   * Get the current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration
   */
  updateConfig(updates: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get the last health check result
   */
  getLastHealthStatus(): AIHealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Format messages for the specific provider's API format
   */
  protected abstract formatMessages(
    messages: AICompletionRequest['messages']
  ): unknown;

  /**
   * Parse the provider's response into our standard format
   */
  protected abstract parseResponse(response: unknown): AICompletionResponse;

  /**
   * Build the request headers for API calls
   */
  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  /**
   * Get the base endpoint URL
   */
  protected getEndpoint(): string {
    return this.config.endpoint || this.getDefaultEndpoint();
  }

  /**
   * Get the default endpoint for this provider
   */
  protected abstract getDefaultEndpoint(): string;
}

/**
 * Provider factory interface for creating provider instances
 */
export interface AIProviderFactory {
  create(config: AIProviderConfig): AIProvider;
  supports(providerType: AIProviderType): boolean;
}
