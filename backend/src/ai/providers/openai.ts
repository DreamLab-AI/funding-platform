// =============================================================================
// OpenAI Provider - OpenAI and Azure OpenAI Support
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIModelListResponse {
  object: string;
  data: {
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }[];
}

export class OpenAIProvider extends AIProvider {
  private client: AxiosInstance;
  private isAzure: boolean;

  constructor(config: AIProviderConfig) {
    super(config);
    this.isAzure = config.endpoint?.includes('azure.com') || false;
    this.client = this.createClient();
  }

  get providerType(): AIProviderType {
    return 'openai';
  }

  get displayName(): string {
    return this.isAzure ? 'Azure OpenAI' : 'OpenAI';
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && !!this.config.model;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('API key is required');
    }

    if (!this.config.model) {
      errors.push('Model is required');
    }

    if (this.isAzure && !this.config.endpoint) {
      errors.push('Azure endpoint is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.post<OpenAICompletionResponse>(
        this.getCompletionPath(),
        {
          model: request.model || this.config.model,
          messages: this.formatMessages(request.messages),
          max_tokens: request.maxTokens || this.config.maxTokens || 2048,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
        }
      );

      logger.debug('OpenAI completion successful', {
        model: response.data.model,
        tokens: response.data.usage.total_tokens,
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
        this.getCompletionPath(),
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
                  id: parsed.id,
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

      const response = await this.client.post<OpenAIEmbeddingResponse>(
        this.getEmbeddingPath(),
        {
          model: request.model || 'text-embedding-3-small',
          input: inputs,
          dimensions: request.dimensions,
        }
      );

      return {
        embeddings: response.data.data.map((d) => d.embedding),
        model: response.data.model,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          totalTokens: response.data.usage.total_tokens,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const startTime = Date.now();

    try {
      // Try to list models as a health check
      await this.client.get(this.getModelsPath());

      this.lastHealthCheck = {
        provider: this.providerType,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        modelAvailable: true,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.lastHealthCheck = {
        provider: this.providerType,
        status: axiosError.response?.status === 401 ? 'unhealthy' : 'degraded',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: axiosError.message,
        modelAvailable: false,
      };
    }

    return this.lastHealthCheck;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get<OpenAIModelListResponse>(
        this.getModelsPath()
      );
      return response.data.data
        .filter((m) => m.id.includes('gpt') || m.id.includes('text'))
        .map((m) => m.id)
        .sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected formatMessages(messages: AIMessage[]): OpenAIMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  protected parseResponse(response: OpenAICompletionResponse): AICompletionResponse {
    return {
      id: response.id,
      model: response.model,
      content: response.choices[0]?.message?.content || '',
      finishReason: response.choices[0]?.finish_reason || null,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      created: response.created,
    };
  }

  protected getDefaultEndpoint(): string {
    return 'https://api.openai.com/v1';
  }

  private createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.isAzure) {
      headers['api-key'] = this.config.apiKey || '';
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return axios.create({
      baseURL: this.getEndpoint(),
      headers,
      timeout: this.config.timeout || 60000,
    });
  }

  private getCompletionPath(): string {
    if (this.isAzure) {
      return `/openai/deployments/${this.config.model}/chat/completions?api-version=2024-02-15-preview`;
    }
    return '/chat/completions';
  }

  private getEmbeddingPath(): string {
    if (this.isAzure) {
      return `/openai/deployments/${this.config.model}/embeddings?api-version=2024-02-15-preview`;
    }
    return '/embeddings';
  }

  private getModelsPath(): string {
    if (this.isAzure) {
      return '/openai/models?api-version=2024-02-15-preview';
    }
    return '/models';
  }

  private handleError(error: unknown): AIServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: { message?: string; code?: string } }>;
      const status = axiosError.response?.status;
      const errorData = axiosError.response?.data?.error;

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

      if (errorData?.code === 'context_length_exceeded') {
        return new AIServiceError(
          'Context length exceeded',
          AIErrorCode.CONTEXT_LENGTH_EXCEEDED,
          this.providerType
        );
      }

      return new AIServiceError(
        errorData?.message || axiosError.message,
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
