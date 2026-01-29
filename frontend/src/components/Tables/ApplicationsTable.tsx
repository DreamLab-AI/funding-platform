// =============================================================================
// ApplicationsTable Component
// =============================================================================

import { ApplicationSummary, ApplicationStatus } from '../../types';
import { DataTable, Column } from './DataTable';

interface ApplicationsTableProps {
  applications: ApplicationSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (application: ApplicationSummary) => void;
  isLoading?: boolean;
}

export function ApplicationsTable({
  applications,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onSort,
  selectedIds,
  onSelectionChange,
  onRowClick,
  isLoading = false,
}: ApplicationsTableProps) {
  const getStatusBadge = (status: ApplicationStatus) => {
    const styles: Record<ApplicationStatus, string> = {
      [ApplicationStatus.DRAFT]: 'bg-gray-100 text-gray-800',
      [ApplicationStatus.SUBMITTED]: 'bg-blue-100 text-blue-800',
      [ApplicationStatus.UNDER_REVIEW]: 'bg-yellow-100 text-yellow-800',
      [ApplicationStatus.ASSESSED]: 'bg-green-100 text-green-800',
      [ApplicationStatus.WITHDRAWN]: 'bg-red-100 text-red-800',
    };

    const labels: Record<ApplicationStatus, string> = {
      [ApplicationStatus.DRAFT]: 'Draft',
      [ApplicationStatus.SUBMITTED]: 'Submitted',
      [ApplicationStatus.UNDER_REVIEW]: 'Under Review',
      [ApplicationStatus.ASSESSED]: 'Assessed',
      [ApplicationStatus.WITHDRAWN]: 'Withdrawn',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const getAssessmentProgress = (
    completed: number,
    total: number
  ): React.ReactNode => {
    if (total === 0) {
      return <span className="text-gray-400">Not assigned</span>;
    }

    const percentage = Math.round((completed / total) * 100);
    const isComplete = completed === total;

    return (
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[100px]">
          <div
            className={`h-2 rounded-full ${
              isComplete ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-600">
          {completed}/{total}
        </span>
      </div>
    );
  };

  const columns: Column<ApplicationSummary>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortable: true,
      render: (app) => (
        <span className="font-medium text-gray-900">{app.reference}</span>
      ),
    },
    {
      key: 'applicantName',
      header: 'Applicant',
      sortable: true,
      render: (app) => (
        <div>
          <p className="font-medium text-gray-900">{app.applicantName}</p>
          <p className="text-sm text-gray-500">{app.applicantEmail}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (app) => getStatusBadge(app.status),
    },
    {
      key: 'fileCount',
      header: 'Files',
      sortable: true,
      render: (app) => (
        <span className="inline-flex items-center">
          <svg
            className="w-4 h-4 text-gray-400 mr-1"
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
          {app.fileCount}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (app) =>
        app.submittedAt
          ? new Date(app.submittedAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-',
    },
    {
      key: 'assessmentProgress',
      header: 'Assessment Progress',
      render: (app) =>
        getAssessmentProgress(
          app.completedAssessmentCount,
          app.assignmentCount
        ),
    },
  ];

  return (
    <DataTable
      data={applications}
      columns={columns}
      keyExtractor={(app) => app.id}
      pagination={{
        page,
        pageSize,
        total,
        totalPages,
        onPageChange,
        onPageSizeChange,
      }}
      sorting={
        onSort
          ? {
              sort: null,
              onSortChange: (sort) => onSort(sort.field, sort.direction),
            }
          : undefined
      }
      selection={
        selectedIds && onSelectionChange
          ? {
              selected: selectedIds,
              onSelectionChange,
            }
          : undefined
      }
      onRowClick={onRowClick}
      emptyMessage="No applications found"
      isLoading={isLoading}
    />
  );
}
