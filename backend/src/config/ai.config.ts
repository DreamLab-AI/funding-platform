// =============================================================================
// AI Configuration - Model-Agnostic AI Provider Settings
// =============================================================================

import { AIConfigOptions, AIProviderType, AIProviderConfig } from '../ai/types';

/**
 * Get environment variable with optional default
 */
const getEnv = (key: string, defaultValue?: string): string => {
  return process.env[key] || defaultValue || '';
};

/**
 * Get environment variable as boolean
 */
const getEnvBool = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

/**
 * Get environment variable as number
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Get environment variable as float
 */
const getEnvFloat = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Build provider configuration from environment variables
 */
function buildProviderConfig(provider: AIProviderType): AIProviderConfig {
  const prefix = `AI_${provider.toUpperCase()}`;

  const config: AIProviderConfig = {
    provider,
    model: getEnv(`${prefix}_MODEL`, getDefaultModel(provider)),
    endpoint: getEnv(`${prefix}_ENDPOINT`),
    apiKey: getEnv(`${prefix}_API_KEY`),
    maxTokens: getEnvNumber(`${prefix}_MAX_TOKENS`, 4096),
    temperature: getEnvFloat(`${prefix}_TEMPERATURE`, 0.7),
    timeout: getEnvNumber(`${prefix}_TIMEOUT`, 60000),
  };

  // Add custom headers if specified
  const headersJson = getEnv(`${prefix}_HEADERS`);
  if (headersJson) {
    try {
      config.headers = JSON.parse(headersJson);
    } catch {
      // Ignore invalid JSON
    }
  }

  return config;
}

/**
 * Get default model for each provider
 */
function getDefaultModel(provider: AIProviderType): string {
  const defaults: Record<AIProviderType, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    ollama: 'llama2',
    lmstudio: 'local-model',
    custom: 'default',
  };
  return defaults[provider];
}

/**
 * Determine the default provider based on available configuration
 */
function determineDefaultProvider(): AIProviderType {
  // Check environment variable first
  const explicitDefault = getEnv('AI_DEFAULT_PROVIDER') as AIProviderType;
  if (explicitDefault) {
    return explicitDefault;
  }

  // Auto-detect based on available API keys
  if (getEnv('AI_OPENAI_API_KEY') || getEnv('OPENAI_API_KEY')) {
    return 'openai';
  }
  if (getEnv('AI_ANTHROPIC_API_KEY') || getEnv('ANTHROPIC_API_KEY')) {
    return 'anthropic';
  }
  if (getEnv('AI_CUSTOM_ENDPOINT')) {
    return 'custom';
  }

  // Default to ollama for local inference
  return 'ollama';
}

/**
 * Main AI configuration
 */
export const aiConfig: AIConfigOptions = {
  // Global enable/disable
  enabled: getEnvBool('AI_ENABLED', true),

  // Default provider
  defaultProvider: determineDefaultProvider(),

  // Provider configurations
  providers: {
    openai: {
      ...buildProviderConfig('openai'),
      // Support legacy environment variable names
      apiKey:
        getEnv('AI_OPENAI_API_KEY') ||
        getEnv('OPENAI_API_KEY'),
      endpoint:
        getEnv('AI_OPENAI_ENDPOINT') ||
        getEnv('AZURE_OPENAI_ENDPOINT'),
    },

    anthropic: {
      ...buildProviderConfig('anthropic'),
      // Support legacy environment variable names
      apiKey:
        getEnv('AI_ANTHROPIC_API_KEY') ||
        getEnv('ANTHROPIC_API_KEY'),
    },

    ollama: {
      ...buildProviderConfig('ollama'),
      endpoint: getEnv('AI_OLLAMA_ENDPOINT', 'http://localhost:11434'),
    },

    lmstudio: {
      ...buildProviderConfig('lmstudio'),
      endpoint: getEnv('AI_LMSTUDIO_ENDPOINT', 'http://localhost:1234'),
    },

    custom: {
      ...buildProviderConfig('custom'),
    },
  },

  // Response caching
  cache: {
    enabled: getEnvBool('AI_CACHE_ENABLED', true),
    ttlSeconds: getEnvNumber('AI_CACHE_TTL', 3600), // 1 hour
    maxEntries: getEnvNumber('AI_CACHE_MAX_ENTRIES', 1000),
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: getEnvNumber('AI_RATE_LIMIT_RPM', 60),
    tokensPerMinute: getEnvNumber('AI_RATE_LIMIT_TPM', 100000),
  },

  // Feature flags
  features: {
    summarization: getEnvBool('AI_FEATURE_SUMMARIZATION', true),
    scoringAssist: getEnvBool('AI_FEATURE_SCORING_ASSIST', true),
    anomalyDetection: getEnvBool('AI_FEATURE_ANOMALY_DETECTION', true),
    similarity: getEnvBool('AI_FEATURE_SIMILARITY', true),
  },
};

/**
 * Validate AI configuration at startup
 */
export function validateAIConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!aiConfig.enabled) {
    return { valid: true, warnings: ['AI service is disabled'] };
  }

  const defaultConfig = aiConfig.providers[aiConfig.defaultProvider];

  // Check default provider configuration
  if (!defaultConfig.apiKey && !['ollama', 'lmstudio'].includes(aiConfig.defaultProvider)) {
    warnings.push(
      `No API key configured for default provider: ${aiConfig.defaultProvider}`
    );
  }

  // Check local providers
  if (aiConfig.defaultProvider === 'ollama') {
    warnings.push(
      'Using Ollama for AI. Ensure Ollama is running with: ollama serve'
    );
  }

  if (aiConfig.defaultProvider === 'lmstudio') {
    warnings.push(
      'Using LM Studio for AI. Ensure LM Studio server is running.'
    );
  }

  return { valid: true, warnings };
}

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: AIProviderType): AIProviderConfig {
  return aiConfig.providers[provider];
}

/**
 * Update provider configuration at runtime
 */
export function updateProviderConfig(
  provider: AIProviderType,
  updates: Partial<AIProviderConfig>
): void {
  aiConfig.providers[provider] = {
    ...aiConfig.providers[provider],
    ...updates,
  };
}

/**
 * Update feature flags at runtime
 */
export function updateFeatureFlags(
  updates: Partial<AIConfigOptions['features']>
): void {
  Object.assign(aiConfig.features, updates);
}

export default aiConfig;
