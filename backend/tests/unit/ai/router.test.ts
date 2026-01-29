/**
 * AI Router Unit Tests
 * Tests for provider routing logic, health checks, and configuration management
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create individual mock functions for each provider
const mockOpenAIIsConfigured = jest.fn().mockReturnValue(true);
const mockAnthropicIsConfigured = jest.fn().mockReturnValue(true);
const mockOllamaIsConfigured = jest.fn().mockReturnValue(false);
const mockLMStudioIsConfigured = jest.fn().mockReturnValue(false);
const mockCustomIsConfigured = jest.fn().mockReturnValue(false);

const mockComplete = jest.fn();
const mockCompleteStream = jest.fn();
const mockEmbed = jest.fn();
const mockHealthCheck = jest.fn();
const mockUpdateConfig = jest.fn();

jest.mock('../../../src/ai/providers', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    providerType: 'openai',
    displayName: 'OpenAI',
    isConfigured: mockOpenAIIsConfigured,
    complete: mockComplete,
    completeStream: mockCompleteStream,
    embed: mockEmbed,
    healthCheck: mockHealthCheck,
    updateConfig: mockUpdateConfig,
  })),
  AnthropicProvider: jest.fn().mockImplementation(() => ({
    providerType: 'anthropic',
    displayName: 'Anthropic Claude',
    isConfigured: mockAnthropicIsConfigured,
    complete: mockComplete,
    completeStream: mockCompleteStream,
    embed: mockEmbed,
    healthCheck: mockHealthCheck,
    updateConfig: mockUpdateConfig,
  })),
  OllamaProvider: jest.fn().mockImplementation(() => ({
    providerType: 'ollama',
    displayName: 'Ollama (Local)',
    isConfigured: mockOllamaIsConfigured,
    complete: mockComplete,
    completeStream: mockCompleteStream,
    embed: mockEmbed,
    healthCheck: mockHealthCheck,
    updateConfig: mockUpdateConfig,
  })),
  LMStudioProvider: jest.fn().mockImplementation(() => ({
    providerType: 'lmstudio',
    displayName: 'LM Studio (Local)',
    isConfigured: mockLMStudioIsConfigured,
    complete: mockComplete,
    completeStream: mockCompleteStream,
    embed: mockEmbed,
    healthCheck: mockHealthCheck,
    updateConfig: mockUpdateConfig,
  })),
  CustomProvider: jest.fn().mockImplementation(() => ({
    providerType: 'custom',
    displayName: 'Custom Endpoint',
    isConfigured: mockCustomIsConfigured,
    complete: mockComplete,
    completeStream: mockCompleteStream,
    embed: mockEmbed,
    healthCheck: mockHealthCheck,
    updateConfig: mockUpdateConfig,
  })),
}));

import { AIRouter, getAIRouter, resetAIRouter } from '../../../src/ai/router';
import { AIConfigOptions, AIErrorCode, AIServiceError } from '../../../src/ai/types';

const createTestConfig = (overrides: Partial<AIConfigOptions> = {}): AIConfigOptions => ({
  enabled: true,
  defaultProvider: 'openai',
  providers: {
    openai: {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
    },
    anthropic: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: 'test-key',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
    },
    ollama: {
      provider: 'ollama',
      model: 'llama2',
      endpoint: 'http://localhost:11434',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
    },
    lmstudio: {
      provider: 'lmstudio',
      model: 'local-model',
      endpoint: 'http://localhost:1234',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
    },
    custom: {
      provider: 'custom',
      model: 'custom-model',
      endpoint: 'http://custom-endpoint',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
    },
  },
  cache: {
    enabled: true,
    ttlSeconds: 3600,
    maxEntries: 1000,
  },
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  },
  features: {
    summarization: true,
    scoringAssist: true,
    anomalyDetection: true,
    similarity: true,
  },
  ...overrides,
});

describe('AIRouter', () => {
  let router: AIRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAIRouter();

    // Reset mock return values to defaults
    mockOpenAIIsConfigured.mockReturnValue(true);
    mockAnthropicIsConfigured.mockReturnValue(true);
    mockOllamaIsConfigured.mockReturnValue(false);
    mockLMStudioIsConfigured.mockReturnValue(false);
    mockCustomIsConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    resetAIRouter();
    jest.useRealTimers();
  });

  describe('constructor and initialization', () => {
    it('should initialize with configured providers', () => {
      router = new AIRouter(createTestConfig());

      expect(router.isEnabled()).toBe(true);
      expect(router.getActiveProviderType()).toBe('openai');
    });

    it('should not initialize providers when disabled', () => {
      router = new AIRouter(createTestConfig({ enabled: false }));

      expect(router.isEnabled()).toBe(false);
      expect(router.getActiveProviderType()).toBeNull();
    });

    it('should auto-select first available provider if default not available', () => {
      const config = createTestConfig({ defaultProvider: 'custom' });
      router = new AIRouter(config);

      // Since OpenAI is configured and custom is not, it should select OpenAI
      expect(router.getActiveProviderType()).not.toBeNull();
    });

    it('should set active provider from config default', () => {
      router = new AIRouter(createTestConfig({ defaultProvider: 'anthropic' }));

      expect(router.getActiveProviderType()).toBe('anthropic');
    });
  });

  describe('getActiveProvider', () => {
    it('should return the active provider', () => {
      router = new AIRouter(createTestConfig());

      const provider = router.getActiveProvider();

      expect(provider).toBeDefined();
      expect(provider.displayName).toBe('OpenAI');
    });

    it('should throw when service is disabled', () => {
      router = new AIRouter(createTestConfig({ enabled: false }));

      expect(() => router.getActiveProvider()).toThrow(AIServiceError);
      expect(() => router.getActiveProvider()).toThrow('AI service is disabled');
    });

    it('should throw when no provider is configured', () => {
      // Create a router with no configured providers
      mockOpenAIIsConfigured.mockReturnValue(false);
      mockAnthropicIsConfigured.mockReturnValue(false);

      const config = createTestConfig({ enabled: true });
      router = new AIRouter(config);

      expect(() => router.getActiveProvider()).toThrow('No AI provider configured');
    });
  });

  describe('setActiveProvider', () => {
    beforeEach(() => {
      router = new AIRouter(createTestConfig());
    });

    it('should switch to a configured provider', () => {
      router.setActiveProvider('anthropic');

      expect(router.getActiveProviderType()).toBe('anthropic');
    });

    it('should throw for unconfigured provider', () => {
      expect(() => router.setActiveProvider('ollama')).toThrow(AIServiceError);
      expect(() => router.setActiveProvider('ollama')).toThrow(
        'Provider ollama is not configured'
      );
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      router = new AIRouter(createTestConfig());
    });

    it('should return specific provider by type', () => {
      const provider = router.getProvider('openai');

      expect(provider).toBeDefined();
    });

    it('should return undefined for unconfigured provider', () => {
      const provider = router.getProvider('ollama');

      expect(provider).toBeUndefined();
    });
  });

  describe('listProviders', () => {
    beforeEach(() => {
      router = new AIRouter(createTestConfig());
    });

    it('should list all provider types with configuration status', () => {
      const providers = router.listProviders();

      expect(providers).toHaveLength(5);
      expect(providers.find(p => p.type === 'openai')?.configured).toBe(true);
      expect(providers.find(p => p.type === 'anthropic')?.configured).toBe(true);
      expect(providers.find(p => p.type === 'ollama')?.configured).toBe(false);
    });

    it('should include display names', () => {
      const providers = router.listProviders();

      expect(providers.find(p => p.type === 'openai')?.name).toBe('OpenAI');
      expect(providers.find(p => p.type === 'anthropic')?.name).toBe('Anthropic Claude');
    });
  });

  describe('health checks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      router = new AIRouter(createTestConfig());
    });

    it('should check health of active provider', async () => {
      const mockHealthResult = {
        provider: 'openai',
        status: 'healthy',
        lastChecked: new Date(),
        latencyMs: 100,
      };

      const provider = router.getActiveProvider();
      (provider.healthCheck as jest.Mock).mockResolvedValue(mockHealthResult);

      const result = await router.healthCheck();

      expect(result).toEqual(mockHealthResult);
    });

    it('should return unhealthy status when no provider configured', async () => {
      mockOpenAIIsConfigured.mockReturnValue(false);
      mockAnthropicIsConfigured.mockReturnValue(false);

      const config = createTestConfig({ enabled: true });
      router = new AIRouter(config);
      const result = await router.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('No provider configured');
    });

    it('should check health of all providers', async () => {
      const mockHealthResult = {
        provider: 'openai',
        status: 'healthy',
        lastChecked: new Date(),
      };

      const provider = router.getActiveProvider();
      (provider.healthCheck as jest.Mock).mockResolvedValue(mockHealthResult);

      const results = await router.healthCheckAll();

      expect(results.openai).toBeDefined();
    });

    it('should handle health check errors gracefully', async () => {
      const provider = router.getActiveProvider();
      (provider.healthCheck as jest.Mock).mockRejectedValue(new Error('Network error'));

      const results = await router.healthCheckAll();

      expect(results.openai.status).toBe('unhealthy');
      expect(results.openai.error).toBe('Network error');
    });

    it('should start periodic health checks', () => {
      router.startHealthChecks(5000);

      // Should not throw
      expect(() => jest.advanceTimersByTime(5000)).not.toThrow();
    });

    it('should stop health checks', () => {
      router.startHealthChecks(5000);
      router.stopHealthChecks();

      // Should not throw
      expect(() => jest.advanceTimersByTime(10000)).not.toThrow();
    });

    it('should not start duplicate health check intervals', () => {
      router.startHealthChecks(5000);
      router.startHealthChecks(5000); // Should be ignored

      // Should only run one check
      router.stopHealthChecks();
    });
  });

  describe('configuration management', () => {
    beforeEach(() => {
      router = new AIRouter(createTestConfig());
    });

    it('should return config copy', () => {
      const config = router.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.defaultProvider).toBe('openai');
    });

    it('should update config', () => {
      router.updateConfig({ enabled: false });

      expect(router.isEnabled()).toBe(false);
    });

    it('should reinitialize on enabled status change', () => {
      router.updateConfig({ enabled: false });
      router.updateConfig({ enabled: true });

      // Provider should be reinitialized
      expect(router.getActiveProviderType()).not.toBeNull();
    });

    it('should update default provider', () => {
      router.updateConfig({ defaultProvider: 'anthropic' });

      expect(router.getActiveProviderType()).toBe('anthropic');
    });

    it('should update provider configuration', () => {
      router.updateProviderConfig('openai', { model: 'gpt-4-turbo' });

      const provider = router.getProvider('openai');
      expect(provider?.updateConfig).toHaveBeenCalledWith({ model: 'gpt-4-turbo' });
    });

    it('should create new provider if not exists', () => {
      // First reset the ollama mock to return configured
      mockOllamaIsConfigured.mockReturnValue(true);

      router.updateProviderConfig('ollama', {
        model: 'llama3',
        endpoint: 'http://localhost:11434',
      });

      // Provider should be created
      const { OllamaProvider } = require('../../../src/ai/providers');
      expect(OllamaProvider).toHaveBeenCalled();
    });
  });

  describe('feature management', () => {
    beforeEach(() => {
      router = new AIRouter(createTestConfig());
    });

    it('should return feature status', () => {
      const features = router.getFeatureStatus();

      expect(features.summarization).toBe(true);
      expect(features.scoringAssist).toBe(true);
      expect(features.anomalyDetection).toBe(true);
      expect(features.similarity).toBe(true);
    });

    it('should check specific feature enablement', () => {
      expect(router.isFeatureEnabled('summarization')).toBe(true);
      expect(router.isFeatureEnabled('scoringAssist')).toBe(true);
    });

    it('should return false for features when service disabled', () => {
      router = new AIRouter(createTestConfig({ enabled: false }));

      expect(router.isFeatureEnabled('summarization')).toBe(false);
    });

    it('should return false for disabled features', () => {
      const config = createTestConfig();
      config.features.summarization = false;
      router = new AIRouter(config);

      expect(router.isFeatureEnabled('summarization')).toBe(false);
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance with getAIRouter', () => {
      const router1 = getAIRouter(createTestConfig());
      const router2 = getAIRouter();

      expect(router1).toBe(router2);
    });

    it('should throw without initial config', () => {
      expect(() => getAIRouter()).toThrow(
        'AI Router not initialized. Provide config on first call.'
      );
    });

    it('should create new instance after reset', () => {
      const router1 = getAIRouter(createTestConfig());
      resetAIRouter();
      const router2 = getAIRouter(createTestConfig());

      expect(router1).not.toBe(router2);
    });
  });

  describe('error handling', () => {
    it('should handle provider initialization failures gracefully', () => {
      const { OpenAIProvider } = require('../../../src/ai/providers');
      OpenAIProvider.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      // Should not throw, just log warning
      expect(() => new AIRouter(createTestConfig())).not.toThrow();
    });
  });
});
