// =============================================================================
// Anomaly Detection Feature - Scoring Anomaly Detection
// =============================================================================

import {
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  ScoringAnomaly,
  ApplicationScoreData,
  AIServiceError,
  AIErrorCode,
} from '../types';
import { getAIService } from '../ai.service';
import { logger } from '../../utils/logger';

/**
 * Default threshold for variance detection (percentage)
 */
const DEFAULT_VARIANCE_THRESHOLD = 20;

/**
 * Z-score threshold for outlier detection
 */
const ZSCORE_THRESHOLD = 2.0;

/**
 * Detect scoring anomalies across applications
 */
export async function detectScoringAnomalies(
  request: AnomalyDetectionRequest
): Promise<AnomalyDetectionResponse> {
  const startTime = Date.now();
  const service = getAIService();

  if (!service.isFeatureEnabled('anomalyDetection')) {
    throw new AIServiceError(
      'Anomaly detection feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  const threshold = request.threshold || DEFAULT_VARIANCE_THRESHOLD;
  const anomalies: ScoringAnomaly[] = [];

  // Statistical anomaly detection
  for (const appScores of request.applicationScores) {
    // 1. High variance detection
    const varianceAnomalies = detectHighVariance(appScores, threshold);
    anomalies.push(...varianceAnomalies);

    // 2. Outlier assessor detection
    const outlierAnomalies = detectOutlierAssessors(appScores);
    anomalies.push(...outlierAnomalies);

    // 3. Score clustering detection
    const clusteringAnomalies = detectScoreClustering(appScores);
    anomalies.push(...clusteringAnomalies);
  }

  // 4. Cross-application pattern detection (AI-assisted)
  if (request.applicationScores.length >= 3) {
    try {
      const patternAnomalies = await detectPatternDeviations(
        request.applicationScores,
        service
      );
      anomalies.push(...patternAnomalies);
    } catch (error) {
      logger.warn('Pattern deviation detection failed, skipping', { error });
    }
  }

  // Calculate summary
  const summary = {
    totalApplicationsAnalyzed: request.applicationScores.length,
    anomaliesFound: anomalies.length,
    highSeverityCount: anomalies.filter((a) => a.severity === 'high').length,
    mediumSeverityCount: anomalies.filter((a) => a.severity === 'medium').length,
    lowSeverityCount: anomalies.filter((a) => a.severity === 'low').length,
  };

  logger.info('Anomaly detection completed', {
    callId: request.callId,
    applicationsAnalyzed: summary.totalApplicationsAnalyzed,
    anomaliesFound: summary.anomaliesFound,
    processingTimeMs: Date.now() - startTime,
  });

  return {
    anomalies,
    summary,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Detect single application scoring anomalies
 */
export async function detectApplicationAnomalies(
  scores: ApplicationScoreData
): Promise<ScoringAnomaly[]> {
  const anomalies: ScoringAnomaly[] = [];

  anomalies.push(...detectHighVariance(scores, DEFAULT_VARIANCE_THRESHOLD));
  anomalies.push(...detectOutlierAssessors(scores));
  anomalies.push(...detectScoreClustering(scores));

  return anomalies;
}

// ---------------------------------------------------------------------------
// Statistical Detection Methods
// ---------------------------------------------------------------------------

/**
 * Detect high variance between assessors
 */
function detectHighVariance(
  appScores: ApplicationScoreData,
  threshold: number
): ScoringAnomaly[] {
  const anomalies: ScoringAnomaly[] = [];

  if (appScores.assessorScores.length < 2) {
    return anomalies;
  }

  // Overall score variance
  const overallScores = appScores.assessorScores.map((a) => a.overallScore);
  const overallStats = calculateStats(overallScores);

  if (overallStats.coefficientOfVariation > threshold) {
    anomalies.push({
      type: 'high_variance',
      severity: overallStats.coefficientOfVariation > threshold * 1.5 ? 'high' : 'medium',
      applicationId: appScores.applicationId,
      description: `High variance in overall scores: CV=${overallStats.coefficientOfVariation.toFixed(1)}%`,
      evidence: {
        expectedRange: [overallStats.mean - overallStats.stdDev, overallStats.mean + overallStats.stdDev],
        variance: overallStats.variance,
      },
      recommendation: 'Review assessor scores for this application. Consider moderation discussion.',
    });
  }

  // Per-criterion variance
  const criterionIds = new Set(
    appScores.assessorScores.flatMap((a) =>
      a.criterionScores.map((c) => c.criterionId)
    )
  );

  for (const criterionId of criterionIds) {
    const criterionScores = appScores.assessorScores
      .map((a) => a.criterionScores.find((c) => c.criterionId === criterionId)?.score)
      .filter((s): s is number => s !== undefined);

    if (criterionScores.length < 2) continue;

    const stats = calculateStats(criterionScores);

    if (stats.coefficientOfVariation > threshold * 1.2) {
      anomalies.push({
        type: 'high_variance',
        severity: stats.coefficientOfVariation > threshold * 2 ? 'high' : 'medium',
        applicationId: appScores.applicationId,
        criterionId,
        description: `High variance for criterion ${criterionId}: CV=${stats.coefficientOfVariation.toFixed(1)}%`,
        evidence: {
          expectedRange: [stats.mean - stats.stdDev, stats.mean + stats.stdDev],
          variance: stats.variance,
        },
        recommendation: 'Consider criterion-specific review or assessor calibration.',
      });
    }
  }

  return anomalies;
}

/**
 * Detect assessors giving outlier scores
 */
function detectOutlierAssessors(appScores: ApplicationScoreData): ScoringAnomaly[] {
  const anomalies: ScoringAnomaly[] = [];

  if (appScores.assessorScores.length < 3) {
    return anomalies;
  }

  const overallScores = appScores.assessorScores.map((a) => a.overallScore);
  const stats = calculateStats(overallScores);

  for (const assessor of appScores.assessorScores) {
    const zscore = (assessor.overallScore - stats.mean) / stats.stdDev;

    if (Math.abs(zscore) > ZSCORE_THRESHOLD) {
      anomalies.push({
        type: 'outlier_assessor',
        severity: Math.abs(zscore) > 3 ? 'high' : 'medium',
        applicationId: appScores.applicationId,
        assessorIds: [assessor.assessorId],
        description: `Assessor ${assessor.assessorId} gave an outlier score (z-score: ${zscore.toFixed(2)})`,
        evidence: {
          expectedRange: [stats.mean - stats.stdDev * 2, stats.mean + stats.stdDev * 2],
          actualValue: assessor.overallScore,
          zscore: Math.abs(zscore),
        },
        recommendation: 'Review this assessor\'s scoring rationale. May indicate different interpretation of criteria.',
      });
    }
  }

  return anomalies;
}

/**
 * Detect suspicious score clustering
 */
function detectScoreClustering(appScores: ApplicationScoreData): ScoringAnomaly[] {
  const anomalies: ScoringAnomaly[] = [];

  if (appScores.assessorScores.length < 2) {
    return anomalies;
  }

  // Check for identical overall scores
  const overallScores = appScores.assessorScores.map((a) => a.overallScore);
  const uniqueScores = new Set(overallScores);

  if (uniqueScores.size === 1 && appScores.assessorScores.length >= 3) {
    anomalies.push({
      type: 'score_clustering',
      severity: 'medium',
      applicationId: appScores.applicationId,
      description: 'All assessors gave identical overall scores',
      evidence: {
        actualValue: overallScores[0],
      },
      recommendation: 'While possible, identical scores from multiple assessors may warrant review.',
    });
  }

  // Check for scores clustering at boundaries (0, max)
  const maxScore = Math.max(...overallScores);
  const atBoundary = overallScores.filter((s) => s === 0 || s === maxScore);

  if (atBoundary.length >= 2 && atBoundary.length === overallScores.length) {
    anomalies.push({
      type: 'score_clustering',
      severity: 'low',
      applicationId: appScores.applicationId,
      description: 'All scores are at boundary values (minimum or maximum)',
      evidence: {},
      recommendation: 'Boundary clustering may indicate rushed assessment or obvious application quality.',
    });
  }

  return anomalies;
}

/**
 * AI-assisted pattern deviation detection
 */
async function detectPatternDeviations(
  allScores: ApplicationScoreData[],
  service: ReturnType<typeof getAIService>
): Promise<ScoringAnomaly[]> {
  // Prepare data for AI analysis
  const summary = allScores.map((app) => ({
    applicationId: app.applicationId,
    assessorCount: app.assessorScores.length,
    avgScore: calculateStats(app.assessorScores.map((a) => a.overallScore)).mean,
    variance: calculateStats(app.assessorScores.map((a) => a.overallScore)).variance,
    scores: app.assessorScores.map((a) => a.overallScore),
  }));

  const prompt = `Analyze these scoring patterns for a funding call and identify any unusual patterns that might indicate:
- Assessor bias (consistently scoring high or low)
- Gaming or collusion
- Inconsistent application of criteria
- Applications that seem to be scored differently than expected given the pattern

Scoring Data:
${JSON.stringify(summary, null, 2)}

Only report genuine anomalies, not normal variation.`;

  const schema = `{
    "anomalies": [
      {
        "applicationId": "string",
        "assessorIds": ["optional array of assessor IDs involved"],
        "description": "clear description of the anomaly",
        "severity": "low|medium|high",
        "recommendation": "actionable recommendation"
      }
    ]
  }`;

  try {
    const result = await service.extractJson<{
      anomalies: Array<{
        applicationId: string;
        assessorIds?: string[];
        description: string;
        severity: 'low' | 'medium' | 'high';
        recommendation: string;
      }>;
    }>(prompt, schema);

    return result.anomalies.map((a) => ({
      type: 'pattern_deviation' as const,
      severity: a.severity,
      applicationId: a.applicationId,
      assessorIds: a.assessorIds,
      description: a.description,
      evidence: {},
      recommendation: a.recommendation,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Statistical Helpers
// ---------------------------------------------------------------------------

interface Stats {
  mean: number;
  variance: number;
  stdDev: number;
  coefficientOfVariation: number;
}

function calculateStats(values: number[]): Stats {
  if (values.length === 0) {
    return { mean: 0, variance: 0, stdDev: 0, coefficientOfVariation: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  if (values.length === 1) {
    return { mean, variance: 0, stdDev: 0, coefficientOfVariation: 0 };
  }

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean !== 0 ? (stdDev / mean) * 100 : 0;

  return { mean, variance, stdDev, coefficientOfVariation };
}
