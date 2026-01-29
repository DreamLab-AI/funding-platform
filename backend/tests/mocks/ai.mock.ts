/**
 * AI Provider Mocks
 * Mock utilities for OpenAI, Anthropic, and other AI providers
 */

export interface MockChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MockChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MockChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockEmbedding {
  object: string;
  embedding: number[];
  index: number;
}

export interface MockEmbeddingResponse {
  object: string;
  data: MockEmbedding[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Create mock OpenAI client
 */
export function createMockOpenAI() {
  const completions: MockChatCompletion[] = [];
  const embeddings: MockEmbeddingResponse[] = [];

  return {
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async (params: {
          model: string;
          messages: MockChatMessage[];
          temperature?: number;
          max_tokens?: number;
        }): Promise<MockChatCompletion> => {
          const completion: MockChatCompletion = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: params.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a mock AI response for testing purposes.',
              },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70,
            },
          };
          completions.push(completion);
          return completion;
        }),
      },
    },

    embeddings: {
      create: jest.fn().mockImplementation(async (params: {
        model: string;
        input: string | string[];
      }): Promise<MockEmbeddingResponse> => {
        const inputs = Array.isArray(params.input) ? params.input : [params.input];
        const response: MockEmbeddingResponse = {
          object: 'list',
          data: inputs.map((_, index) => ({
            object: 'embedding',
            embedding: Array(1536).fill(0).map(() => Math.random() * 2 - 1),
            index,
          })),
          model: params.model,
          usage: {
            prompt_tokens: inputs.length * 10,
            total_tokens: inputs.length * 10,
          },
        };
        embeddings.push(response);
        return response;
      }),
    },

    // Test utilities
    getCompletions: () => [...completions],
    getLastCompletion: () => completions[completions.length - 1] || null,
    getEmbeddings: () => [...embeddings],
    clearHistory: () => {
      completions.length = 0;
      embeddings.length = 0;
    },

    // Response customization
    setNextResponse: (response: string) => {
      return jest.fn().mockResolvedValueOnce({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: response },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      });
    },
  };
}

/**
 * Create mock Anthropic client
 */
export function createMockAnthropic() {
  const messages: any[] = [];

  return {
    messages: {
      create: jest.fn().mockImplementation(async (params: {
        model: string;
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
        system?: string;
      }) => {
        const response = {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'This is a mock Anthropic response for testing purposes.',
          }],
          model: params.model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 50,
            output_tokens: 20,
          },
        };
        messages.push(response);
        return response;
      }),
    },

    completions: {
      create: jest.fn().mockImplementation(async (params: {
        model: string;
        max_tokens_to_sample: number;
        prompt: string;
      }) => {
        return {
          id: `cmpl_${Date.now()}`,
          type: 'completion',
          completion: 'This is a mock Anthropic completion for testing purposes.',
          model: params.model,
          stop_reason: 'stop_sequence',
        };
      }),
    },

    // Test utilities
    getMessages: () => [...messages],
    getLastMessage: () => messages[messages.length - 1] || null,
    clearHistory: () => { messages.length = 0; },
  };
}

/**
 * Create mock Ollama client
 */
export function createMockOllama() {
  return {
    chat: jest.fn().mockImplementation(async (params: {
      model: string;
      messages: MockChatMessage[];
    }) => {
      return {
        model: params.model,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: 'This is a mock Ollama response for testing purposes.',
        },
        done: true,
        total_duration: 1000000000,
        load_duration: 100000000,
        prompt_eval_count: 50,
        eval_count: 20,
      };
    }),

    generate: jest.fn().mockImplementation(async (params: {
      model: string;
      prompt: string;
    }) => {
      return {
        model: params.model,
        created_at: new Date().toISOString(),
        response: 'This is a mock Ollama generation for testing purposes.',
        done: true,
      };
    }),

    embeddings: jest.fn().mockImplementation(async (params: {
      model: string;
      prompt: string;
    }) => {
      return {
        embedding: Array(4096).fill(0).map(() => Math.random() * 2 - 1),
      };
    }),

    list: jest.fn().mockResolvedValue({
      models: [
        { name: 'llama2', modified_at: new Date().toISOString(), size: 1000000000 },
        { name: 'codellama', modified_at: new Date().toISOString(), size: 2000000000 },
      ],
    }),
  };
}

/**
 * Create mock LM Studio client
 */
export function createMockLMStudio() {
  return {
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async (params: {
          model: string;
          messages: MockChatMessage[];
        }): Promise<MockChatCompletion> => {
          return {
            id: `lmstudio-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: params.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a mock LM Studio response for testing purposes.',
              },
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70,
            },
          };
        }),
      },
    },

    models: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'local-model-1', object: 'model', created: Date.now() },
          { id: 'local-model-2', object: 'model', created: Date.now() },
        ],
      }),
    },
  };
}

/**
 * Create mock AI service wrapper
 */
export function createMockAIService() {
  const calls: Array<{ method: string; params: any; response: any }> = [];

  return {
    summarize: jest.fn().mockImplementation(async (text: string, options?: any) => {
      const response = {
        summary: 'This is a mock summary of the provided text.',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
        wordCount: text.split(' ').length,
      };
      calls.push({ method: 'summarize', params: { text, options }, response });
      return response;
    }),

    score: jest.fn().mockImplementation(async (application: any, criteria: any) => {
      const response = {
        score: 75,
        breakdown: {
          innovation: 80,
          feasibility: 70,
          impact: 75,
        },
        justification: 'Mock scoring justification for testing.',
        confidence: 0.85,
      };
      calls.push({ method: 'score', params: { application, criteria }, response });
      return response;
    }),

    detectAnomaly: jest.fn().mockImplementation(async (data: any) => {
      const response = {
        isAnomaly: false,
        anomalyScore: 0.2,
        details: 'No anomalies detected in mock analysis.',
      };
      calls.push({ method: 'detectAnomaly', params: { data }, response });
      return response;
    }),

    calculateSimilarity: jest.fn().mockImplementation(async (text1: string, text2: string) => {
      const response = {
        similarity: 0.75,
        matchingConcepts: ['concept1', 'concept2'],
      };
      calls.push({ method: 'calculateSimilarity', params: { text1, text2 }, response });
      return response;
    }),

    generateEmbedding: jest.fn().mockImplementation(async (text: string) => {
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }),

    // Test utilities
    getCalls: () => [...calls],
    getCallsByMethod: (method: string) => calls.filter(c => c.method === method),
    clearCalls: () => { calls.length = 0; },

    // Error simulation
    simulateError: (method: string, error: Error) => {
      const mock = jest.fn().mockRejectedValue(error);
      return mock;
    },

    simulateTimeout: (method: string, delay: number = 30000) => {
      const mock = jest.fn().mockImplementation(async () => {
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), delay)
        );
      });
      return mock;
    },
  };
}

/**
 * Create mock streaming response
 */
export function createMockStreamingResponse(chunks: string[]) {
  let index = 0;

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index < chunks.length) {
            const chunk = chunks[index++];
            return {
              value: {
                choices: [{
                  delta: { content: chunk },
                  finish_reason: index === chunks.length ? 'stop' : null,
                }],
              },
              done: false,
            };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}

/**
 * Common AI responses for testing
 */
export const mockAIResponses = {
  applicationSummary: {
    summary: 'A research project focusing on sustainable energy solutions.',
    keyPoints: [
      'Novel approach to solar cell efficiency',
      'Collaboration with industry partners',
      'Clear pathway to commercialisation',
    ],
  },

  scoringResult: {
    score: 82,
    breakdown: {
      innovation: 85,
      feasibility: 78,
      impact: 83,
      teamExpertise: 80,
      valueForMoney: 82,
    },
    recommendation: 'Fund',
    confidence: 0.88,
  },

  anomalyDetection: {
    isAnomaly: false,
    anomalyScore: 0.15,
    flaggedItems: [],
  },

  similarityResult: {
    similarity: 0.23,
    isPotentialDuplicate: false,
    matchingApplications: [],
  },
};

export default {
  createMockOpenAI,
  createMockAnthropic,
  createMockOllama,
  createMockLMStudio,
  createMockAIService,
  createMockStreamingResponse,
  mockAIResponses,
};
