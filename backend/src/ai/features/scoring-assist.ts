// =============================================================================
// Scoring Assistance Feature - AI-Assisted Score Suggestions
// =============================================================================

import {
  ScoreAssistRequest,
  ScoreAssistResponse,
  SuggestedScore,
  CriterionDefinition,
  AIServiceError,
  AIErrorCode,
} from '../types';
import { getAIService } from '../ai.service';
import { logger } from '../../utils/logger';

/**
 * System prompt for scoring assistance
 */
const SCORING_SYSTEM_PROMPT = `You are an expert assessor helping to evaluate funding applications. Your role is to provide objective, evidence-based scoring suggestions based on the assessment criteria provided.

Guidelines:
- Be objective and impartial
- Base scores strictly on the content provided
- Cite specific excerpts as evidence for your suggestions
- Consider both strengths and weaknesses
- Explain your reasoning clearly
- Be conservative with scores when evidence is limited
- Flag any uncertainties in your confidence score

Important: Your suggestions are advisory only. Human assessors make the final decisions.

Output Format:
Provide your response as valid JSON matching the schema provided.`;

/**
 * Generate scoring suggestions for an application
 */
export async function generateScoringSuggestions(
  request: ScoreAssistRequest
): Promise<ScoreAssistResponse> {
  const startTime = Date.now();
  const service = getAIService();

  if (!service.isFeatureEnabled('scoringAssist')) {
    throw new AIServiceError(
      'Scoring assistance feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  // Build the prompt with criteria details
  const criteriaDescription = request.criteria
    .map(
      (c) =>
        `- ${c.name} (max ${c.maxPoints} points${c.weight ? `, weight: ${c.weight}` : ''})\n  ${c.description}`
    )
    .join('\n\n');

  const prompt = `Please assess the following funding application against the provided criteria and suggest scores with reasoning.

Assessment Criteria:
${criteriaDescription}

Application Content:
${request.applicationContent}

${
  request.existingScores && request.existingScores.length > 0
    ? `\nExisting scores for reference:\n${request.existingScores
        .map((s) => `- ${request.criteria.find((c) => c.criterionId === s.criterionId)?.name}: ${s.score}`)
        .join('\n')}`
    : ''
}

Provide scoring suggestions for each criterion.`;

  const schema = `{
    "suggestions": [
      {
        "criterionId": "string (criterion ID)",
        "suggestedScore": "number (0 to maxPoints)",
        "reasoning": "string explaining the score",
        "confidence": "number 0-1",
        "relevantExcerpts": ["array of relevant quotes from the application"]
      }
    ],
    "overallAssessment": "string with general assessment",
    "strengthsIdentified": ["array of key strengths"],
    "weaknessesIdentified": ["array of key weaknesses/areas for improvement"]
  }`;

  try {
    const response = await service.extractJson<{
      suggestions: SuggestedScore[];
      overallAssessment: string;
      strengthsIdentified: string[];
      weaknessesIdentified: string[];
    }>(
      prompt,
      schema,
      { maxTokens: 3000 }
    );

    // Validate and normalize scores
    const normalizedSuggestions = normalizeScores(
      response.suggestions,
      request.criteria
    );

    const result: ScoreAssistResponse = {
      suggestions: normalizedSuggestions,
      overallAssessment: response.overallAssessment || '',
      strengthsIdentified: response.strengthsIdentified || [],
      weaknessesIdentified: response.weaknessesIdentified || [],
      processingTimeMs: Date.now() - startTime,
    };

    logger.info('Scoring suggestions generated', {
      applicationId: request.applicationId,
      criteriaCount: request.criteria.length,
      suggestionsCount: result.suggestions.length,
      processingTimeMs: result.processingTimeMs,
    });

    return result;
  } catch (error) {
    logger.error('Scoring assistance failed', {
      applicationId: request.applicationId,
      error,
    });

    if (error instanceof AIServiceError) {
      throw error;
    }

    throw new AIServiceError(
      'Failed to generate scoring suggestions',
      AIErrorCode.UNKNOWN_ERROR,
      undefined,
      error
    );
  }
}

/**
 * Generate score suggestion for a single criterion
 */
export async function suggestCriterionScore(
  applicationContent: string,
  criterion: CriterionDefinition
): Promise<SuggestedScore> {
  const service = getAIService();

  if (!service.isFeatureEnabled('scoringAssist')) {
    throw new AIServiceError(
      'Scoring assistance feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  const prompt = `Evaluate this application against a single criterion.

Criterion: ${criterion.name}
Description: ${criterion.description}
Maximum Points: ${criterion.maxPoints}

Application Content:
${applicationContent}

Provide a score suggestion with reasoning.`;

  const schema = `{
    "suggestedScore": "number 0 to ${criterion.maxPoints}",
    "reasoning": "string explaining the score",
    "confidence": "number 0-1",
    "relevantExcerpts": ["relevant quotes from application"]
  }`;

  try {
    const response = await service.extractJson<Omit<SuggestedScore, 'criterionId'>>(
      prompt,
      schema,
      { maxTokens: 1000 }
    );

    return {
      criterionId: criterion.criterionId,
      suggestedScore: Math.min(
        Math.max(0, response.suggestedScore),
        criterion.maxPoints
      ),
      reasoning: response.reasoning,
      confidence: Math.min(Math.max(0, response.confidence), 1),
      relevantExcerpts: response.relevantExcerpts || [],
    };
  } catch (error) {
    throw new AIServiceError(
      `Failed to generate score suggestion for criterion: ${criterion.name}`,
      AIErrorCode.UNKNOWN_ERROR,
      undefined,
      error
    );
  }
}

/**
 * Analyze score consistency between assessors
 */
export async function analyzeScoreConsistency(
  applicationContent: string,
  assessorScores: {
    assessorId: string;
    criterionId: string;
    score: number;
    comment?: string;
  }[],
  criterion: CriterionDefinition
): Promise<{
  analysis: string;
  suggestedResolution?: number;
  confidence: number;
}> {
  const service = getAIService();

  if (!service.isFeatureEnabled('scoringAssist')) {
    throw new AIServiceError(
      'Scoring assistance feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  const scoresDescription = assessorScores
    .map(
      (s) =>
        `Assessor ${s.assessorId}: ${s.score}/${criterion.maxPoints}${
          s.comment ? ` - "${s.comment}"` : ''
        }`
    )
    .join('\n');

  const prompt = `Analyze the scoring consistency for this criterion where assessors have given different scores.

Criterion: ${criterion.name}
Description: ${criterion.description}
Maximum Points: ${criterion.maxPoints}

Assessor Scores:
${scoresDescription}

Application Content (relevant section):
${applicationContent.substring(0, 2000)}

Provide an analysis of why scores might differ and suggest a fair resolution if appropriate.`;

  const schema = `{
    "analysis": "explanation of score differences",
    "suggestedResolution": "optional fair score if appropriate",
    "confidence": "number 0-1"
  }`;

  return service.extractJson(prompt, schema);
}

/**
 * Generate feedback suggestions for assessor comments
 */
export async function suggestFeedback(
  applicationContent: string,
  criterion: CriterionDefinition,
  score: number
): Promise<{
  suggestedComments: string[];
  improvementAreas: string[];
}> {
  const service = getAIService();

  if (!service.isFeatureEnabled('scoringAssist')) {
    return { suggestedComments: [], improvementAreas: [] };
  }

  const prompt = `Generate constructive feedback comments for an assessor scoring this application.

Criterion: ${criterion.name}
Description: ${criterion.description}
Score Given: ${score}/${criterion.maxPoints}

Application Content:
${applicationContent.substring(0, 1500)}

Suggest professional, constructive comments the assessor could use.`;

  const schema = `{
    "suggestedComments": ["array of professional feedback comments"],
    "improvementAreas": ["areas for improvement to mention"]
  }`;

  try {
    return await service.extractJson(prompt, schema);
  } catch {
    return { suggestedComments: [], improvementAreas: [] };
  }
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Normalize scores to valid ranges
 */
function normalizeScores(
  suggestions: SuggestedScore[],
  criteria: CriterionDefinition[]
): SuggestedScore[] {
  return suggestions.map((suggestion) => {
    const criterion = criteria.find(
      (c) => c.criterionId === suggestion.criterionId
    );

    if (!criterion) {
      return suggestion;
    }

    return {
      ...suggestion,
      suggestedScore: Math.min(
        Math.max(0, suggestion.suggestedScore),
        criterion.maxPoints
      ),
      confidence: Math.min(Math.max(0, suggestion.confidence), 1),
    };
  });
}
