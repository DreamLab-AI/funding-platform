// =============================================================================
// ScoreSuggestion - AI Score Suggestions for Assessors
// =============================================================================

import { useState } from 'react';
import { useScoreAssist } from '../../hooks/useAI';
import { ScoreAssistResponse, SuggestedScore } from '../../services/ai';
import LoadingSpinner from '../Common/LoadingSpinner';

interface ScoreSuggestionProps {
  applicationId: string;
  criteria: {
    criterionId: string;
    name: string;
    maxPoints: number;
  }[];
  onApplySuggestion?: (criterionId: string, score: number) => void;
  onSuggestionsGenerated?: (suggestions: ScoreAssistResponse) => void;
}

export function ScoreSuggestion({
  applicationId,
  criteria,
  onApplySuggestion,
  onSuggestionsGenerated,
}: ScoreSuggestionProps) {
  const { suggestions, isLoading, error, getSuggestions, clearSuggestions } = useScoreAssist();
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

  const handleGenerate = async () => {
    const result = await getSuggestions(applicationId);
    if (result && onSuggestionsGenerated) {
      onSuggestionsGenerated(result);
    }
  };

  const handleApply = (suggestion: SuggestedScore) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion.criterionId, suggestion.suggestedScore);
    }
  };

  const getCriterionInfo = (criterionId: string) => {
    return criteria.find((c) => c.criterionId === criterionId);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">AI Scoring Assist</h3>
        </div>
        {suggestions && (
          <button
            onClick={clearSuggestions}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Get AI-generated scoring suggestions based on the application content.
        These are advisory only - final scores are your decision.
      </p>

      {!suggestions && !isLoading && (
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Get Score Suggestions
        </button>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8">
          <LoadingSpinner />
          <p className="mt-2 text-sm text-gray-500">Analyzing application...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {suggestions && (
        <div className="space-y-4">
          {/* Overall Assessment */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Overall Assessment</h4>
            <p className="text-sm text-gray-600">{suggestions.overallAssessment}</p>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2">Strengths</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {suggestions.strengthsIdentified.map((strength, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-green-500">+</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2">Areas for Improvement</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {suggestions.weaknessesIdentified.map((weakness, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-red-500">-</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Individual Criterion Suggestions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Score Suggestions</h4>
            <div className="space-y-2">
              {suggestions.suggestions.map((suggestion) => {
                const criterion = getCriterionInfo(suggestion.criterionId);
                const isExpanded = expandedCriterion === suggestion.criterionId;

                return (
                  <div
                    key={suggestion.criterionId}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() =>
                        setExpandedCriterion(isExpanded ? null : suggestion.criterionId)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-gray-900">
                          {criterion?.name || suggestion.criterionId}
                        </span>
                        <span
                          className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                        >
                          {getConfidenceLabel(suggestion.confidence)} confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-purple-600">
                          {suggestion.suggestedScore}
                        </span>
                        <span className="text-sm text-gray-400">
                          / {criterion?.maxPoints || '?'}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 border-t border-gray-200 space-y-3">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 mb-1">Reasoning</h5>
                          <p className="text-sm text-gray-600">{suggestion.reasoning}</p>
                        </div>

                        {suggestion.relevantExcerpts.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 mb-1">
                              Relevant Excerpts
                            </h5>
                            <div className="space-y-1">
                              {suggestion.relevantExcerpts.map((excerpt, i) => (
                                <blockquote
                                  key={i}
                                  className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2"
                                >
                                  "{excerpt}"
                                </blockquote>
                              ))}
                            </div>
                          </div>
                        )}

                        {onApplySuggestion && (
                          <button
                            onClick={() => handleApply(suggestion)}
                            className="w-full py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                          >
                            Apply this score
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t">
            <span>Advisory suggestions only - use your professional judgment</span>
            <span>Generated in {suggestions.processingTimeMs}ms</span>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Regenerate Suggestions
          </button>
        </div>
      )}
    </div>
  );
}

export default ScoreSuggestion;
