// =============================================================================
// AI Provider Router - Route Requests to Configured Provider
// =============================================================================

import {
  AIProviderType,
  AIProviderConfig,
  AIConfigOptions,
  AIHealthStatus,
  AIServiceError,
  AIErrorCode,
} from './types';
import { AIProvider } from './provider.interface';
import {
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  LMStudioProvider,
  CustomProvider,
} from './providers';
import { logger } from '../utils/logger';

/**
 * AI Provider Router - Manages provider instances and routes requests
 */
export class AIRouter {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private activeProvider: AIProviderType | null = null;
  private config: AIConfigOptions;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: AIConfigOptions) {
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private initializeProviders(): void {
    if (!this.config.enabled) {
      logger.info('AI service is disabled');
      return;
    }

    const providerTypes: AIProviderType[] = [
      'openai',
      'anthropic',
      'ollama',
      'lmstudio',
      'custom',
    ];

    for (const providerType of providerTypes) {
      const providerConfig = this.config.providers[providerType];
      if (providerConfig) {
        try {
          const provider = this.createProvider(providerType, providerConfig);
          if (provider.isConfigured()) {
            this.providers.set(providerType, provider);
            logger.info(`Initialized AI provider: ${provider.displayName}`);
          }
        } catch (error) {
          logger.warn(`Failed to initialize provider ${providerType}`, { error });
        }
      }
    }

    // Set active provider
    if (this.config.defaultProvider && this.providers.has(this.config.defaultProvider)) {
      this.activeProvider = this.config.defaultProvider;
      logger.info(`Active AI provider: ${this.config.defaultProvider}`);
    } else if (this.providers.size > 0) {
      this.activeProvider = this.providers.keys().next().value;
      logger.info(`Active AI provider (auto-selected): ${this.activeProvider}`);
    }
  }

  /**
   * Create a provider instance based on type
   */
  private createProvider(
    type: AIProviderType,
    config: AIProviderConfig
  ): AIProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'lmstudio':
        return new LMStudioProvider(config);
      case 'custom':
        return new CustomProvider(config);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Get the currently active provider
   */
  getActiveProvider(): AIProvider {
    if (!this.config.enabled) {
      throw new AIServiceError(
        'AI service is disabled',
        AIErrorCode.FEATURE_DISABLED
      );
    }

    if (!this.activeProvider) {
      throw new AIServiceError(
        'No AI provider configured',
        AIErrorCode.PROVIDER_NOT_CONFIGURED
      );
    }

    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      throw new AIServiceError(
        `Provider ${this.activeProvider} not available`,
        AIErrorCode.PROVIDER_NOT_AVAILABLE,
        this.activeProvider
      );
    }

    return provider;
  }

  /**
   * Get a specific provider by type
   */
  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Set the active provider
   */
  setActiveProvider(type: AIProviderType): void {
    if (!this.providers.has(type)) {
      throw new AIServiceError(
        `Provider ${type} is not configured`,
        AIErrorCode.PROVIDER_NOT_CONFIGURED,
        type
      );
    }
    this.activeProvider = type;
    logger.info(`Switched active AI provider to: ${type}`);
  }

  /**
   * Get the active provider type
   */
  getActiveProviderType(): AIProviderType | null {
    return this.activeProvider;
  }

  /**
   * List all configured providers
   */
  listProviders(): { type: AIProviderType; name: string; configured: boolean }[] {
    const allTypes: AIProviderType[] = [
      'openai',
      'anthropic',
      'ollama',
      'lmstudio',
      'custom',
    ];

    return allTypes.map((type) => {
      const provider = this.providers.get(type);
      return {
        type,
        name: provider?.displayName || this.getProviderDisplayName(type),
        configured: !!provider,
      };
    });
  }

  private getProviderDisplayName(type: AIProviderType): string {
    const names: Record<AIProviderType, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic Claude',
      ollama: 'Ollama (Local)',
      lmstudio: 'LM Studio (Local)',
      custom: 'Custom Endpoint',
    };
    return names[type];
  }

  /**
   * Check if AI service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.providers.size > 0;
  }

  /**
   * Check health of all providers
   */
  async healthCheckAll(): Promise<Record<AIProviderType, AIHealthStatus>> {
    const results: Record<string, AIHealthStatus> = {};

    for (const [type, provider] of this.providers) {
      try {
        results[type] = await provider.healthCheck();
      } catch (error) {
        results[type] = {
          provider: type,
          status: 'unhealthy',
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results as Record<AIProviderType, AIHealthStatus>;
  }

  /**
   * Check health of active provider
   */
  async healthCheck(): Promise<AIHealthStatus> {
    if (!this.activeProvider) {
      return {
        provider: 'custom', // placeholder
        status: 'unhealthy',
        lastChecked: new Date(),
        error: 'No provider configured',
      };
    }

    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      return {
        provider: this.activeProvider,
        status: 'unhealthy',
        lastChecked: new Date(),
        error: 'Provider not available',
      };
    }

    return provider.healthCheck();
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheckAll();
      } catch (error) {
        logger.error('Health check failed', { error });
      }
    }, intervalMs);

    logger.info('Started AI provider health checks', { intervalMs });
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped AI provider health checks');
    }
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(type: AIProviderType, config: Partial<AIProviderConfig>): void {
    const provider = this.providers.get(type);
    if (provider) {
      provider.updateConfig(config);
      logger.info(`Updated configuration for provider: ${type}`);
    } else {
      // Create new provider if not exists
      const fullConfig: AIProviderConfig = {
        provider: type,
        model: config.model || '',
        ...config,
      };
      const newProvider = this.createProvider(type, fullConfig);
      if (newProvider.isConfigured()) {
        this.providers.set(type, newProvider);
        logger.info(`Added new provider: ${type}`);
      }
    }
  }

  /**
   * Get configuration options
   */
  getConfig(): AIConfigOptions {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIConfigOptions>): void {
    this.config = { ...this.config, ...updates };

    // Reinitialize if enabled status changed
    if ('enabled' in updates) {
      this.providers.clear();
      this.activeProvider = null;
      this.initializeProviders();
    }

    // Update default provider
    if (updates.defaultProvider && this.providers.has(updates.defaultProvider)) {
      this.activeProvider = updates.defaultProvider;
    }
  }

  /**
   * Get feature availability
   */
  getFeatureStatus(): AIConfigOptions['features'] {
    return { ...this.config.features };
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: keyof AIConfigOptions['features']): boolean {
    return this.config.enabled && this.config.features[feature];
  }
}

// Singleton instance
let routerInstance: AIRouter | null = null;

/**
 * Get or create the AI router singleton
 */
export function getAIRouter(config?: AIConfigOptions): AIRouter {
  if (!routerInstance && config) {
    routerInstance = new AIRouter(config);
  }
  if (!routerInstance) {
    throw new Error('AI Router not initialized. Provide config on first call.');
  }
  return routerInstance;
}

/**
 * Reset the router instance (for testing)
 */
export function resetAIRouter(): void {
  if (routerInstance) {
    routerInstance.stopHealthChecks();
    routerInstance = null;
  }
}
