// =============================================================================
// AI Service - Frontend API Client
// =============================================================================

import apiClient from './api';
import { ApiResponse } from '../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AIProviderType = 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'custom';

export interface AIProviderInfo {
  type: AIProviderType;
  name: string;
  configured: boolean;
}

export interface AIProviderStatus {
  provider: AIProviderType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  lastChecked: string;
  error?: string;
  modelAvailable?: boolean;
}

export interface AIServiceStatus {
  enabled: boolean;
  activeProvider: AIProviderType | null;
  providers: Record<AIProviderType, AIProviderStatus>;
  cacheStats: {
    hits: number;
    misses: number;
    size: number;
  };
  features: {
    summarization: boolean;
    scoringAssist: boolean;
    anomalyDetection: boolean;
    similarity: boolean;
  };
  usage: {
    requestCount: number;
    tokenCount: number;
    cacheHitRate: number;
    sinceTime: string;
  };
}

export interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  confidence: number;
  processingTimeMs: number;
}

export interface SuggestedScore {
  criterionId: string;
  suggestedScore: number;
  reasoning: string;
  confidence: number;
  relevantExcerpts: string[];
}

export interface ScoreAssistResponse {
  suggestions: SuggestedScore[];
  overallAssessment: string;
  strengthsIdentified: string[];
  weaknessesIdentified: string[];
  processingTimeMs: number;
}

export interface ScoringAnomaly {
  type: 'high_variance' | 'outlier_assessor' | 'score_clustering' | 'pattern_deviation';
  severity: 'low' | 'medium' | 'high';
  applicationId: string;
  assessorIds?: string[];
  criterionId?: string;
  description: string;
  evidence: {
    expectedRange?: [number, number];
    actualValue?: number;
    variance?: number;
    zscore?: number;
  };
  recommendation: string;
}

export interface AnomalyDetectionResponse {
  anomalies: ScoringAnomaly[];
  summary: {
    totalApplicationsAnalyzed: number;
    anomaliesFound: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  };
  processingTimeMs: number;
}

export interface SimilarApplication {
  applicationId: string;
  referenceNumber: string;
  applicantName: string;
  similarity: number;
  sharedThemes: string[];
  callId: string;
  callName: string;
}

export interface SimilaritySearchResponse {
  query: {
    applicationId?: string;
    contentPreview?: string;
  };
  results: SimilarApplication[];
  processingTimeMs: number;
}

export interface IndexStats {
  totalApplications: number;
  callBreakdown: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

export interface IndexResult {
  indexed: number;
  failed: number;
  errors: string[];
}

// -----------------------------------------------------------------------------
// API Client Functions
// -----------------------------------------------------------------------------

export const aiApi = {
  /**
   * Get AI service status
   */
  getStatus: async (): Promise<AIServiceStatus> => {
    const response = await apiClient.get<ApiResponse<AIServiceStatus>>('/ai/status');
    return response.data.data;
  },

  /**
   * List available AI providers
   */
  getProviders: async (): Promise<{
    providers: AIProviderInfo[];
    activeProvider: AIProviderType | null;
  }> => {
    const response = await apiClient.get<ApiResponse<{
      providers: AIProviderInfo[];
      activeProvider: AIProviderType | null;
    }>>('/ai/providers');
    return response.data.data;
  },

  /**
   * Switch AI provider
   */
  setProvider: async (provider: AIProviderType): Promise<{ activeProvider: AIProviderType }> => {
    const response = await apiClient.post<ApiResponse<{ activeProvider: AIProviderType }>>(
      '/ai/provider',
      { provider }
    );
    return response.data.data;
  },

  /**
   * Generate application summary
   */
  summarize: async (
    applicationId: string,
    options?: {
      maxLength?: number;
      focusAreas?: string[];
    }
  ): Promise<SummaryResponse> => {
    const response = await apiClient.post<ApiResponse<SummaryResponse>>(
      `/ai/summarize/${applicationId}`,
      options
    );
    return response.data.data;
  },

  /**
   * Get scoring assistance
   */
  getScoringAssist: async (applicationId: string): Promise<ScoreAssistResponse> => {
    const response = await apiClient.post<ApiResponse<ScoreAssistResponse>>(
      `/ai/scoring-assist/${applicationId}`
    );
    return response.data.data;
  },

  /**
   * Detect scoring anomalies
   */
  detectAnomalies: async (
    callId: string,
    threshold?: number
  ): Promise<AnomalyDetectionResponse> => {
    const response = await apiClient.post<ApiResponse<AnomalyDetectionResponse>>(
      `/ai/anomalies/${callId}`,
      { threshold }
    );
    return response.data.data;
  },

  /**
   * Find similar applications
   */
  findSimilar: async (
    applicationId: string,
    options?: {
      topK?: number;
      minSimilarity?: number;
      callId?: string;
    }
  ): Promise<SimilaritySearchResponse> => {
    const response = await apiClient.post<ApiResponse<SimilaritySearchResponse>>(
      `/ai/similar/${applicationId}`,
      options
    );
    return response.data.data;
  },

  /**
   * Index applications for a funding call
   */
  indexCall: async (callId: string): Promise<IndexResult> => {
    const response = await apiClient.post<ApiResponse<IndexResult>>(
      `/ai/index/${callId}`
    );
    return response.data.data;
  },

  /**
   * Get similarity index statistics
   */
  getIndexStats: async (): Promise<IndexStats> => {
    const response = await apiClient.get<ApiResponse<IndexStats>>('/ai/index/stats');
    return response.data.data;
  },

  /**
   * Generate text (admin only)
   */
  generate: async (
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<{ text: string }> => {
    const response = await apiClient.post<ApiResponse<{ text: string }>>(
      '/ai/generate',
      { prompt, ...options }
    );
    return response.data.data;
  },
};

export default aiApi;
