// =============================================================================
// Custom Provider - OpenAI-Compatible API Support
// =============================================================================

import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AIProviderType,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIHealthStatus,
  AIServiceError,
  AIErrorCode,
  AIMessage,
} from '../types';
import { AIProvider } from '../provider.interface';
import { logger } from '../../utils/logger';

/**
 * Custom provider for any OpenAI-compatible API endpoint.
 * Works with:
 * - vLLM
 * - Text Generation Inference (TGI)
 * - LocalAI
 * - FastChat
 * - Any other OpenAI-compatible server
 */
export class CustomProvider extends AIProvider {
  private client: AxiosInstance;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = this.createClient();
  }

  get providerType(): AIProviderType {
    return 'custom';
  }

  get displayName(): string {
    return 'Custom Endpoint';
  }

  isConfigured(): boolean {
    return !!this.config.endpoint && !!this.config.model;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.endpoint) {
      errors.push('Endpoint URL is required');
    }

    if (!this.config.model) {
      errors.push('Model is required');
    }

    // Validate endpoint URL format
    if (this.config.endpoint) {
      try {
        new URL(this.config.endpoint);
      } catch {
        errors.push('Invalid endpoint URL format');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.post('/chat/completions', {
        model: request.model || this.config.model,
        messages: this.formatMessages(request.messages),
        max_tokens: request.maxTokens || this.config.maxTokens || 2048,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
        stream: false,
      });

      logger.debug('Custom endpoint completion successful', {
        endpoint: this.config.endpoint,
        model: response.data.model,
        tokens: response.data.usage?.total_tokens,
        latencyMs: Date.now() - startTime,
      });

      return this.parseResponse(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *completeStream(
    request: AICompletionRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model: request.model || this.config.model,
          messages: this.formatMessages(request.messages),
          max_tokens: request.maxTokens || this.config.maxTokens || 2048,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          stream: true,
        },
        {
          responseType: 'stream',
        }
      );

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              const finishReason = parsed.choices?.[0]?.finish_reason || null;

              if (delta || finishReason) {
                yield {
                  id: parsed.id || `custom-${Date.now()}`,
                  delta,
                  finishReason,
                };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];

      const response = await this.client.post('/embeddings', {
        model: request.model || this.config.model,
        input: inputs,
        dimensions: request.dimensions,
      });

      // Handle different response formats
      const embeddings = response.data.data
        ? response.data.data.map((d: { embedding: number[] }) => d.embedding)
        : response.data.embeddings || [response.data.embedding];

      return {
        embeddings,
        model: response.data.model || this.config.model,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const startTime = Date.now();

    try {
      // Try the models endpoint first (OpenAI-compatible)
      await this.client.get('/models');

      this.lastHealthCheck = {
        provider: this.providerType,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        modelAvailable: true,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Some servers don't have /models, try a minimal completion
      if (axiosError.response?.status === 404) {
        try {
          await this.client.post('/chat/completions', {
            model: this.config.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          });

          this.lastHealthCheck = {
            provider: this.providerType,
            status: 'healthy',
            latencyMs: Date.now() - startTime,
            lastChecked: new Date(),
            modelAvailable: true,
          };
        } catch (completionError) {
          const completionAxiosError = completionError as AxiosError;
          this.lastHealthCheck = {
            provider: this.providerType,
            status: 'unhealthy',
            latencyMs: Date.now() - startTime,
            lastChecked: new Date(),
            error: completionAxiosError.message,
            modelAvailable: false,
          };
        }
      } else {
        this.lastHealthCheck = {
          provider: this.providerType,
          status: axiosError.code === 'ECONNREFUSED' ? 'unhealthy' : 'degraded',
          latencyMs: Date.now() - startTime,
          lastChecked: new Date(),
          error: axiosError.message,
          modelAvailable: false,
        };
      }
    }

    return this.lastHealthCheck;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');

      // Handle different response formats
      if (response.data.data) {
        return response.data.data.map((m: { id: string }) => m.id).sort();
      }

      if (response.data.models) {
        return response.data.models
          .map((m: { id?: string; name?: string }) => m.id || m.name)
          .filter(Boolean)
          .sort();
      }

      return [this.config.model];
    } catch (error) {
      // If models endpoint doesn't exist, return configured model
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return [this.config.model];
      }
      throw this.handleError(error);
    }
  }

  protected formatMessages(
    messages: AIMessage[]
  ): { role: string; content: string }[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  protected parseResponse(response: unknown): AICompletionResponse {
    const data = response as {
      id?: string;
      model?: string;
      choices?: {
        message?: { content?: string };
        finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
      }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      created?: number;
    };

    return {
      id: data.id || `custom-${Date.now()}`,
      model: data.model || this.config.model,
      content: data.choices?.[0]?.message?.content || '',
      finishReason: data.choices?.[0]?.finish_reason || null,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      created: data.created || Date.now(),
    };
  }

  protected getDefaultEndpoint(): string {
    return 'http://localhost:8000/v1';
  }

  private createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return axios.create({
      baseURL: this.getEndpoint(),
      headers,
      timeout: this.config.timeout || 300000,
    });
  }

  private handleError(error: unknown): AIServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        error?: { message?: string; code?: string };
        message?: string;
        detail?: string;
      }>;
      const status = axiosError.response?.status;
      const errorData = axiosError.response?.data;
      const errorMessage =
        errorData?.error?.message ||
        errorData?.message ||
        errorData?.detail ||
        axiosError.message;

      if (axiosError.code === 'ECONNREFUSED') {
        return new AIServiceError(
          `Cannot connect to ${this.config.endpoint}. Ensure the server is running.`,
          AIErrorCode.SERVICE_UNAVAILABLE,
          this.providerType
        );
      }

      if (status === 401) {
        return new AIServiceError(
          'Authentication failed',
          AIErrorCode.AUTHENTICATION_FAILED,
          this.providerType
        );
      }

      if (status === 429) {
        return new AIServiceError(
          'Rate limit exceeded',
          AIErrorCode.RATE_LIMIT_EXCEEDED,
          this.providerType
        );
      }

      if (status === 404) {
        return new AIServiceError(
          `Model not found: ${this.config.model}`,
          AIErrorCode.MODEL_NOT_FOUND,
          this.providerType
        );
      }

      return new AIServiceError(
        errorMessage,
        AIErrorCode.SERVICE_UNAVAILABLE,
        this.providerType,
        errorData
      );
    }

    return new AIServiceError(
      error instanceof Error ? error.message : 'Unknown error',
      AIErrorCode.UNKNOWN_ERROR,
      this.providerType
    );
  }
}
