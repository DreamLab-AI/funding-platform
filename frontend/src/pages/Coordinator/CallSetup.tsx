// =============================================================================
// CallSetup Page - Create/Edit Funding Call
// =============================================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useCall, useCallMutations } from '../../hooks/useCalls';
import { useToast } from '../../components/Common/Toast';
import { StepProgress } from '../../components/Common/ProgressBar';
import { InlineLoader, ButtonLoader } from '../../components/Common/LoadingSpinner';
import { ConfirmationType, Criterion, SubmissionRequirements } from '../../types';

interface CallFormData {
  name: string;
  description: string;
  openAt: string;
  closeAt: string;
  allowedFileTypes: string[];
  maxFileSize: number;
  maxFiles: number;
  guidanceText: string;
  guidanceUrl: string;
  ediUrl: string;
  requiredConfirmations: ConfirmationType[];
  assessorsPerApplication: number;
  varianceThreshold: number;
  criteria: Criterion[];
}

const STEPS = [
  { id: 'basic', name: 'Basic Information' },
  { id: 'requirements', name: 'Submission Requirements' },
  { id: 'criteria', name: 'Assessment Criteria' },
  { id: 'review', name: 'Review & Save' },
];

const FILE_TYPE_OPTIONS = [
  { value: '.pdf', label: 'PDF (.pdf)' },
  { value: '.doc', label: 'Word (.doc)' },
  { value: '.docx', label: 'Word (.docx)' },
  { value: '.xls', label: 'Excel (.xls)' },
  { value: '.xlsx', label: 'Excel (.xlsx)' },
  { value: '.ppt', label: 'PowerPoint (.ppt)' },
  { value: '.pptx', label: 'PowerPoint (.pptx)' },
];

export function CallSetup() {
  const { callId } = useParams<{ callId?: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const isEditing = Boolean(callId);
  const { call, isLoading: callLoading } = useCall(callId);
  const { createCall, updateCall, isLoading: mutating, error: mutationError } = useCallMutations();

  const [currentStep, setCurrentStep] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CallFormData>({
    defaultValues: {
      name: '',
      description: '',
      openAt: '',
      closeAt: '',
      allowedFileTypes: ['.pdf', '.docx'],
      maxFileSize: 50,
      maxFiles: 10,
      guidanceText: '',
      guidanceUrl: '',
      ediUrl: '',
      requiredConfirmations: [
        ConfirmationType.GUIDANCE_READ,
        ConfirmationType.DATA_SHARING_CONSENT,
      ],
      assessorsPerApplication: 2,
      varianceThreshold: 20,
      criteria: [
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          maxPoints: 10,
          weight: 1,
          commentsRequired: false,
        },
      ],
    },
  });

  const { fields: criteriaFields, append: appendCriterion, remove: removeCriterion } = useFieldArray({
    control,
    name: 'criteria',
  });

  const watchedData = watch();

  // Load existing call data
  useEffect(() => {
    if (call && isEditing) {
      setValue('name', call.name);
      setValue('description', call.description);
      setValue('openAt', call.openAt.slice(0, 16));
      setValue('closeAt', call.closeAt.slice(0, 16));
      setValue('allowedFileTypes', call.requirements.allowedFileTypes);
      setValue('maxFileSize', call.requirements.maxFileSize / (1024 * 1024));
      setValue('maxFiles', call.requirements.maxFiles);
      setValue('guidanceText', call.requirements.guidanceText || '');
      setValue('guidanceUrl', call.requirements.guidanceUrl || '');
      setValue('ediUrl', call.requirements.ediUrl || '');
      setValue('requiredConfirmations', call.requirements.requiredConfirmations);
      setValue('assessorsPerApplication', call.assessorsPerApplication);
      setValue('varianceThreshold', call.varianceThreshold || 20);
      setValue('criteria', call.criteria);
    }
  }, [call, isEditing, setValue]);

  const onSubmit = async (data: CallFormData) => {
    const requirements: SubmissionRequirements = {
      allowedFileTypes: data.allowedFileTypes,
      maxFileSize: data.maxFileSize * 1024 * 1024,
      maxFiles: data.maxFiles,
      guidanceText: data.guidanceText || undefined,
      guidanceUrl: data.guidanceUrl || undefined,
      ediUrl: data.ediUrl || undefined,
      requiredConfirmations: data.requiredConfirmations,
    };

    const callData = {
      name: data.name,
      description: data.description,
      openAt: new Date(data.openAt).toISOString(),
      closeAt: new Date(data.closeAt).toISOString(),
      requirements,
      criteria: data.criteria,
      assessorsPerApplication: data.assessorsPerApplication,
      varianceThreshold: data.varianceThreshold,
    };

    try {
      if (isEditing && callId) {
        await updateCall(callId, callData);
        success('Call updated', 'The funding call has been updated successfully.');
      } else {
        const newCall = await createCall(callData);
        success('Call created', 'The funding call has been created successfully.');
        navigate(`/coordinator/calls/${newCall.id}`);
        return;
      }
      navigate('/coordinator/calls');
    } catch {
      showError('Save failed', mutationError || 'Please try again.');
    }
  };

  if (callLoading && isEditing) {
    return (
      <div className="py-8">
        <InlineLoader message="Loading call..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Funding Call' : 'Create New Funding Call'}
        </h1>
        <p className="text-gray-500">
          {isEditing
            ? 'Update the funding call settings and requirements.'
            : 'Set up a new funding call with deadlines, requirements, and assessment criteria.'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <StepProgress
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Call Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="e.g., Business Growth Fund 2026"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('description', { required: 'Description is required' })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Describe the funding opportunity..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Open Date/Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    {...register('openAt', { required: 'Open date is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Close Date/Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    {...register('closeAt', { required: 'Close date is required' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500">
                All times are in Europe/London timezone.
              </p>
            </div>
          )}

          {/* Step 2: Submission Requirements */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Submission Requirements</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed File Types
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        value={option.value}
                        {...register('allowedFileTypes')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max File Size (MB)
                  </label>
                  <input
                    type="number"
                    {...register('maxFileSize', { min: 1, max: 100 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Files per Application
                  </label>
                  <input
                    type="number"
                    {...register('maxFiles', { min: 1, max: 20 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Guidance Text
                </label>
                <textarea
                  {...register('guidanceText')}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Instructions for applicants..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Guidance Document URL
                  </label>
                  <input
                    type="url"
                    {...register('guidanceUrl')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    EDI Form URL
                  </label>
                  <input
                    type="url"
                    {...register('ediUrl')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Required Confirmations
                </label>
                <div className="space-y-2">
                  {Object.values(ConfirmationType).map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        value={type}
                        {...register('requiredConfirmations')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Assessment Criteria */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Assessment Criteria</h2>
                <button
                  type="button"
                  onClick={() =>
                    appendCriterion({
                      id: crypto.randomUUID(),
                      name: '',
                      description: '',
                      maxPoints: 10,
                      weight: 1,
                      commentsRequired: false,
                    })
                  }
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Criterion
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Assessors per Application
                  </label>
                  <input
                    type="number"
                    {...register('assessorsPerApplication', { min: 1, max: 5 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Variance Threshold (%)
                  </label>
                  <input
                    type="number"
                    {...register('varianceThreshold', { min: 5, max: 50 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Flag results where scores vary by more than this percentage.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {criteriaFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-4 relative"
                  >
                    {criteriaFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCriterion(index)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Criterion Name
                        </label>
                        <input
                          type="text"
                          {...register(`criteria.${index}.name`, { required: true })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Max Points
                          </label>
                          <input
                            type="number"
                            {...register(`criteria.${index}.maxPoints`, { min: 1 })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Weight
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            {...register(`criteria.${index}.weight`)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        {...register(`criteria.${index}.description`)}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register(`criteria.${index}.commentsRequired`)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Require comments for this criterion
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">Review & Save</h2>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Call Name</h3>
                  <p className="text-gray-900">{watchedData.name || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Description</h3>
                  <p className="text-gray-900">{watchedData.description || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Open Date</h3>
                    <p className="text-gray-900">
                      {watchedData.openAt
                        ? new Date(watchedData.openAt).toLocaleString('en-GB')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Close Date</h3>
                    <p className="text-gray-900">
                      {watchedData.closeAt
                        ? new Date(watchedData.closeAt).toLocaleString('en-GB')
                        : '-'}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Assessment Criteria</h3>
                  <p className="text-gray-900">
                    {watchedData.criteria.filter((c) => c.name).length} criteria,{' '}
                    {watchedData.assessorsPerApplication} assessors per application
                  </p>
                </div>
              </div>

              {mutationError && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-700">{mutationError}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {mutating && <ButtonLoader />}
                {isEditing ? 'Update Call' : 'Create Call'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
