// =============================================================================
// AISettings - Admin Page for AI Configuration
// =============================================================================

import { useState, useEffect } from 'react';
import { useAI } from '../../hooks/useAI';
import { AIProviderType, AIProviderInfo, AIServiceStatus } from '../../services/ai';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

interface ProviderCardProps {
  provider: AIProviderInfo;
  status?: AIServiceStatus['providers'][AIProviderType];
  isActive: boolean;
  onSelect: () => void;
}

function ProviderCard({ provider, status, isActive, onSelect }: ProviderCardProps) {
  const getStatusBadge = () => {
    if (!status) return null;

    const colors = {
      healthy: 'bg-green-100 text-green-800',
      degraded: 'bg-yellow-100 text-yellow-800',
      unhealthy: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status.status]}`}>
        {status.status}
      </span>
    );
  };

  const getProviderIcon = (type: AIProviderType) => {
    switch (type) {
      case 'openai':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681v6.722zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
        );
      case 'anthropic':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.604 3.312l-5.299 17.376h-2.906l5.299-17.376h2.906zm-7.703 0l-5.299 17.376h-2.906l5.299-17.376h2.906z" />
          </svg>
        );
      case 'ollama':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'lmstudio':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'custom':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isActive
          ? 'border-blue-500 bg-blue-50'
          : provider.configured
          ? 'border-gray-200 hover:border-gray-300 bg-white'
          : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
      onClick={provider.configured ? onSelect : undefined}
    >
      {isActive && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
          Active
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`text-gray-${provider.configured ? '700' : '400'}`}>
          {getProviderIcon(provider.type)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{provider.name}</h4>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500">
            {provider.configured ? (
              <>
                {status?.latencyMs && (
                  <span className="mr-2">Latency: {status.latencyMs}ms</span>
                )}
                {status?.modelAvailable !== undefined && (
                  <span>Model: {status.modelAvailable ? 'Available' : 'Not found'}</span>
                )}
              </>
            ) : (
              'Not configured'
            )}
          </p>
          {status?.error && (
            <p className="text-xs text-red-600 mt-1">{status.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AISettings() {
  const {
    status,
    providers,
    activeProvider,
    isLoading,
    error,
    refreshStatus,
    setProvider,
    isFeatureEnabled,
    clearError,
  } = useAI();

  const [switching, setSwitching] = useState(false);

  const handleProviderSelect = async (providerType: AIProviderType) => {
    if (providerType === activeProvider) return;

    setSwitching(true);
    try {
      await setProvider(providerType);
      await refreshStatus();
    } catch {
      // Error handled by hook
    } finally {
      setSwitching(false);
    }
  };

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
          <p className="text-gray-500">Configure AI provider and features</p>
        </div>
        <button
          onClick={refreshStatus}
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={clearError}
            className="text-sm text-red-700 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Service Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h2>

        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-4 h-4 rounded-full ${
              status?.enabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <span className="text-gray-700">
            AI Service: {status?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {status.usage.requestCount}
              </div>
              <div className="text-xs text-gray-500">Requests</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {status.usage.tokenCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Tokens</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {status.usage.cacheHitRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Cache Hit Rate</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {status.cacheStats.size}
              </div>
              <div className="text-xs text-gray-500">Cached Responses</div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Provider</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select the AI provider to use for all AI features. Configure API keys in environment
          variables.
        </p>

        {switching && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            Switching provider...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              status={status?.providers[provider.type]}
              isActive={provider.type === activeProvider}
              onSelect={() => handleProviderSelect(provider.type)}
            />
          ))}
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>
        <p className="text-sm text-gray-500 mb-4">
          AI features can be enabled/disabled via environment variables.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              key: 'summarization' as const,
              name: 'Summarization',
              description: 'Generate summaries of applications',
            },
            {
              key: 'scoringAssist' as const,
              name: 'Scoring Assistance',
              description: 'AI-suggested scores for assessors',
            },
            {
              key: 'anomalyDetection' as const,
              name: 'Anomaly Detection',
              description: 'Detect scoring anomalies and outliers',
            },
            {
              key: 'similarity' as const,
              name: 'Similarity Search',
              description: 'Find similar applications',
            },
          ].map((feature) => (
            <div
              key={feature.key}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                isFeatureEnabled(feature.key)
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div>
                <h4 className="font-medium text-gray-900">{feature.name}</h4>
                <p className="text-xs text-gray-500">{feature.description}</p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  isFeatureEnabled(feature.key) ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Help */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
        <p className="text-sm text-gray-600 mb-4">
          Set the following environment variables to configure AI providers:
        </p>

        <div className="space-y-4 font-mono text-sm">
          <div>
            <h4 className="font-bold text-gray-700 mb-1">OpenAI</h4>
            <code className="block bg-white p-2 rounded border text-gray-600">
              AI_OPENAI_API_KEY=sk-...
              <br />
              AI_OPENAI_MODEL=gpt-4o
            </code>
          </div>
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Anthropic</h4>
            <code className="block bg-white p-2 rounded border text-gray-600">
              AI_ANTHROPIC_API_KEY=sk-ant-...
              <br />
              AI_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
            </code>
          </div>
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Ollama (Local)</h4>
            <code className="block bg-white p-2 rounded border text-gray-600">
              AI_OLLAMA_ENDPOINT=http://localhost:11434
              <br />
              AI_OLLAMA_MODEL=llama2
            </code>
          </div>
          <div>
            <h4 className="font-bold text-gray-700 mb-1">Custom Endpoint</h4>
            <code className="block bg-white p-2 rounded border text-gray-600">
              AI_CUSTOM_ENDPOINT=http://localhost:8000/v1
              <br />
              AI_CUSTOM_MODEL=my-model
              <br />
              AI_CUSTOM_API_KEY=optional-key
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AISettings;
