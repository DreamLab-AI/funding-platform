// =============================================================================
// useAI Hook - AI Feature State Management
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  aiApi,
  AIServiceStatus,
  AIProviderType,
  AIProviderInfo,
  SummaryResponse,
  ScoreAssistResponse,
  AnomalyDetectionResponse,
  SimilaritySearchResponse,
  IndexResult,
  IndexStats,
} from '../services/ai';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AIState {
  status: AIServiceStatus | null;
  providers: AIProviderInfo[];
  activeProvider: AIProviderType | null;
  isLoading: boolean;
  error: string | null;
}

interface UseAIReturn extends AIState {
  refreshStatus: () => Promise<void>;
  setProvider: (provider: AIProviderType) => Promise<void>;
  isFeatureEnabled: (feature: keyof AIServiceStatus['features']) => boolean;
  clearError: () => void;
}

interface SummarizeState {
  summary: SummaryResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseSummarizeReturn extends SummarizeState {
  summarize: (
    applicationId: string,
    options?: { maxLength?: number; focusAreas?: string[] }
  ) => Promise<SummaryResponse | null>;
  clearSummary: () => void;
}

interface ScoreAssistState {
  suggestions: ScoreAssistResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseScoreAssistReturn extends ScoreAssistState {
  getSuggestions: (applicationId: string) => Promise<ScoreAssistResponse | null>;
  clearSuggestions: () => void;
}

interface AnomalyState {
  anomalies: AnomalyDetectionResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseAnomalyReturn extends AnomalyState {
  detectAnomalies: (callId: string, threshold?: number) => Promise<AnomalyDetectionResponse | null>;
  clearAnomalies: () => void;
}

interface SimilarityState {
  results: SimilaritySearchResponse | null;
  indexStats: IndexStats | null;
  isLoading: boolean;
  isIndexing: boolean;
  error: string | null;
}

interface UseSimilarityReturn extends SimilarityState {
  findSimilar: (
    applicationId: string,
    options?: { topK?: number; minSimilarity?: number; callId?: string }
  ) => Promise<SimilaritySearchResponse | null>;
  indexCall: (callId: string) => Promise<IndexResult | null>;
  refreshIndexStats: () => Promise<void>;
  clearResults: () => void;
}

// -----------------------------------------------------------------------------
// Main AI Hook
// -----------------------------------------------------------------------------

export function useAI(): UseAIReturn {
  const [state, setState] = useState<AIState>({
    status: null,
    providers: [],
    activeProvider: null,
    isLoading: true,
    error: null,
  });

  const refreshStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [status, providersData] = await Promise.all([
        aiApi.getStatus(),
        aiApi.getProviders(),
      ]);

      setState({
        status,
        providers: providersData.providers,
        activeProvider: providersData.activeProvider,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch AI status';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  const setProvider = useCallback(async (provider: AIProviderType) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await aiApi.setProvider(provider);
      setState((prev) => ({
        ...prev,
        activeProvider: result.activeProvider,
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set provider';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw err;
    }
  }, []);

  const isFeatureEnabled = useCallback(
    (feature: keyof AIServiceStatus['features']): boolean => {
      return state.status?.enabled === true && state.status?.features[feature] === true;
    },
    [state.status]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Initial load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    ...state,
    refreshStatus,
    setProvider,
    isFeatureEnabled,
    clearError,
  };
}

// -----------------------------------------------------------------------------
// Summarization Hook
// -----------------------------------------------------------------------------

export function useSummarize(): UseSummarizeReturn {
  const [state, setState] = useState<SummarizeState>({
    summary: null,
    isLoading: false,
    error: null,
  });

  const summarize = useCallback(
    async (
      applicationId: string,
      options?: { maxLength?: number; focusAreas?: string[] }
    ): Promise<SummaryResponse | null> => {
      setState({ summary: null, isLoading: true, error: null });

      try {
        const result = await aiApi.summarize(applicationId, options);
        setState({ summary: result, isLoading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate summary';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return null;
      }
    },
    []
  );

  const clearSummary = useCallback(() => {
    setState({ summary: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    summarize,
    clearSummary,
  };
}

// -----------------------------------------------------------------------------
// Score Assist Hook
// -----------------------------------------------------------------------------

export function useScoreAssist(): UseScoreAssistReturn {
  const [state, setState] = useState<ScoreAssistState>({
    suggestions: null,
    isLoading: false,
    error: null,
  });

  const getSuggestions = useCallback(
    async (applicationId: string): Promise<ScoreAssistResponse | null> => {
      setState({ suggestions: null, isLoading: true, error: null });

      try {
        const result = await aiApi.getScoringAssist(applicationId);
        setState({ suggestions: result, isLoading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get scoring suggestions';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return null;
      }
    },
    []
  );

  const clearSuggestions = useCallback(() => {
    setState({ suggestions: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    getSuggestions,
    clearSuggestions,
  };
}

// -----------------------------------------------------------------------------
// Anomaly Detection Hook
// -----------------------------------------------------------------------------

export function useAnomalyDetection(): UseAnomalyReturn {
  const [state, setState] = useState<AnomalyState>({
    anomalies: null,
    isLoading: false,
    error: null,
  });

  const detectAnomalies = useCallback(
    async (callId: string, threshold?: number): Promise<AnomalyDetectionResponse | null> => {
      setState({ anomalies: null, isLoading: true, error: null });

      try {
        const result = await aiApi.detectAnomalies(callId, threshold);
        setState({ anomalies: result, isLoading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to detect anomalies';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return null;
      }
    },
    []
  );

  const clearAnomalies = useCallback(() => {
    setState({ anomalies: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    detectAnomalies,
    clearAnomalies,
  };
}

// -----------------------------------------------------------------------------
// Similarity Search Hook
// -----------------------------------------------------------------------------

export function useSimilaritySearch(): UseSimilarityReturn {
  const [state, setState] = useState<SimilarityState>({
    results: null,
    indexStats: null,
    isLoading: false,
    isIndexing: false,
    error: null,
  });

  const findSimilar = useCallback(
    async (
      applicationId: string,
      options?: { topK?: number; minSimilarity?: number; callId?: string }
    ): Promise<SimilaritySearchResponse | null> => {
      setState((prev) => ({ ...prev, results: null, isLoading: true, error: null }));

      try {
        const result = await aiApi.findSimilar(applicationId, options);
        setState((prev) => ({ ...prev, results: result, isLoading: false }));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to find similar applications';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return null;
      }
    },
    []
  );

  const indexCall = useCallback(
    async (callId: string): Promise<IndexResult | null> => {
      setState((prev) => ({ ...prev, isIndexing: true, error: null }));

      try {
        const result = await aiApi.indexCall(callId);
        setState((prev) => ({ ...prev, isIndexing: false }));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to index applications';
        setState((prev) => ({ ...prev, isIndexing: false, error: message }));
        return null;
      }
    },
    []
  );

  const refreshIndexStats = useCallback(async () => {
    try {
      const stats = await aiApi.getIndexStats();
      setState((prev) => ({ ...prev, indexStats: stats }));
    } catch {
      // Silent fail for stats
    }
  }, []);

  const clearResults = useCallback(() => {
    setState((prev) => ({ ...prev, results: null, error: null }));
  }, []);

  return {
    ...state,
    findSimilar,
    indexCall,
    refreshIndexStats,
    clearResults,
  };
}
