// =============================================================================
// AnomalyAlert - Display Scoring Anomaly Alerts
// =============================================================================

import { useState } from 'react';
import { useAnomalyDetection } from '../../hooks/useAI';
import { ScoringAnomaly, AnomalyDetectionResponse } from '../../services/ai';
import LoadingSpinner from '../Common/LoadingSpinner';

interface AnomalyAlertProps {
  callId: string;
  onAnomaliesDetected?: (response: AnomalyDetectionResponse) => void;
}

export function AnomalyAlert({ callId, onAnomaliesDetected }: AnomalyAlertProps) {
  const { anomalies, isLoading, error, detectAnomalies, clearAnomalies } = useAnomalyDetection();
  const [threshold, setThreshold] = useState<number>(20);
  const [selectedAnomaly, setSelectedAnomaly] = useState<ScoringAnomaly | null>(null);

  const handleDetect = async () => {
    const result = await detectAnomalies(callId, threshold);
    if (result && onAnomaliesDetected) {
      onAnomaliesDetected(result);
    }
  };

  const getSeverityColor = (severity: ScoringAnomaly['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: ScoringAnomaly['severity']) => {
    switch (severity) {
      case 'high':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getTypeLabel = (type: ScoringAnomaly['type']) => {
    switch (type) {
      case 'high_variance':
        return 'High Variance';
      case 'outlier_assessor':
        return 'Outlier Score';
      case 'score_clustering':
        return 'Score Clustering';
      case 'pattern_deviation':
        return 'Pattern Deviation';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Anomaly Detection</h3>
        </div>
        {anomalies && (
          <button
            onClick={clearAnomalies}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {!anomalies && !isLoading && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Analyze scoring patterns to identify potential anomalies such as high variance,
            outlier assessors, or unusual patterns.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Variance Threshold: {threshold}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Strict (5%)</span>
              <span>Lenient (50%)</span>
            </div>
          </div>

          <button
            onClick={handleDetect}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Anomaly Detection
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8">
          <LoadingSpinner />
          <p className="mt-2 text-sm text-gray-500">Analyzing scoring patterns...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleDetect}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {anomalies && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {anomalies.summary.totalApplicationsAnalyzed}
              </div>
              <div className="text-xs text-gray-500">Analyzed</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">
                {anomalies.summary.highSeverityCount}
              </div>
              <div className="text-xs text-red-500">High</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {anomalies.summary.mediumSeverityCount}
              </div>
              <div className="text-xs text-yellow-500">Medium</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {anomalies.summary.lowSeverityCount}
              </div>
              <div className="text-xs text-blue-500">Low</div>
            </div>
          </div>

          {/* Anomalies List */}
          {anomalies.anomalies.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <svg
                className="w-8 h-8 text-green-500 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-green-700">
                No anomalies detected. Scoring patterns appear normal.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.anomalies.map((anomaly, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    getSeverityColor(anomaly.severity)
                  } ${selectedAnomaly === anomaly ? 'ring-2 ring-offset-1' : ''}`}
                  onClick={() =>
                    setSelectedAnomaly(selectedAnomaly === anomaly ? null : anomaly)
                  }
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(anomaly.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {getTypeLabel(anomaly.type)}
                        </span>
                        <span className="text-xs opacity-75 capitalize">
                          {anomaly.severity} severity
                        </span>
                      </div>
                      <p className="text-sm">{anomaly.description}</p>

                      {selectedAnomaly === anomaly && (
                        <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2">
                          {anomaly.evidence.expectedRange && (
                            <div className="text-xs">
                              <span className="font-medium">Expected range:</span>{' '}
                              {anomaly.evidence.expectedRange[0].toFixed(1)} -{' '}
                              {anomaly.evidence.expectedRange[1].toFixed(1)}
                            </div>
                          )}
                          {anomaly.evidence.actualValue !== undefined && (
                            <div className="text-xs">
                              <span className="font-medium">Actual value:</span>{' '}
                              {anomaly.evidence.actualValue.toFixed(1)}
                            </div>
                          )}
                          {anomaly.evidence.zscore !== undefined && (
                            <div className="text-xs">
                              <span className="font-medium">Z-score:</span>{' '}
                              {anomaly.evidence.zscore.toFixed(2)}
                            </div>
                          )}
                          <div className="bg-white bg-opacity-50 rounded p-2 mt-2">
                            <span className="font-medium text-xs">Recommendation:</span>
                            <p className="text-xs mt-1">{anomaly.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t">
            <span>Detection threshold: {threshold}% variance</span>
            <span>Analyzed in {anomalies.processingTimeMs}ms</span>
          </div>

          <button
            onClick={handleDetect}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Re-run Detection
          </button>
        </div>
      )}
    </div>
  );
}

export default AnomalyAlert;
