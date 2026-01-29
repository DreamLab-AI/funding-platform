// =============================================================================
// SummaryPanel - Display AI-Generated Application Summary
// =============================================================================

import { useState } from 'react';
import { useSummarize } from '../../hooks/useAI';
import { SummaryResponse } from '../../services/ai';
import LoadingSpinner from '../Common/LoadingSpinner';

interface SummaryPanelProps {
  applicationId: string;
  onSummaryGenerated?: (summary: SummaryResponse) => void;
}

export function SummaryPanel({ applicationId, onSummaryGenerated }: SummaryPanelProps) {
  const { summary, isLoading, error, summarize, clearSummary } = useSummarize();
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [maxLength, setMaxLength] = useState<number>(200);

  const handleGenerate = async () => {
    const result = await summarize(applicationId, {
      maxLength,
      focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
    });

    if (result && onSummaryGenerated) {
      onSummaryGenerated(result);
    }
  };

  const handleFocusAreaChange = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const availableFocusAreas = [
    'Innovation',
    'Impact',
    'Methodology',
    'Budget',
    'Team',
    'Timeline',
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
        {summary && (
          <button
            onClick={clearSummary}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {!summary && !isLoading && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary Length (words)
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={maxLength}
              onChange={(e) => setMaxLength(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-500 text-center">{maxLength} words</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Focus Areas (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableFocusAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => handleFocusAreaChange(area)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    focusAreas.includes(area)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate Summary
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8">
          <LoadingSpinner />
          <p className="mt-2 text-sm text-gray-500">Generating summary...</p>
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

      {summary && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
            <p className="text-gray-600 text-sm leading-relaxed">{summary.summary}</p>
          </div>

          {summary.keyPoints.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Points</h4>
              <ul className="list-disc list-inside space-y-1">
                {summary.keyPoints.map((point, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t">
            <span>
              Confidence: {Math.round(summary.confidence * 100)}% | {summary.wordCount} words
            </span>
            <span>Generated in {summary.processingTimeMs}ms</span>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

export default SummaryPanel;
