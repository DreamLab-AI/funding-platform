// =============================================================================
// Stepper Component - Funding Application Platform
// Multi-step form progress indicator
// =============================================================================

import { HTMLAttributes, createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type StepStatus = 'pending' | 'current' | 'complete' | 'error' | 'skipped';

export interface Step {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
}

export interface StepperContextValue {
  currentStep: number;
  steps: Step[];
  orientation: 'horizontal' | 'vertical';
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  getStepStatus: (index: number) => StepStatus;
  completedSteps: Set<number>;
  errorSteps: Set<number>;
  skippedSteps: Set<number>;
  setStepComplete: (index: number) => void;
  setStepError: (index: number) => void;
  setStepSkipped: (index: number) => void;
  clearStepStatus: (index: number) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const StepperContext = createContext<StepperContextValue | null>(null);

export function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error('Stepper components must be used within a StepperProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Stepper Provider
// -----------------------------------------------------------------------------

export interface StepperProviderProps {
  children: ReactNode;
  steps: Step[];
  initialStep?: number;
  orientation?: 'horizontal' | 'vertical';
  onStepChange?: (step: number) => void;
  allowClickNavigation?: boolean;
}

export function StepperProvider({
  children,
  steps,
  initialStep = 0,
  orientation = 'horizontal',
  onStepChange,
  allowClickNavigation = false,
}: StepperProviderProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errorSteps, setErrorSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        if (!allowClickNavigation && index > currentStep + 1) {
          return; // Can't skip ahead unless allowed
        }
        setCurrentStep(index);
        onStepChange?.(index);
      }
    },
    [steps.length, currentStep, allowClickNavigation, onStepChange]
  );

  const nextStep = useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const getStepStatus = useCallback(
    (index: number): StepStatus => {
      if (errorSteps.has(index)) return 'error';
      if (skippedSteps.has(index)) return 'skipped';
      if (completedSteps.has(index)) return 'complete';
      if (index === currentStep) return 'current';
      return 'pending';
    },
    [currentStep, completedSteps, errorSteps, skippedSteps]
  );

  const setStepComplete = useCallback((index: number) => {
    setCompletedSteps((prev) => new Set(prev).add(index));
    setErrorSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setSkippedSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const setStepError = useCallback((index: number) => {
    setErrorSteps((prev) => new Set(prev).add(index));
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const setStepSkipped = useCallback((index: number) => {
    setSkippedSteps((prev) => new Set(prev).add(index));
  }, []);

  const clearStepStatus = useCallback((index: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setErrorSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setSkippedSteps((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const canGoBack = !isFirstStep;
  const canGoForward = !isLastStep;

  const value = useMemo(
    () => ({
      currentStep,
      steps,
      orientation,
      goToStep,
      nextStep,
      prevStep,
      getStepStatus,
      completedSteps,
      errorSteps,
      skippedSteps,
      setStepComplete,
      setStepError,
      setStepSkipped,
      clearStepStatus,
      isFirstStep,
      isLastStep,
      canGoBack,
      canGoForward,
    }),
    [
      currentStep,
      steps,
      orientation,
      goToStep,
      nextStep,
      prevStep,
      getStepStatus,
      completedSteps,
      errorSteps,
      skippedSteps,
      setStepComplete,
      setStepError,
      setStepSkipped,
      clearStepStatus,
      isFirstStep,
      isLastStep,
      canGoBack,
      canGoForward,
    ]
  );

  return <StepperContext.Provider value={value}>{children}</StepperContext.Provider>;
}

// Need to import useState for the provider
import { useState } from 'react';

// -----------------------------------------------------------------------------
// Stepper Component
// -----------------------------------------------------------------------------

export interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  /** Allow clicking on steps to navigate */
  clickable?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show step numbers */
  showNumbers?: boolean;
}

export function Stepper({
  clickable = false,
  size = 'md',
  showNumbers = true,
  className,
  ...props
}: StepperProps) {
  const { steps, currentStep, orientation, goToStep, getStepStatus, completedSteps } =
    useStepperContext();

  const sizeStyles = {
    sm: {
      indicator: 'w-6 h-6 text-xs',
      connector: 'h-0.5',
      verticalConnector: 'w-0.5',
      text: 'text-xs',
    },
    md: {
      indicator: 'w-8 h-8 text-sm',
      connector: 'h-0.5',
      verticalConnector: 'w-0.5',
      text: 'text-sm',
    },
    lg: {
      indicator: 'w-10 h-10 text-base',
      connector: 'h-1',
      verticalConnector: 'w-1',
      text: 'text-base',
    },
  };

  const sizeStyle = sizeStyles[size];

  const getIndicatorContent = (index: number, status: StepStatus) => {
    if (status === 'complete') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    if (status === 'error') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    if (status === 'skipped') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
      );
    }
    return showNumbers ? index + 1 : null;
  };

  const getIndicatorStyles = (status: StepStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500 text-white border-green-500';
      case 'current':
        return 'bg-primary-500 text-white border-primary-500 ring-4 ring-primary-100';
      case 'error':
        return 'bg-red-500 text-white border-red-500';
      case 'skipped':
        return 'bg-gray-300 text-gray-600 border-gray-300';
      case 'pending':
      default:
        return 'bg-white text-gray-500 border-gray-300';
    }
  };

  const handleStepClick = (index: number) => {
    if (!clickable) return;
    // Can only click on completed steps or the next step
    const canNavigate =
      completedSteps.has(index) || index === currentStep || index === currentStep + 1;
    if (canNavigate) {
      goToStep(index);
    }
  };

  if (orientation === 'vertical') {
    return (
      <nav aria-label="Progress" className={className} {...props}>
        <ol className="space-y-4">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="relative">
                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={clsx(
                      'absolute left-4 top-8 -translate-x-1/2',
                      sizeStyle.verticalConnector,
                      'h-full',
                      status === 'complete' ? 'bg-green-500' : 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start group">
                  {/* Step Indicator */}
                  <button
                    type="button"
                    onClick={() => handleStepClick(index)}
                    disabled={!clickable}
                    className={clsx(
                      'flex items-center justify-center rounded-full border-2 font-semibold',
                      'transition-all duration-200',
                      sizeStyle.indicator,
                      getIndicatorStyles(status),
                      clickable && 'cursor-pointer hover:ring-2 hover:ring-primary-200',
                      !clickable && 'cursor-default'
                    )}
                    aria-current={status === 'current' ? 'step' : undefined}
                  >
                    {getIndicatorContent(index, status)}
                  </button>

                  {/* Step Content */}
                  <div className="ml-4 min-w-0 flex-1">
                    <p
                      className={clsx(
                        'font-medium',
                        sizeStyle.text,
                        status === 'current' ? 'text-primary-600' : 'text-gray-900'
                      )}
                    >
                      {step.title}
                      {step.optional && (
                        <span className="ml-1 text-gray-400 font-normal">(Optional)</span>
                      )}
                    </p>
                    {step.description && (
                      <p className={clsx('mt-0.5 text-gray-500', sizeStyle.text)}>
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Horizontal orientation
  return (
    <nav aria-label="Progress" className={className} {...props}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={clsx('relative', !isLast && 'flex-1')}>
              <div className="flex items-center">
                {/* Step Indicator */}
                <button
                  type="button"
                  onClick={() => handleStepClick(index)}
                  disabled={!clickable}
                  className={clsx(
                    'flex items-center justify-center rounded-full border-2 font-semibold',
                    'transition-all duration-200 z-10 relative',
                    sizeStyle.indicator,
                    getIndicatorStyles(status),
                    clickable && 'cursor-pointer hover:ring-2 hover:ring-primary-200',
                    !clickable && 'cursor-default'
                  )}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {getIndicatorContent(index, status)}
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={clsx(
                      'flex-1 mx-2',
                      sizeStyle.connector,
                      status === 'complete' ? 'bg-green-500' : 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Step Label */}
              <div className={clsx('mt-2', !isLast && 'pr-4')}>
                <p
                  className={clsx(
                    'font-medium',
                    sizeStyle.text,
                    status === 'current' ? 'text-primary-600' : 'text-gray-900'
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className={clsx('mt-0.5 text-gray-500 text-xs')}>
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Step Content Component
// -----------------------------------------------------------------------------

export interface StepContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Step index this content belongs to */
  step: number;
  /** Force show even if not current step */
  forceShow?: boolean;
}

export function StepContent({ step, forceShow = false, children, className, ...props }: StepContentProps) {
  const { currentStep } = useStepperContext();

  if (!forceShow && step !== currentStep) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      aria-label={`Step ${step + 1} content`}
      className={clsx('animate-fade-in', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Stepper Navigation Component
// -----------------------------------------------------------------------------

export interface StepperNavigationProps extends HTMLAttributes<HTMLDivElement> {
  /** Back button text */
  backLabel?: string;
  /** Next button text */
  nextLabel?: string;
  /** Submit button text (shown on last step) */
  submitLabel?: string;
  /** Called when back is clicked */
  onBack?: () => void;
  /** Called when next is clicked */
  onNext?: () => void;
  /** Called when submit is clicked on last step */
  onSubmit?: () => void;
  /** Disable next/submit button */
  disableNext?: boolean;
  /** Show skip button for optional steps */
  showSkip?: boolean;
  /** Skip button text */
  skipLabel?: string;
  /** Called when skip is clicked */
  onSkip?: () => void;
}

export function StepperNavigation({
  backLabel = 'Back',
  nextLabel = 'Continue',
  submitLabel = 'Submit',
  onBack,
  onNext,
  onSubmit,
  disableNext = false,
  showSkip = false,
  skipLabel = 'Skip',
  onSkip,
  className,
  ...props
}: StepperNavigationProps) {
  const { prevStep, nextStep, isFirstStep, isLastStep, steps, currentStep, setStepSkipped } =
    useStepperContext();

  const currentStepData = steps[currentStep];
  const canSkip = showSkip && currentStepData?.optional;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      nextStep();
    }
  };

  const handleSkip = () => {
    setStepSkipped(currentStep);
    if (onSkip) {
      onSkip();
    } else {
      nextStep();
    }
  };

  return (
    <div
      className={clsx('flex items-center justify-between pt-6', className)}
      {...props}
    >
      <div>
        {!isFirstStep && (
          <button
            type="button"
            onClick={handleBack}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2',
              'text-sm font-medium text-gray-700',
              'bg-white border border-gray-300 rounded-md',
              'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              'transition-colors duration-150'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {canSkip && (
          <button
            type="button"
            onClick={handleSkip}
            className={clsx(
              'px-4 py-2 text-sm font-medium text-gray-500',
              'hover:text-gray-700 focus:outline-none focus:underline',
              'transition-colors duration-150'
            )}
          >
            {skipLabel}
          </button>
        )}

        {isLastStep ? (
          <button
            type="submit"
            onClick={onSubmit}
            disabled={disableNext}
            className={clsx(
              'inline-flex items-center gap-2 px-6 py-2',
              'text-sm font-medium text-white',
              'bg-green-600 border border-transparent rounded-md',
              'hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150'
            )}
          >
            {submitLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={disableNext}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2',
              'text-sm font-medium text-white',
              'bg-primary-600 border border-transparent rounded-md',
              'hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150'
            )}
          >
            {nextLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Stepper;
