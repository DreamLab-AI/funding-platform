// =============================================================================
// MasterResults Page - Aggregated assessment results
// =============================================================================

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCall } from '../../hooks/useCalls';
import { useMasterResults } from '../../hooks/useAssessments';
import { useToast } from '../../components/Common/Toast';
import { InlineLoader, ButtonLoader } from '../../components/Common/LoadingSpinner';
import { Modal } from '../../components/Common/Modal';
import { ApplicationResult, AssessorScore } from '../../types';

export function MasterResults() {
  const { callId } = useParams<{ callId: string }>();
  const { success, error: showError } = useToast();

  const { call, isLoading: callLoading } = useCall(callId);
  const { results, isLoading, exportResults } = useMasterResults(callId);

  const [sortField, setSortField] = useState<'averageScore' | 'totalScore' | 'variance'>(
    'averageScore'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleSort = (field: 'averageScore' | 'totalScore' | 'variance') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const result = await exportResults({ format: 'xlsx' });
      window.open(result.downloadUrl, '_blank');
      success('Export ready', 'Your Excel file is ready for download.');
      setShowExportModal(false);
    } catch {
      showError('Export failed', 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const toggleRowExpand = (applicationId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(applicationId)) {
      newExpanded.delete(applicationId);
    } else {
      newExpanded.add(applicationId);
    }
    setExpandedRows(newExpanded);
  };

  const sortedResults = results
    ? [...results.results].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      })
    : [];

  if (callLoading || isLoading) {
    return (
      <div className="py-8">
        <InlineLoader message="Loading results..." />
      </div>
    );
  }

  if (!call || !results) {
    return (
      <div className="py-8">
        <p className="text-gray-500">Results not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/coordinator/calls" className="hover:text-gray-700">
              Calls
            </Link>
            <span className="mx-2">/</span>
            <Link to={`/coordinator/calls/${callId}`} className="hover:text-gray-700">
              {call.name}
            </Link>
            <span className="mx-2">/</span>
            <span>Results</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Master Results</h1>
          <p className="text-gray-500">
            {results.completedApplications} of {results.totalApplications} applications
            fully assessed
          </p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export to Excel
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Applications</p>
          <p className="text-2xl font-semibold text-gray-900">
            {results.totalApplications}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Fully Assessed</p>
          <p className="text-2xl font-semibold text-green-600">
            {results.completedApplications}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-semibold text-yellow-600">
            {results.totalApplications - results.completedApplications}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Average Variance</p>
          <p className="text-2xl font-semibold text-gray-900">
            {results.averageVariance.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Application
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('averageScore')}
              >
                <div className="flex items-center">
                  Avg Score
                  {sortField === 'averageScore' && (
                    <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d={
                          sortDirection === 'asc'
                            ? 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'
                            : 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                        }
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('totalScore')}
              >
                <div className="flex items-center">
                  Total Score
                  {sortField === 'totalScore' && (
                    <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d={
                          sortDirection === 'asc'
                            ? 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'
                            : 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                        }
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('variance')}
              >
                <div className="flex items-center">
                  Variance
                  {sortField === 'variance' && (
                    <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d={
                          sortDirection === 'asc'
                            ? 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'
                            : 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                        }
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assessors
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.map((result) => (
              <ResultRow
                key={result.applicationId}
                result={result}
                isExpanded={expandedRows.has(result.applicationId)}
                onToggle={() => toggleRowExpand(result.applicationId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Results"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Export all results including individual assessor scores, aggregates, and
            comments to an Excel file.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
            >
              {exporting && <ButtonLoader />}
              Export
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// =============================================================================
// ResultRow Component
// =============================================================================

interface ResultRowProps {
  result: ApplicationResult;
  isExpanded: boolean;
  onToggle: () => void;
}

function ResultRow({ result, isExpanded, onToggle }: ResultRowProps) {
  return (
    <>
      <tr className={`hover:bg-gray-50 ${result.varianceFlagged ? 'bg-yellow-50' : ''}`}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div>
            <p className="text-sm font-medium text-gray-900">{result.reference}</p>
            <p className="text-sm text-gray-500">{result.applicantName}</p>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-lg font-semibold text-gray-900">
            {result.averageScore.toFixed(1)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm text-gray-900">{result.totalScore}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`text-sm ${
              result.varianceFlagged ? 'text-yellow-700 font-medium' : 'text-gray-500'
            }`}
          >
            {result.variance.toFixed(1)}%
            {result.varianceFlagged && (
              <svg
                className="w-4 h-4 inline ml-1 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm text-gray-500">
            {result.assessmentCount} / {result.expectedAssessments}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {result.isComplete ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Complete
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Pending
            </span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          <button
            onClick={onToggle}
            className="text-primary-600 hover:text-primary-900"
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            <AssessorDetails scores={result.assessorScores} />
          </td>
        </tr>
      )}
    </>
  );
}

// =============================================================================
// AssessorDetails Component
// =============================================================================

interface AssessorDetailsProps {
  scores: AssessorScore[];
}

function AssessorDetails({ scores }: AssessorDetailsProps) {
  if (scores.length === 0) {
    return <p className="text-sm text-gray-500">No assessments submitted yet.</p>;
  }

  return (
    <div className="space-y-4">
      {scores.map((assessor) => (
        <div key={assessor.assessorId} className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">{assessor.assessorName}</span>
            <span className="text-lg font-semibold text-primary-600">
              {assessor.overallScore}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {assessor.scores.map((score) => (
              <div key={score.criterionId}>
                <p className="text-gray-500">{score.criterionName}</p>
                <p className="font-medium">
                  {score.score} / {score.maxScore}
                </p>
                {score.comment && (
                  <p className="text-xs text-gray-400 mt-1 truncate" title={score.comment}>
                    {score.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
          {assessor.overallComment && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                <span className="font-medium">Comment:</span> {assessor.overallComment}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
