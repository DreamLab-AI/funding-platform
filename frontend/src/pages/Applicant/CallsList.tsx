// =============================================================================
// CallsList Page - Applicant view of open funding calls
// =============================================================================

import { Link } from 'react-router-dom';
import { useOpenCalls } from '../../hooks/useCalls';
import { FundingCallSummary, CallStatus } from '../../types';
import { InlineLoader } from '../../components/Common/LoadingSpinner';

export function CallsList() {
  const { calls, isLoading, error } = useOpenCalls();

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    const formatted = date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    });

    return { formatted, days };
  };

  const getDeadlineBadge = (days: number) => {
    if (days <= 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Closed
        </span>
      );
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {days} day{days !== 1 ? 's' : ''} left
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          {days} days left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        {days} days left
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InlineLoader message="Loading funding calls..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading calls</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Open Funding Calls</h1>
        <p className="mt-2 text-gray-600">
          Browse current funding opportunities and submit your application.
        </p>
      </div>

      {/* Calls Grid */}
      {calls.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No open funding calls
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            There are currently no funding calls open for applications. Please check
            back later.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {calls.map((call) => (
            <CallCard key={call.id} call={call} formatDeadline={formatDeadline} getDeadlineBadge={getDeadlineBadge} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CallCard Component
// =============================================================================

interface CallCardProps {
  call: FundingCallSummary;
  formatDeadline: (dateString: string) => { formatted: string; days: number };
  getDeadlineBadge: (days: number) => React.ReactNode;
}

function CallCard({ call, formatDeadline, getDeadlineBadge }: CallCardProps) {
  const { formatted, days } = formatDeadline(call.closeAt);
  const isOpen = call.status === CallStatus.OPEN && days > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-4">
          {getDeadlineBadge(days)}
          {call.applicationCount !== undefined && (
            <span className="text-sm text-gray-500">
              {call.applicationCount} application{call.applicationCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{call.name}</h3>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{call.description}</p>

        {/* Deadline */}
        <div className="flex items-center text-sm text-gray-500 mb-4">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>Deadline: {formatted}</span>
        </div>

        {/* Action Button */}
        {isOpen ? (
          <Link
            to={`/apply/${call.id}`}
            className="block w-full text-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Start Application
          </Link>
        ) : (
          <button
            disabled
            className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
          >
            Applications Closed
          </button>
        )}
      </div>
    </div>
  );
}
