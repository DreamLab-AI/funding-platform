// =============================================================================
// Ollama Provider - Local LLM Support via Ollama
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

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaModelListResponse {
  models: {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    };
  }[];
}

export class OllamaProvider extends AIProvider {
  private client: AxiosInstance;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = this.createClient();
  }

  get providerType(): AIProviderType {
    return 'ollama';
  }

  get displayName(): string {
    return 'Ollama (Local)';
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
      const response = await this.client.post<OllamaChatResponse>('/api/chat', {
        model: request.model || this.config.model,
        messages: this.formatMessages(request.messages),
        stream: false,
        options: {
          num_predict: request.maxTokens || this.config.maxTokens || 2048,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
        },
      });

      const latencyMs = Date.now() - startTime;

      logger.debug('Ollama completion successful', {
        model: response.data.model,
        promptTokens: response.data.prompt_eval_count,
        completionTokens: response.data.eval_count,
        latencyMs,
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
        '/api/chat',
        {
          model: request.model || this.config.model,
          messages: this.formatMessages(request.messages),
          stream: true,
          options: {
            num_predict: request.maxTokens || this.config.maxTokens || 2048,
            temperature: request.temperature ?? this.config.temperature ?? 0.7,
          },
        },
        {
          responseType: 'stream',
        }
      );

      const stream = response.data;
      let buffer = '';
      let responseId = `ollama-${Date.now()}`;

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed: OllamaChatResponse = JSON.parse(line);

            yield {
              id: responseId,
              delta: parsed.message?.content || '',
              finishReason: parsed.done ? 'stop' : null,
            };

            if (parsed.done) {
              return;
            }
          } catch {
            // Skip malformed JSON
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
      const embeddings: number[][] = [];

      for (const input of inputs) {
        const response = await this.client.post<OllamaEmbeddingResponse>(
          '/api/embeddings',
          {
            model: request.model || this.config.model,
            prompt: input,
          }
        );
        embeddings.push(response.data.embedding);
      }

      return {
        embeddings,
        model: request.model || this.config.model,
        usage: {
          promptTokens: 0, // Ollama doesn't provide token counts
          totalTokens: 0,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const startTime = Date.now();

    try {
      // Check if Ollama is running by listing models
      const response = await this.client.get<OllamaModelListResponse>('/api/tags');
      const modelAvailable = response.data.models.some(
        (m) => m.name === this.config.model || m.name.startsWith(`${this.config.model}:`)
      );

      this.lastHealthCheck = {
        provider: this.providerType,
        status: modelAvailable ? 'healthy' : 'degraded',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        modelAvailable,
        error: modelAvailable ? undefined : `Model ${this.config.model} not found`,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.lastHealthCheck = {
        provider: this.providerType,
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: axiosError.code === 'ECONNREFUSED'
          ? 'Ollama server not running'
          : axiosError.message,
        modelAvailable: false,
      };
    }

    return this.lastHealthCheck;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get<OllamaModelListResponse>('/api/tags');
      return response.data.models.map((m) => m.name).sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Pull a model from the Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      await this.client.post('/api/pull', {
        name: modelName,
        stream: false,
      });
      logger.info('Model pulled successfully', { model: modelName });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected formatMessages(messages: AIMessage[]): OllamaMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  protected parseResponse(response: OllamaChatResponse): AICompletionResponse {
    return {
      id: `ollama-${Date.now()}`,
      model: response.model,
      content: response.message?.content || '',
      finishReason: response.done ? 'stop' : null,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
      created: new Date(response.created_at).getTime(),
    };
  }

  protected getDefaultEndpoint(): string {
    return 'http://localhost:11434';
  }

  private createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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
      const axiosError = error as AxiosError<{ error?: string }>;
      const status = axiosError.response?.status;
      const errorMessage = axiosError.response?.data?.error;

      if (axiosError.code === 'ECONNREFUSED') {
        return new AIServiceError(
          'Ollama server is not running. Start it with: ollama serve',
          AIErrorCode.SERVICE_UNAVAILABLE,
          this.providerType
        );
      }

      if (status === 404) {
        return new AIServiceError(
          `Model not found: ${this.config.model}. Pull it with: ollama pull ${this.config.model}`,
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
