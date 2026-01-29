// =============================================================================
// AssignmentTool Page - Assign applications to assessors
// =============================================================================

import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useCall } from '../../hooks/useCalls';
import { useCallApplications } from '../../hooks/useApplications';
import {
  useCallAssessors,
  useAssignmentMutations,
} from '../../hooks/useAssessments';
import { useToast } from '../../components/Common/Toast';
import { InlineLoader, ButtonLoader } from '../../components/Common/LoadingSpinner';
import { ConfirmModal } from '../../components/Common/Modal';
import { ApplicationSummary, AssessorPoolMember, ApplicationStatus } from '../../types';

export function AssignmentTool() {
  const { callId } = useParams<{ callId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const { call, isLoading: callLoading } = useCall(callId);
  const { applications, isLoading: appsLoading } = useCallApplications(callId);
  const { assessors, isLoading: assessorsLoading, refetch: refetchAssessors } =
    useCallAssessors(callId);
  const { assignApplications, isLoading: assigning } = useAssignmentMutations();

  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);
  const [selectedAssessors, setSelectedAssessors] = useState<string[]>([]);
  const [assignmentMethod, setAssignmentMethod] = useState<'round_robin' | 'manual'>(
    'round_robin'
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Initialize with pre-selected applications from navigation state
  useEffect(() => {
    const state = location.state as { selectedIds?: string[] } | null;
    if (state?.selectedIds) {
      setSelectedApplications(state.selectedIds);
    }
  }, [location.state]);

  const eligibleApplications = applications.filter(
    (app) => app.status === ApplicationStatus.SUBMITTED
  );

  const handleSelectAllApplications = () => {
    if (selectedApplications.length === eligibleApplications.length) {
      setSelectedApplications([]);
    } else {
      setSelectedApplications(eligibleApplications.map((a) => a.id));
    }
  };

  const handleSelectAllAssessors = () => {
    if (selectedAssessors.length === assessors.length) {
      setSelectedAssessors([]);
    } else {
      setSelectedAssessors(assessors.map((a) => a.id));
    }
  };

  const handleAssign = async () => {
    if (!callId) return;

    try {
      await assignApplications(callId, {
        applicationIds: selectedApplications,
        assessorIds: selectedAssessors,
        assignmentMethod,
      });
      success(
        'Applications assigned',
        `${selectedApplications.length} applications assigned to ${selectedAssessors.length} assessors.`
      );
      setShowConfirmModal(false);
      navigate(`/coordinator/calls/${callId}/applications`);
    } catch {
      showError('Assignment failed', 'Please try again.');
    }
  };

  const getEstimatedAssignments = () => {
    if (selectedApplications.length === 0 || selectedAssessors.length === 0) return 0;
    if (assignmentMethod === 'round_robin' && call) {
      return selectedApplications.length * call.assessorsPerApplication;
    }
    return selectedApplications.length * selectedAssessors.length;
  };

  if (callLoading || appsLoading || assessorsLoading) {
    return (
      <div className="py-8">
        <InlineLoader message="Loading..." />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="py-8">
        <p className="text-gray-500">Call not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <span>Assign Applications</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Assign Applications</h1>
        <p className="text-gray-500">
          Select applications and assessors to create assignments.
        </p>
      </div>

      {/* Assignment Method */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Assignment Method</h2>
        <div className="space-y-4">
          <label className="flex items-start">
            <input
              type="radio"
              name="method"
              value="round_robin"
              checked={assignmentMethod === 'round_robin'}
              onChange={() => setAssignmentMethod('round_robin')}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-gray-900">
                Round Robin
              </span>
              <span className="block text-sm text-gray-500">
                Automatically distribute applications evenly among selected assessors.
                Each application will be assigned to {call.assessorsPerApplication}{' '}
                assessor{call.assessorsPerApplication !== 1 ? 's' : ''}.
              </span>
            </div>
          </label>
          <label className="flex items-start">
            <input
              type="radio"
              name="method"
              value="manual"
              checked={assignmentMethod === 'manual'}
              onChange={() => setAssignmentMethod('manual')}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-gray-900">
                Manual Assignment
              </span>
              <span className="block text-sm text-gray-500">
                Assign all selected applications to all selected assessors.
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Applications Selection */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Applications</h2>
              <p className="text-sm text-gray-500">
                {selectedApplications.length} of {eligibleApplications.length} selected
              </p>
            </div>
            <button
              onClick={handleSelectAllApplications}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {selectedApplications.length === eligibleApplications.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {eligibleApplications.length === 0 ? (
              <p className="p-4 text-center text-gray-500">
                No applications available for assignment.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {eligibleApplications.map((app) => (
                  <ApplicationItem
                    key={app.id}
                    application={app}
                    selected={selectedApplications.includes(app.id)}
                    onToggle={(id) => {
                      if (selectedApplications.includes(id)) {
                        setSelectedApplications(
                          selectedApplications.filter((a) => a !== id)
                        );
                      } else {
                        setSelectedApplications([...selectedApplications, id]);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Assessors Selection */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Assessors</h2>
              <p className="text-sm text-gray-500">
                {selectedAssessors.length} of {assessors.length} selected
              </p>
            </div>
            <button
              onClick={handleSelectAllAssessors}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {selectedAssessors.length === assessors.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {assessors.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-gray-500 mb-2">No assessors in pool.</p>
                <Link
                  to={`/coordinator/calls/${callId}/assessors`}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Add Assessors
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {assessors.map((assessor) => (
                  <AssessorItem
                    key={assessor.id}
                    assessor={assessor}
                    selected={selectedAssessors.includes(assessor.id)}
                    onToggle={(id) => {
                      if (selectedAssessors.includes(id)) {
                        setSelectedAssessors(
                          selectedAssessors.filter((a) => a !== id)
                        );
                      } else {
                        setSelectedAssessors([...selectedAssessors, id]);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Summary & Actions */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Assignment Summary</h3>
            <p className="text-sm text-gray-500 mt-1">
              {getEstimatedAssignments()} assignment
              {getEstimatedAssignments() !== 1 ? 's' : ''} will be created
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/coordinator/calls/${callId}/applications`}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={
                selectedApplications.length === 0 || selectedAssessors.length === 0
              }
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Assignments
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleAssign}
        title="Confirm Assignments"
        message={`You are about to assign ${selectedApplications.length} application(s) to ${selectedAssessors.length} assessor(s). This will create ${getEstimatedAssignments()} assignment(s).`}
        confirmText="Create Assignments"
        isLoading={assigning}
      />
    </div>
  );
}

// =============================================================================
// ApplicationItem Component
// =============================================================================

interface ApplicationItemProps {
  application: ApplicationSummary;
  selected: boolean;
  onToggle: (id: string) => void;
}

function ApplicationItem({ application, selected, onToggle }: ApplicationItemProps) {
  return (
    <li
      className={`p-4 hover:bg-gray-50 cursor-pointer ${
        selected ? 'bg-indigo-50' : ''
      }`}
      onClick={() => onToggle(application.id)}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(application.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {application.reference}
          </p>
          <p className="text-sm text-gray-500">{application.applicantName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {application.assignmentCount} assigned
          </p>
        </div>
      </div>
    </li>
  );
}

// =============================================================================
// AssessorItem Component
// =============================================================================

interface AssessorItemProps {
  assessor: AssessorPoolMember;
  selected: boolean;
  onToggle: (id: string) => void;
}

function AssessorItem({ assessor, selected, onToggle }: AssessorItemProps) {
  return (
    <li
      className={`p-4 hover:bg-gray-50 cursor-pointer ${
        selected ? 'bg-indigo-50' : ''
      }`}
      onClick={() => onToggle(assessor.id)}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(assessor.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">{assessor.name}</p>
          <p className="text-sm text-gray-500">{assessor.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {assessor.assignedCount} assigned, {assessor.completedCount} completed
          </p>
        </div>
      </div>
    </li>
  );
}
