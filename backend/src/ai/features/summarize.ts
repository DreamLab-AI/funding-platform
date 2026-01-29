// =============================================================================
// Summarization Feature - Application Content Summarization
// =============================================================================

import {
  SummarizeRequest,
  SummarizeResponse,
  AIServiceError,
  AIErrorCode,
} from '../types';
import { getAIService } from '../ai.service';
import { logger } from '../../utils/logger';

/**
 * System prompt for application summarization
 */
const SUMMARIZE_SYSTEM_PROMPT = `You are an expert at summarizing funding application documents. Your task is to create clear, concise summaries that help assessors quickly understand the key aspects of an application.

Guidelines:
- Focus on the most important information
- Identify key themes and objectives
- Note any innovative or unique aspects
- Highlight potential strengths and concerns
- Use professional, neutral language
- Be objective and factual

Output Format:
Provide your response as valid JSON with this structure:
{
  "summary": "A 2-3 paragraph summary of the application",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "themes": ["Theme 1", "Theme 2"],
  "confidence": 0.85
}

The confidence score (0-1) should reflect how well you could summarize the content based on its clarity and completeness.`;

/**
 * Generate a summary of application content
 */
export async function summarizeApplication(
  request: SummarizeRequest
): Promise<SummarizeResponse> {
  const startTime = Date.now();
  const service = getAIService();

  if (!service.isFeatureEnabled('summarization')) {
    throw new AIServiceError(
      'Summarization feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  // Build the prompt
  let prompt = `Please summarize the following funding application:\n\n${request.content}`;

  if (request.focusAreas && request.focusAreas.length > 0) {
    prompt += `\n\nPay particular attention to these aspects: ${request.focusAreas.join(', ')}`;
  }

  if (request.maxLength) {
    prompt += `\n\nKeep the summary under ${request.maxLength} words.`;
  }

  try {
    const response = await service.generateText(prompt, {
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      maxTokens: 1500,
      temperature: 0.3, // Lower temperature for consistent summaries
      useCache: true,
    });

    // Parse the JSON response
    const parsed = parseJsonResponse(response);

    const result: SummarizeResponse = {
      summary: parsed.summary || response,
      keyPoints: parsed.keyPoints || [],
      wordCount: countWords(parsed.summary || response),
      confidence: parsed.confidence || 0.7,
      processingTimeMs: Date.now() - startTime,
    };

    logger.info('Application summarized', {
      applicationId: request.applicationId,
      wordCount: result.wordCount,
      keyPoints: result.keyPoints.length,
      processingTimeMs: result.processingTimeMs,
    });

    return result;
  } catch (error) {
    logger.error('Summarization failed', {
      applicationId: request.applicationId,
      error,
    });

    if (error instanceof AIServiceError) {
      throw error;
    }

    throw new AIServiceError(
      'Failed to summarize application',
      AIErrorCode.UNKNOWN_ERROR,
      undefined,
      error
    );
  }
}

/**
 * Generate a brief summary (for lists/previews)
 */
export async function generateBriefSummary(
  content: string,
  maxWords: number = 50
): Promise<string> {
  const service = getAIService();

  if (!service.isFeatureEnabled('summarization')) {
    // Fallback to simple truncation
    return truncateText(content, maxWords);
  }

  try {
    const response = await service.generateText(
      `Summarize this in exactly ${maxWords} words or fewer:\n\n${content}`,
      {
        systemPrompt: 'You are a summarization assistant. Provide only the summary, no other text.',
        maxTokens: 100,
        temperature: 0.2,
        useCache: true,
      }
    );

    return response.trim();
  } catch {
    // Fallback to truncation on error
    return truncateText(content, maxWords);
  }
}

/**
 * Extract key themes from application content
 */
export async function extractThemes(
  content: string,
  maxThemes: number = 5
): Promise<string[]> {
  const service = getAIService();

  if (!service.isFeatureEnabled('summarization')) {
    return [];
  }

  try {
    const response = await service.extractJson<{ themes: string[] }>(
      content,
      `{ "themes": ["string array of ${maxThemes} key themes"] }`
    );

    return response.themes.slice(0, maxThemes);
  } catch {
    return [];
  }
}

/**
 * Generate a comparative summary of multiple applications
 */
export async function comparativeAnalysis(
  applications: { id: string; content: string }[],
  criteria?: string[]
): Promise<{
  commonThemes: string[];
  uniqueAspects: { applicationId: string; aspects: string[] }[];
  summary: string;
}> {
  const service = getAIService();

  if (!service.isFeatureEnabled('summarization')) {
    throw new AIServiceError(
      'Summarization feature is disabled',
      AIErrorCode.FEATURE_DISABLED
    );
  }

  const prompt = `Compare these ${applications.length} funding applications and identify:
1. Common themes across all applications
2. Unique aspects of each application
3. A brief comparative summary

${applications.map((app, i) => `Application ${i + 1} (ID: ${app.id}):\n${truncateText(app.content, 500)}`).join('\n\n')}

${criteria ? `Focus on these criteria: ${criteria.join(', ')}` : ''}`;

  const schema = `{
    "commonThemes": ["array of themes present in multiple applications"],
    "uniqueAspects": [
      { "applicationId": "string", "aspects": ["unique aspects"] }
    ],
    "summary": "comparative summary paragraph"
  }`;

  return service.extractJson(prompt, schema);
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function parseJsonResponse(response: string): {
  summary?: string;
  keyPoints?: string[];
  themes?: string[];
  confidence?: number;
} {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return empty object if parsing fails
  }
  return {};
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function truncateText(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(' ') + '...';
}
