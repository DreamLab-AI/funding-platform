// =============================================================================
// SubmissionConfirmation Page
// =============================================================================

import { Link, useParams } from 'react-router-dom';
import { useApplication } from '../../hooks/useApplications';
import { useCall } from '../../hooks/useCalls';
import { InlineLoader } from '../../components/Common/LoadingSpinner';

export function SubmissionConfirmation() {
  const { callId, applicationId } = useParams<{ callId: string; applicationId: string }>();
  const { application, isLoading: appLoading } = useApplication(applicationId);
  const { call, isLoading: callLoading } = useCall(callId);

  if (appLoading || callLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <InlineLoader message="Loading confirmation..." />
      </div>
    );
  }

  if (!application || !call) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center">
          <p className="text-gray-500">Application not found.</p>
          <Link
            to="/calls"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Return to calls
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Application Submitted Successfully
        </h1>

        {/* Message */}
        <p className="mt-4 text-lg text-gray-600">
          Thank you for submitting your application. A confirmation email has been sent to your
          registered email address.
        </p>
      </div>

      {/* Details Card */}
      <div className="mt-8 bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Application Details</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Reference Number</span>
            <span className="text-sm font-medium text-gray-900">{application.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Funding Call</span>
            <span className="text-sm font-medium text-gray-900">{call.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Submission Date</span>
            <span className="text-sm font-medium text-gray-900">
              {application.submittedAt
                ? new Date(application.submittedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/London',
                  })
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Submitted
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Files Uploaded</span>
            <span className="text-sm font-medium text-gray-900">
              {application.files.length} file{application.files.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="mt-6 bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Uploaded Documents</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {application.files.map((file) => (
            <li key={file.id} className="px-6 py-4 flex items-center">
              <svg
                className="h-5 w-5 text-gray-400 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-900">{file.originalFilename}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What's Next */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-800 mb-2">What happens next?</h3>
        <ul className="text-sm text-blue-700 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            Your application will be reviewed for completeness.
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            It will be assigned to assessors for evaluation.
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            You will be notified of the outcome once assessment is complete.
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/my-applications"
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          View My Applications
        </Link>
        <Link
          to="/calls"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Browse More Calls
        </Link>
      </div>

      {/* Print Receipt */}
      <div className="mt-6 text-center">
        <button
          onClick={() => window.print()}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          Print this page as a receipt
        </button>
      </div>
    </div>
  );
}
