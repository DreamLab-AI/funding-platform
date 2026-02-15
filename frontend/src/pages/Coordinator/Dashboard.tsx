// =============================================================================
// Coordinator Dashboard
// =============================================================================

import { Link } from 'react-router-dom';
import { useAllCalls } from '../../hooks/useCalls';
import { CallStatus, FundingCallSummary } from '../../types';
import { CircularProgress } from '../../components/Common/ProgressBar';
import { SkeletonDashboard } from '../../components/Common/Skeleton';

export function CoordinatorDashboard() {
  const { calls, isLoading, error } = useAllCalls();

  const getStatusColor = (status: CallStatus) => {
    const colors: Record<CallStatus, string> = {
      [CallStatus.DRAFT]: 'bg-gray-100 text-gray-800',
      [CallStatus.OPEN]: 'bg-green-100 text-green-800',
      [CallStatus.CLOSED]: 'bg-yellow-100 text-yellow-800',
      [CallStatus.IN_ASSESSMENT]: 'bg-blue-100 text-blue-800',
      [CallStatus.COMPLETED]: 'bg-purple-100 text-purple-800',
      [CallStatus.ARCHIVED]: 'bg-gray-100 text-gray-600',
    };
    return colors[status];
  };

  const stats = {
    total: calls.length,
    open: calls.filter((c) => c.status === CallStatus.OPEN).length,
    inAssessment: calls.filter((c) => c.status === CallStatus.IN_ASSESSMENT).length,
    completed: calls.filter((c) => c.status === CallStatus.COMPLETED).length,
    totalApplications: calls.reduce((sum, c) => sum + (c.applicationCount || 0), 0),
  };

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of funding calls and assessments</p>
        </div>
        <Link
          to="/dashboard/coordinator/calls/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Call
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total Calls" value={stats.total} icon="folder" />
        <StatCard title="Open" value={stats.open} icon="clock" color="green" />
        <StatCard title="Assessing" value={stats.inAssessment} icon="users" color="blue" />
        <StatCard title="Completed" value={stats.completed} icon="check" color="purple" />
        <StatCard title="Applications" value={stats.totalApplications} icon="document" />
      </div>

      {/* Active Calls */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Active Calls</h2>
        {calls.filter(
          (c) => c.status === CallStatus.OPEN || c.status === CallStatus.IN_ASSESSMENT
        ).length === 0 ? (
          <div className="text-center py-16 px-4 bg-gradient-to-b from-gray-50 to-white rounded-lg border-2 border-dashed border-gray-300">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Calls</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              Create a new funding call to start accepting applications from researchers and organisations.
            </p>
            <Link
              to="/dashboard/coordinator/calls/new"
              className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Call
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {calls
              .filter(
                (c) => c.status === CallStatus.OPEN || c.status === CallStatus.IN_ASSESSMENT
              )
              .map((call) => (
                <CallCard key={call.id} call={call} getStatusColor={getStatusColor} />
              ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">All Calls</h2>
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applications
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/dashboard/coordinator/calls/${call.id}`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-900"
                    >
                      {call.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        call.status
                      )}`}
                    >
                      {call.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(call.closeAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.applicationCount ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {call.assessmentProgress !== undefined ? (
                      <div className="flex items-center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className="h-2 bg-primary-600 rounded-full"
                            style={{ width: `${call.assessmentProgress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {call.assessmentProgress}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/dashboard/coordinator/calls/${call.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// StatCard Component
// =============================================================================

interface StatCardProps {
  title: string;
  value: number;
  icon: 'folder' | 'clock' | 'users' | 'check' | 'document';
  color?: 'gray' | 'green' | 'blue' | 'purple';
}

function StatCard({ title, value, icon, color = 'gray' }: StatCardProps) {
  const icons = {
    folder: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    ),
    clock: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
    check: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
  };

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white overflow-hidden shadow-sm border border-gray-200 rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 rounded-md p-3 ${colorClasses[color]}`}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {icons[icon]}
            </svg>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500">{title}</dt>
              <dd className="text-2xl font-semibold text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CallCard Component
// =============================================================================

interface CallCardProps {
  call: FundingCallSummary;
  getStatusColor: (status: CallStatus) => string;
}

function CallCard({ call, getStatusColor }: CallCardProps) {
  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
            call.status
          )}`}
        >
          {call.status.replace(/_/g, ' ')}
        </span>
        {call.assessmentProgress !== undefined && (
          <CircularProgress progress={call.assessmentProgress} size={50} strokeWidth={5} />
        )}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{call.name}</h3>
      <div className="text-sm text-gray-500 space-y-1">
        <p>Deadline: {new Date(call.closeAt).toLocaleDateString('en-GB')}</p>
        <p>Applications: {call.applicationCount ?? 0}</p>
      </div>
      <div className="mt-4 flex space-x-2">
        <Link
          to={`/dashboard/coordinator/applications`}
          className="flex-1 text-center px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100"
        >
          Applications
        </Link>
        <Link
          to={`/dashboard/coordinator/results`}
          className="flex-1 text-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100"
        >
          Results
        </Link>
      </div>
    </div>
  );
}
