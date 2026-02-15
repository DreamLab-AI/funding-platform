// =============================================================================
// ApplicationsView Page - Coordinator view of applications
// =============================================================================

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCall } from '../../hooks/useCalls';
import { useCallApplications, useApplicationMutations } from '../../hooks/useApplications';
import { useToast } from '../../components/Common/Toast';
import { ApplicationsTable } from '../../components/Tables/ApplicationsTable';
import { InlineLoader, ButtonLoader } from '../../components/Common/LoadingSpinner';
import { Modal } from '../../components/Common/Modal';
import { ApplicationStatus } from '../../types';

export function ApplicationsView() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const { call, isLoading: callLoading } = useCall(callId);
  const {
    applications,
    total,
    totalPages,
    isLoading,
    setFilters,
    setPagination,
  } = useCallApplications(callId, {
    pagination: { page: 1, pageSize: 20 },
  });
  const { exportApplications, downloadAllApplications, isLoading: exporting } =
    useApplicationMutations();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setPagination({ page, pageSize });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setPagination({ page: 1, pageSize: size });
  };

  const handleStatusFilter = (status: ApplicationStatus | 'all') => {
    setStatusFilter(status);
    setFilters({
      status: status === 'all' ? undefined : status,
      search: searchQuery || undefined,
    });
  };

  const handleSearch = () => {
    setFilters({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
    });
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!callId) return;
    try {
      const result = await exportApplications(callId, { format });
      window.open(result.downloadUrl, '_blank');
      success('Export ready', `Your ${format.toUpperCase()} file is ready for download.`);
      setShowExportModal(false);
    } catch {
      showError('Export failed', 'Please try again.');
    }
  };

  const handleDownloadAll = async () => {
    if (!callId) return;
    try {
      await downloadAllApplications(callId);
      success('Download started', 'All application files are being downloaded.');
    } catch {
      showError('Download failed', 'Please try again.');
    }
  };

  if (callLoading || !call) {
    return (
      <div className="py-8">
        <InlineLoader message="Loading..." />
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
            <span>{call.name}</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500">{total} applications submitted</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <ButtonLoader /> : null}
            Download All Files
          </button>
          <Link
            to={`/coordinator/calls/${callId}/assign`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Assign to Assessors
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, email, or reference..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pl-10"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilter(e.target.value as ApplicationStatus | 'all')
              }
              className="block rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value={ApplicationStatus.SUBMITTED}>Submitted</option>
              <option value={ApplicationStatus.UNDER_REVIEW}>Under Review</option>
              <option value={ApplicationStatus.ASSESSED}>Assessed</option>
              <option value={ApplicationStatus.WITHDRAWN}>Withdrawn</option>
            </select>
          </div>

          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Search
          </button>
        </div>
      </div>

      {/* Selection Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-primary-700">
            {selectedIds.length} application{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() =>
                navigate(`/coordinator/calls/${callId}/assign`, {
                  state: { selectedIds },
                })
              }
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              Assign Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Applications Table */}
      <ApplicationsTable
        applications={applications}
        total={total}
        page={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(app) => navigate(`/coordinator/applications/${app.id}`)}
        isLoading={isLoading}
      />

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Applications"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Choose the format for exporting application data.
          </p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exporting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
            >
              <span className="font-medium">Excel (.xlsx)</span>
              <p className="text-sm text-gray-500">
                Best for detailed analysis and reporting
              </p>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
            >
              <span className="font-medium">CSV (.csv)</span>
              <p className="text-sm text-gray-500">
                Compatible with most data tools
              </p>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
