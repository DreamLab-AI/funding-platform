// =============================================================================
// AI Service Types - Model-Agnostic Interfaces
// =============================================================================

// -----------------------------------------------------------------------------
// Provider Configuration
// -----------------------------------------------------------------------------

export type AIProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface AIProviderConfig {
  provider: AIProviderType;
  endpoint?: string;
  apiKey?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AIConfigOptions {
  enabled: boolean;
  defaultProvider: AIProviderType;
  providers: Record<AIProviderType, AIProviderConfig>;
  cache: {
    enabled: boolean;
    ttlSeconds: number;
    maxEntries: number;
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    summarization: boolean;
    scoringAssist: boolean;
    anomalyDetection: boolean;
    similarity: boolean;
  };
}

// -----------------------------------------------------------------------------
// Request/Response Types
// -----------------------------------------------------------------------------

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface AICompletionResponse {
  id: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  created: number;
}

export interface AIStreamChunk {
  id: string;
  delta: string;
  finishReason: string | null;
}

// -----------------------------------------------------------------------------
// Embedding Types
// -----------------------------------------------------------------------------

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// -----------------------------------------------------------------------------
// Feature-Specific Types
// -----------------------------------------------------------------------------

// Summarization
export interface SummarizeRequest {
  applicationId: string;
  content: string;
  maxLength?: number;
  focusAreas?: string[];
}

export interface SummarizeResponse {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  confidence: number;
  processingTimeMs: number;
}

// Scoring Assistance
export interface ScoreAssistRequest {
  applicationId: string;
  applicationContent: string;
  criteria: CriterionDefinition[];
  existingScores?: PartialScore[];
}

export interface CriterionDefinition {
  criterionId: string;
  name: string;
  description: string;
  maxPoints: number;
  weight?: number;
}

export interface PartialScore {
  criterionId: string;
  score: number;
  comment?: string;
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

// Anomaly Detection
export interface AnomalyDetectionRequest {
  callId: string;
  applicationScores: ApplicationScoreData[];
  threshold?: number;
}

export interface ApplicationScoreData {
  applicationId: string;
  assessorScores: {
    assessorId: string;
    criterionScores: {
      criterionId: string;
      score: number;
    }[];
    overallScore: number;
  }[];
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

// Similarity Search
export interface SimilaritySearchRequest {
  applicationId?: string;
  content?: string;
  callId?: string;
  topK?: number;
  minSimilarity?: number;
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

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly provider?: AIProviderType,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export enum AIErrorCode {
  PROVIDER_NOT_CONFIGURED = 'AI_PROVIDER_NOT_CONFIGURED',
  PROVIDER_NOT_AVAILABLE = 'AI_PROVIDER_NOT_AVAILABLE',
  RATE_LIMIT_EXCEEDED = 'AI_RATE_LIMIT_EXCEEDED',
  CONTEXT_LENGTH_EXCEEDED = 'AI_CONTEXT_LENGTH_EXCEEDED',
  INVALID_REQUEST = 'AI_INVALID_REQUEST',
  TIMEOUT = 'AI_TIMEOUT',
  AUTHENTICATION_FAILED = 'AI_AUTHENTICATION_FAILED',
  MODEL_NOT_FOUND = 'AI_MODEL_NOT_FOUND',
  SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  FEATURE_DISABLED = 'AI_FEATURE_DISABLED',
  CACHE_ERROR = 'AI_CACHE_ERROR',
  UNKNOWN_ERROR = 'AI_UNKNOWN_ERROR',
}

// -----------------------------------------------------------------------------
// Health Check Types
// -----------------------------------------------------------------------------

export interface AIHealthStatus {
  provider: AIProviderType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  lastChecked: Date;
  error?: string;
  modelAvailable?: boolean;
}

export interface AIServiceStatus {
  enabled: boolean;
  activeProvider: AIProviderType | null;
  providers: Record<AIProviderType, AIHealthStatus>;
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
    sinceTime: Date;
  };
}

// -----------------------------------------------------------------------------
// Provider Info (for frontend)
// -----------------------------------------------------------------------------

export interface AIProviderInfo {
  type: AIProviderType;
  name: string;
  configured: boolean;
}
