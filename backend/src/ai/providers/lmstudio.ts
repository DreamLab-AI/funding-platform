// =============================================================================
// LM Studio Provider - Local LLM Support via LM Studio
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

// LM Studio uses OpenAI-compatible API format
interface LMStudioMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LMStudioCompletionResponse {
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
    finish_reason: 'stop' | 'length' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LMStudioEmbeddingResponse {
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

interface LMStudioModelListResponse {
  object: string;
  data: {
    id: string;
    object: string;
    owned_by: string;
  }[];
}

export class LMStudioProvider extends AIProvider {
  private client: AxiosInstance;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = this.createClient();
  }

  get providerType(): AIProviderType {
    return 'lmstudio';
  }

  get displayName(): string {
    return 'LM Studio (Local)';
  }

  isConfigured(): boolean {
    return !!this.config.model;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.model) {
      errors.push('Model is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.post<LMStudioCompletionResponse>(
        '/v1/chat/completions',
        {
          model: request.model || this.config.model,
          messages: this.formatMessages(request.messages),
          max_tokens: request.maxTokens || this.config.maxTokens || 2048,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          stream: false,
        }
      );

      logger.debug('LM Studio completion successful', {
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
        '/v1/chat/completions',
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

      const response = await this.client.post<LMStudioEmbeddingResponse>(
        '/v1/embeddings',
        {
          model: request.model || this.config.model,
          input: inputs,
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
      // LM Studio may not support embeddings depending on the model
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        throw new AIServiceError(
          'The loaded model does not support embeddings',
          AIErrorCode.FEATURE_DISABLED,
          this.providerType
        );
      }
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const startTime = Date.now();

    try {
      const response = await this.client.get<LMStudioModelListResponse>('/v1/models');
      const modelAvailable = response.data.data.some(
        (m) => m.id === this.config.model || m.id.includes(this.config.model)
      );

      this.lastHealthCheck = {
        provider: this.providerType,
        status: modelAvailable ? 'healthy' : 'degraded',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        modelAvailable,
        error: modelAvailable ? undefined : `Model ${this.config.model} not loaded`,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.lastHealthCheck = {
        provider: this.providerType,
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: axiosError.code === 'ECONNREFUSED'
          ? 'LM Studio server not running. Start the local server in LM Studio.'
          : axiosError.message,
        modelAvailable: false,
      };
    }

    return this.lastHealthCheck;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get<LMStudioModelListResponse>('/v1/models');
      return response.data.data.map((m) => m.id).sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected formatMessages(messages: AIMessage[]): LMStudioMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  protected parseResponse(response: LMStudioCompletionResponse): AICompletionResponse {
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
    return 'http://localhost:1234';
  }

  private createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // LM Studio doesn't require API key but allows it
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return axios.create({
      baseURL: this.getEndpoint(),
      headers,
      timeout: this.config.timeout || 300000, // Local inference can be slow
    });
  }

  private handleError(error: unknown): AIServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: { message?: string } }>;
      const status = axiosError.response?.status;
      const errorMessage = axiosError.response?.data?.error?.message;

      if (axiosError.code === 'ECONNREFUSED') {
        return new AIServiceError(
          'LM Studio server is not running. Start the local server in LM Studio.',
          AIErrorCode.SERVICE_UNAVAILABLE,
          this.providerType
        );
      }

      if (status === 404) {
        return new AIServiceError(
          `Model not found: ${this.config.model}. Load a model in LM Studio.`,
          AIErrorCode.MODEL_NOT_FOUND,
          this.providerType
        );
      }

      return new AIServiceError(
        errorMessage || axiosError.message,
        AIErrorCode.SERVICE_UNAVAILABLE,
        this.providerType
      );
    }

    return new AIServiceError(
      error instanceof Error ? error.message : 'Unknown error',
      AIErrorCode.UNKNOWN_ERROR,
      this.providerType
    );
  }
}
