// =============================================================================
// ApplicationForm Page - Application submission form
// =============================================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCall } from '../../hooks/useCalls';
import { useApplication, useApplicationMutations } from '../../hooks/useApplications';
import { useToast } from '../../components/Common/Toast';
import { FileUpload } from '../../components/Forms/FileUpload';
import { ConfirmationCheckboxGroup } from '../../components/Forms/ConfirmationCheckbox';
import { StepProgress } from '../../components/Common/ProgressBar';
import { InlineLoader } from '../../components/Common/LoadingSpinner';
import { ConfirmModal } from '../../components/Common/Modal';
import { ConfirmationType, ApplicationStatus } from '../../types';

interface ConfirmationsData {
  [ConfirmationType.GUIDANCE_READ]: boolean;
  [ConfirmationType.EDI_COMPLETED]: boolean;
  [ConfirmationType.DATA_SHARING_CONSENT]: boolean;
}

interface FormData {
  confirmations: ConfirmationsData;
}

const STEPS = [
  { id: 'upload', name: 'Upload Documents', description: 'Application form and supporting materials' },
  { id: 'confirm', name: 'Confirmations', description: 'Required acknowledgements' },
  { id: 'review', name: 'Review & Submit', description: 'Final review' },
];

export function ApplicationForm() {
  const { callId, applicationId } = useParams<{ callId: string; applicationId?: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const { call, isLoading: callLoading, error: callError } = useCall(callId);
  const { application, isLoading: appLoading, refetch } = useApplication(applicationId);
  const {
    createApplication,
    uploadFile,
    deleteFile,
    submitApplication,
    isLoading: mutating,
    uploadProgress,
    error: mutationError,
  } = useApplicationMutations();

  const [currentStep, setCurrentStep] = useState(0);
  const [currentApplication, setCurrentApplication] = useState(application);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const { watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      confirmations: {
        [ConfirmationType.GUIDANCE_READ]: false,
        [ConfirmationType.EDI_COMPLETED]: false,
        [ConfirmationType.DATA_SHARING_CONSENT]: false,
      },
    },
  });

  const confirmations = watch('confirmations');

  // Update current application when loaded
  useEffect(() => {
    if (application) {
      setCurrentApplication(application);
      // Restore confirmation state
      const newConfirmations: Record<ConfirmationType, boolean> = {
        [ConfirmationType.GUIDANCE_READ]: false,
        [ConfirmationType.EDI_COMPLETED]: false,
        [ConfirmationType.DATA_SHARING_CONSENT]: false,
      };
      application.confirmations.forEach((c) => {
        newConfirmations[c.type] = true;
      });
      setValue('confirmations', newConfirmations);
    }
  }, [application, setValue]);

  // Create application if none exists
  useEffect(() => {
    const initApplication = async () => {
      if (!applicationId && callId && call && !currentApplication) {
        try {
          const newApp = await createApplication({ callId });
          setCurrentApplication(newApp);
          navigate(`/apply/${callId}/${newApp.id}`, { replace: true });
        } catch {
          // Error handled by mutation
        }
      }
    };
    initApplication();
  }, [callId, applicationId, call, currentApplication, createApplication, navigate]);

  const handleFileUpload = async (file: File) => {
    if (!currentApplication) return;
    try {
      const updated = await uploadFile(currentApplication.id, file);
      setCurrentApplication(updated);
      success('File uploaded', `${file.name} has been uploaded successfully.`);
    } catch {
      // Error handled by mutation
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!currentApplication) return;
    try {
      await deleteFile(currentApplication.id, fileId);
      await refetch();
      success('File removed', 'The file has been removed from your application.');
    } catch {
      // Error handled by mutation
    }
  };

  const handleConfirmationChange = (type: ConfirmationType, checked: boolean) => {
    // Update nested confirmation field using type-safe path
    const currentConfirmations = { ...confirmations, [type]: checked };
    setValue('confirmations', currentConfirmations as ConfirmationsData);
  };

  const handleSubmit = async () => {
    if (!currentApplication || !call) return;

    const confirmedTypes = Object.entries(confirmations)
      .filter(([_, checked]) => checked)
      .map(([type]) => type as ConfirmationType);

    try {
      await submitApplication(currentApplication.id, { confirmations: confirmedTypes });
      success('Application submitted', 'Your application has been successfully submitted.');
      navigate(`/apply/${callId}/${currentApplication.id}/confirmation`);
    } catch {
      showError('Submission failed', mutationError || 'Please try again.');
    }
  };

  const canProceedToStep = (step: number): boolean => {
    if (!currentApplication || !call) return false;

    switch (step) {
      case 1: // Confirmations
        return currentApplication.files.length > 0;
      case 2: // Review
        const requiredConfirmations = call.requirements.requiredConfirmations;
        return requiredConfirmations.every((type) => confirmations[type]);
      default:
        return true;
    }
  };

  const isDeadlinePassed = () => {
    if (!call) return false;
    return new Date(call.closeAt) < new Date();
  };

  if (callLoading || appLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InlineLoader message="Loading application..." />
      </div>
    );
  }

  if (callError || !call) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{callError || 'Call not found'}</p>
        </div>
      </div>
    );
  }

  if (isDeadlinePassed()) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4 text-center">
          <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800">Deadline Passed</h3>
          <p className="mt-2 text-sm text-red-700">
            The deadline for this funding call has passed. Applications are no longer being accepted.
          </p>
        </div>
      </div>
    );
  }

  if (currentApplication?.status === ApplicationStatus.SUBMITTED) {
    navigate(`/apply/${callId}/${currentApplication.id}/confirmation`);
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{call.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Deadline: {new Date(call.closeAt).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London',
          })}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <StepProgress
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep || canProceedToStep(step)) {
              setCurrentStep(step);
            }
          }}
        />
      </div>

      {/* Error Display */}
      {mutationError && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{mutationError}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Upload Documents</h2>
              {call.requirements.guidanceText && (
                <p className="text-sm text-gray-600 mb-4">{call.requirements.guidanceText}</p>
              )}
              {call.requirements.guidanceUrl && (
                <a
                  href={call.requirements.guidanceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-500 mb-4 inline-block"
                >
                  View guidance document
                </a>
              )}
            </div>

            <FileUpload
              files={currentApplication?.files || []}
              onUpload={handleFileUpload}
              onDelete={handleFileDelete}
              allowedTypes={call.requirements.allowedFileTypes}
              maxSize={call.requirements.maxFileSize}
              maxFiles={call.requirements.maxFiles}
              uploadProgress={uploadProgress}
              isUploading={mutating}
              disabled={mutating}
            />

            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep(1)}
                disabled={!canProceedToStep(1)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Confirmations
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <ConfirmationCheckboxGroup
              requiredConfirmations={call.requirements.requiredConfirmations}
              values={confirmations}
              onChange={handleConfirmationChange}
              guidanceUrl={call.requirements.guidanceUrl}
              ediUrl={call.requirements.ediUrl}
            />

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(0)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToStep(2)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Review
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Review Your Application</h2>

            {/* Files Summary */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files</h3>
              <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                {currentApplication?.files.map((file) => (
                  <li key={file.id} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-900">{file.originalFilename}</span>
                    <span className="text-sm text-gray-500">
                      {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmations Summary */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Confirmations</h3>
              <ul className="space-y-2">
                {call.requirements.requiredConfirmations.map((type) => (
                  <li key={type} className="flex items-center text-sm">
                    <svg
                      className={`h-5 w-5 mr-2 ${
                        confirmations[type] ? 'text-green-500' : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className={confirmations[type] ? 'text-gray-900' : 'text-gray-500'}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={mutating}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Submit Application
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        title="Submit Application"
        message="Are you sure you want to submit your application? Once submitted, you will not be able to make changes unless reopened by the coordinator."
        confirmText="Submit Application"
        variant="info"
        isLoading={mutating}
      />
    </div>
  );
}
