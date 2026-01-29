// =============================================================================
// Progress Component - Funding Application Platform
// Linear and circular progress indicators
// =============================================================================

import { HTMLAttributes, forwardRef, useMemo } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Size of the progress bar */
  size?: ProgressSize;
  /** Show progress label */
  showLabel?: boolean;
  /** Custom label format */
  labelFormat?: (value: number, max: number) => string;
  /** Indeterminate loading state */
  indeterminate?: boolean;
  /** Animated stripes */
  striped?: boolean;
  /** Animate the stripes */
  animated?: boolean;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const variantStyles: Record<ProgressVariant, string> = {
  default: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

const trackStyles: Record<ProgressVariant, string> = {
  default: 'bg-primary-100',
  success: 'bg-green-100',
  warning: 'bg-amber-100',
  error: 'bg-red-100',
  info: 'bg-blue-100',
};

const sizeStyles: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

// -----------------------------------------------------------------------------
// Linear Progress Component
// -----------------------------------------------------------------------------

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      showLabel = false,
      labelFormat,
      indeterminate = false,
      striped = false,
      animated = false,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const label = useMemo(() => {
      if (labelFormat) {
        return labelFormat(value, max);
      }
      return `${Math.round(percentage)}%`;
    }, [labelFormat, value, max, percentage]);

    return (
      <div className={clsx('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-900">{label}</span>
          </div>
        )}
        <div
          ref={ref}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={indeterminate ? 'Loading' : `${Math.round(percentage)}% complete`}
          className={clsx(
            'w-full overflow-hidden rounded-full',
            trackStyles[variant],
            sizeStyles[size]
          )}
        >
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300 ease-out',
              variantStyles[variant],
              striped && [
                'bg-[length:1rem_1rem]',
                'bg-gradient-to-r',
                'from-[rgba(255,255,255,0.15)] via-[rgba(255,255,255,0.15)] to-transparent',
                '[background-image:linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]',
              ],
              animated && striped && 'animate-[progress-stripes_1s_linear_infinite]',
              indeterminate && [
                'w-1/3',
                'animate-[indeterminate_1.5s_ease-in-out_infinite]',
              ]
            )}
            style={indeterminate ? undefined : { width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

// -----------------------------------------------------------------------------
// Circular Progress Component
// -----------------------------------------------------------------------------

export interface CircularProgressProps extends Omit<HTMLAttributes<SVGSVGElement>, 'children'> {
  /** Current progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Show value in center */
  showValue?: boolean;
  /** Custom value format */
  valueFormat?: (value: number, max: number) => string;
  /** Indeterminate loading state */
  indeterminate?: boolean;
}

const circularVariantStyles: Record<ProgressVariant, { stroke: string; track: string }> = {
  default: { stroke: '#1d70b8', track: '#c5ddef' },
  success: { stroke: '#00703c', track: '#c0e4cc' },
  warning: { stroke: '#f0d100', track: '#fff0bf' },
  error: { stroke: '#d4351c', track: '#f5c8c2' },
  info: { stroke: '#2e8aca', track: '#c0e1f2' },
};

export function CircularProgress({
  value,
  max = 100,
  variant = 'default',
  size = 64,
  strokeWidth = 4,
  showValue = true,
  valueFormat,
  indeterminate = false,
  className,
  ...props
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colors = circularVariantStyles[variant];

  const displayValue = useMemo(() => {
    if (valueFormat) {
      return valueFormat(value, max);
    }
    return `${Math.round(percentage)}%`;
  }, [valueFormat, value, max, percentage]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={indeterminate ? 'Loading' : `${Math.round(percentage)}% complete`}
      className={clsx(indeterminate && 'animate-spin', className)}
      {...props}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.track}
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={indeterminate ? circumference * 0.75 : strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={clsx(
          'transition-all duration-300 ease-out',
          indeterminate && 'origin-center'
        )}
      />
      {/* Center Value */}
      {showValue && !indeterminate && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-sm font-semibold"
          fill="currentColor"
        >
          {displayValue}
        </text>
      )}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Progress Steps Component
// -----------------------------------------------------------------------------

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'current' | 'complete' | 'error';
}

export interface ProgressStepsProps extends HTMLAttributes<HTMLDivElement> {
  steps: ProgressStep[];
  orientation?: 'horizontal' | 'vertical';
}

export function ProgressSteps({
  steps,
  orientation = 'horizontal',
  className,
  ...props
}: ProgressStepsProps) {
  return (
    <div
      className={clsx(
        'flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row items-center',
        className
      )}
      aria-label="Progress"
      {...props}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.id}
            className={clsx(
              'flex',
              orientation === 'vertical'
                ? 'flex-row items-start'
                : 'flex-col items-center flex-1'
            )}
          >
            {/* Step Indicator */}
            <div className="flex items-center">
              <div
                className={clsx(
                  'flex items-center justify-center rounded-full font-semibold text-sm',
                  'w-8 h-8 flex-shrink-0',
                  'transition-colors duration-200',
                  {
                    'bg-gray-200 text-gray-500': step.status === 'pending',
                    'bg-primary-500 text-white ring-4 ring-primary-100': step.status === 'current',
                    'bg-green-500 text-white': step.status === 'complete',
                    'bg-red-500 text-white': step.status === 'error',
                  }
                )}
                aria-current={step.status === 'current' ? 'step' : undefined}
              >
                {step.status === 'complete' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : step.status === 'error' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Connector Line */}
              {!isLast && orientation === 'horizontal' && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-2 min-w-[2rem]',
                    step.status === 'complete' ? 'bg-green-500' : 'bg-gray-200'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Step Content */}
            <div
              className={clsx(
                'mt-2',
                orientation === 'vertical' && 'ml-4 pb-8',
                orientation === 'horizontal' && 'text-center'
              )}
            >
              <p
                className={clsx(
                  'text-sm font-medium',
                  step.status === 'current' ? 'text-primary-600' : 'text-gray-900'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-xs text-gray-500">{step.description}</p>
              )}
            </div>

            {/* Vertical Connector */}
            {!isLast && orientation === 'vertical' && (
              <div
                className={clsx(
                  'absolute left-4 top-8 -ml-px mt-0.5 w-0.5 h-full',
                  step.status === 'complete' ? 'bg-green-500' : 'bg-gray-200'
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Add keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes progress-stripes {
    from {
      background-position: 1rem 0;
    }
    to {
      background-position: 0 0;
    }
  }

  @keyframes indeterminate {
    0% {
      margin-left: -33%;
    }
    100% {
      margin-left: 100%;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(styleSheet);
}

export default Progress;
