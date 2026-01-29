// =============================================================================
// Anthropic Provider - Claude API Support
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

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicCompletionResponse {
  id: string;
  type: string;
  role: string;
  content: {
    type: string;
    text: string;
  }[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider extends AIProvider {
  private client: AxiosInstance;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = this.createClient();
  }

  get providerType(): AIProviderType {
    return 'anthropic';
  }

  get displayName(): string {
    return 'Anthropic Claude';
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

    // Validate model name format
    if (this.config.model && !this.config.model.startsWith('claude-')) {
      errors.push('Model must be a Claude model (e.g., claude-3-opus-20240229)');
    }

    return { valid: errors.length === 0, errors };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const { systemPrompt, messages } = this.formatMessages(request.messages);

      const response = await this.client.post<AnthropicCompletionResponse>(
        '/messages',
        {
          model: request.model || this.config.model,
          max_tokens: request.maxTokens || this.config.maxTokens || 4096,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          top_p: request.topP,
          system: systemPrompt,
          messages,
          stop_sequences: request.stop,
        }
      );

      logger.debug('Anthropic completion successful', {
        model: response.data.model,
        inputTokens: response.data.usage.input_tokens,
        outputTokens: response.data.usage.output_tokens,
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
      const { systemPrompt, messages } = this.formatMessages(request.messages);

      const response = await this.client.post(
        '/messages',
        {
          model: request.model || this.config.model,
          max_tokens: request.maxTokens || this.config.maxTokens || 4096,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          system: systemPrompt,
          messages,
          stream: true,
        },
        {
          responseType: 'stream',
        }
      );

      const stream = response.data;
      let buffer = '';
      let messageId = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'message_start') {
                messageId = parsed.message.id;
              } else if (parsed.type === 'content_block_delta') {
                yield {
                  id: messageId,
                  delta: parsed.delta.text || '',
                  finishReason: null,
                };
              } else if (parsed.type === 'message_delta') {
                yield {
                  id: messageId,
                  delta: '',
                  finishReason: parsed.delta.stop_reason,
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

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic doesn't have a native embedding API
    // Throw a clear error indicating this limitation
    throw new AIServiceError(
      'Anthropic does not provide an embedding API. Use OpenAI or a local provider for embeddings.',
      AIErrorCode.FEATURE_DISABLED,
      this.providerType
    );
  }

  async healthCheck(): Promise<AIHealthStatus> {
    const startTime = Date.now();

    try {
      // Send a minimal completion request as health check
      await this.client.post('/messages', {
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });

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
    // Anthropic doesn't have a models list API, return known models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  protected formatMessages(
    messages: AIMessage[]
  ): { systemPrompt: string | undefined; messages: AnthropicMessage[] } {
    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system');
    const systemPrompt = systemMessage?.content;

    // Convert remaining messages
    const anthropicMessages: AnthropicMessage[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    return { systemPrompt, messages: anthropicMessages };
  }

  protected parseResponse(response: AnthropicCompletionResponse): AICompletionResponse {
    const content = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    const finishReasonMap: Record<string, AICompletionResponse['finishReason']> = {
      end_turn: 'stop',
      max_tokens: 'length',
      stop_sequence: 'stop',
    };

    return {
      id: response.id,
      model: response.model,
      content,
      finishReason: response.stop_reason
        ? finishReasonMap[response.stop_reason] || 'stop'
        : null,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      created: Date.now(),
    };
  }

  protected getDefaultEndpoint(): string {
    return 'https://api.anthropic.com/v1';
  }

  private createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey || '',
      'anthropic-version': '2023-06-01',
    };

    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return axios.create({
      baseURL: this.getEndpoint(),
      headers,
      timeout: this.config.timeout || 120000, // Claude can be slower
    });
  }

  private handleError(error: unknown): AIServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        error?: { type?: string; message?: string };
      }>;
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

      if (status === 400 && errorData?.type === 'invalid_request_error') {
        if (errorData.message?.includes('context')) {
          return new AIServiceError(
            'Context length exceeded',
            AIErrorCode.CONTEXT_LENGTH_EXCEEDED,
            this.providerType
          );
        }
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
