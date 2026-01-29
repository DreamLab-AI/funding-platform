// =============================================================================
// ScoreInput Component - Funding Application Platform
// Slider/numeric input for assessment scoring
// =============================================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  HTMLAttributes,
  forwardRef,
} from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ScoreInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current score value */
  value?: number;
  /** Called when score changes */
  onChange?: (value: number) => void;
  /** Minimum score */
  min?: number;
  /** Maximum score */
  max?: number;
  /** Step increment */
  step?: number;
  /** Score label/name */
  label?: string;
  /** Description of what's being scored */
  description?: string;
  /** Weight multiplier (optional) */
  weight?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Error message */
  error?: string;
  /** Show slider */
  showSlider?: boolean;
  /** Show numeric input */
  showNumericInput?: boolean;
  /** Show score breakdown */
  showBreakdown?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color scheme based on score */
  colorize?: boolean;
}

// -----------------------------------------------------------------------------
// Score Color Utilities
// -----------------------------------------------------------------------------

function getScoreColor(percentage: number): {
  text: string;
  bg: string;
  slider: string;
} {
  if (percentage >= 80) {
    return {
      text: 'text-green-600',
      bg: 'bg-green-100',
      slider: 'accent-green-500',
    };
  }
  if (percentage >= 60) {
    return {
      text: 'text-lime-600',
      bg: 'bg-lime-100',
      slider: 'accent-lime-500',
    };
  }
  if (percentage >= 40) {
    return {
      text: 'text-amber-600',
      bg: 'bg-amber-100',
      slider: 'accent-amber-500',
    };
  }
  if (percentage >= 20) {
    return {
      text: 'text-orange-600',
      bg: 'bg-orange-100',
      slider: 'accent-orange-500',
    };
  }
  return {
    text: 'text-red-600',
    bg: 'bg-red-100',
    slider: 'accent-red-500',
  };
}

// -----------------------------------------------------------------------------
// ScoreInput Component
// -----------------------------------------------------------------------------

export const ScoreInput = forwardRef<HTMLDivElement, ScoreInputProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 10,
      step = 1,
      label,
      description,
      weight,
      disabled = false,
      readOnly = false,
      error,
      showSlider = true,
      showNumericInput = true,
      showBreakdown = false,
      size = 'md',
      colorize = true,
      className,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState<number | ''>(value ?? '');
    const numericInputRef = useRef<HTMLInputElement>(null);

    // Sync with external value
    useEffect(() => {
      setLocalValue(value ?? '');
    }, [value]);

    const currentValue = typeof localValue === 'number' ? localValue : min;
    const percentage = ((currentValue - min) / (max - min)) * 100;
    const colors = colorize ? getScoreColor(percentage) : null;
    const weightedScore = weight ? currentValue * weight : currentValue;

    const handleChange = useCallback(
      (newValue: number) => {
        const clampedValue = Math.min(Math.max(newValue, min), max);
        setLocalValue(clampedValue);
        onChange?.(clampedValue);
      },
      [min, max, onChange]
    );

    const handleSliderChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange(parseFloat(e.target.value));
      },
      [handleChange]
    );

    const handleNumericChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
          setLocalValue('');
          return;
        }

        const num = parseFloat(val);
        if (!isNaN(num)) {
          handleChange(num);
        }
      },
      [handleChange]
    );

    const handleNumericBlur = useCallback(() => {
      if (localValue === '' || typeof localValue !== 'number') {
        setLocalValue(min);
        onChange?.(min);
      }
    }, [localValue, min, onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled || readOnly) return;

        const current = typeof localValue === 'number' ? localValue : min;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleChange(current + step);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleChange(current - step);
        }
      },
      [disabled, readOnly, localValue, min, step, handleChange]
    );

    // Quick score buttons
    const quickScores = useMemo(() => {
      const scores: number[] = [];
      for (let i = min; i <= max; i += step) {
        scores.push(i);
      }
      // Limit to reasonable number of buttons
      if (scores.length > 11) {
        return [min, Math.round((max - min) * 0.25), Math.round((max - min) * 0.5), Math.round((max - min) * 0.75), max];
      }
      return scores;
    }, [min, max, step]);

    const sizeStyles = {
      sm: {
        label: 'text-sm',
        input: 'w-16 text-sm py-1.5',
        slider: 'h-1',
        button: 'text-xs px-2 py-1',
      },
      md: {
        label: 'text-base',
        input: 'w-20 text-base py-2',
        slider: 'h-2',
        button: 'text-sm px-2.5 py-1.5',
      },
      lg: {
        label: 'text-lg',
        input: 'w-24 text-lg py-2.5',
        slider: 'h-3',
        button: 'text-base px-3 py-2',
      },
    };

    const styles = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-lg border p-4',
          error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
          disabled && 'opacity-60',
          className
        )}
        {...props}
      >
        {/* Header */}
        {(label || weight) && (
          <div className="flex items-start justify-between mb-3">
            <div>
              {label && (
                <h4 className={clsx('font-medium text-gray-900', styles.label)}>
                  {label}
                  {weight && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">
                      (Weight: {weight}x)
                    </span>
                  )}
                </h4>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              )}
            </div>
            <span className="text-sm text-gray-500">
              Max: {max} {max === 1 ? 'point' : 'points'}
            </span>
          </div>
        )}

        {/* Score Display */}
        <div className="flex items-center gap-4 mb-4">
          {/* Numeric Input */}
          {showNumericInput && (
            <div className="flex items-baseline gap-2">
              <input
                ref={numericInputRef}
                type="number"
                min={min}
                max={max}
                step={step}
                value={localValue}
                onChange={handleNumericChange}
                onBlur={handleNumericBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                readOnly={readOnly}
                aria-label={label ? `Score for ${label}` : 'Score'}
                aria-invalid={!!error}
                aria-describedby={error ? 'score-error' : undefined}
                className={clsx(
                  'rounded-md border-gray-300 shadow-sm text-center font-semibold',
                  'focus:border-primary-500 focus:ring-primary-500',
                  'disabled:bg-gray-100 disabled:cursor-not-allowed',
                  styles.input,
                  colors?.text
                )}
              />
              <span className={clsx('font-medium', colors?.text || 'text-gray-600')}>
                / {max}
              </span>
            </div>
          )}

          {/* Percentage Badge */}
          {colorize && (
            <span
              className={clsx(
                'px-2 py-1 rounded-full text-sm font-medium',
                colors?.bg,
                colors?.text
              )}
            >
              {Math.round(percentage)}%
            </span>
          )}

          {/* Weighted Score */}
          {showBreakdown && weight && (
            <span className="text-sm text-gray-500">
              Weighted: {weightedScore.toFixed(1)}
            </span>
          )}
        </div>

        {/* Slider */}
        {showSlider && (
          <div className="mb-4">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={currentValue}
              onChange={handleSliderChange}
              disabled={disabled || readOnly}
              aria-label={label ? `Score slider for ${label}` : 'Score slider'}
              className={clsx(
                'w-full cursor-pointer appearance-none rounded-full bg-gray-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                styles.slider,
                colorize && colors?.slider,
                '[&::-webkit-slider-thumb]:appearance-none',
                '[&::-webkit-slider-thumb]:w-4',
                '[&::-webkit-slider-thumb]:h-4',
                '[&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-white',
                '[&::-webkit-slider-thumb]:shadow-md',
                '[&::-webkit-slider-thumb]:border-2',
                '[&::-webkit-slider-thumb]:border-primary-500',
                '[&::-webkit-slider-thumb]:cursor-pointer',
                '[&::-webkit-slider-thumb]:transition-transform',
                '[&::-webkit-slider-thumb]:hover:scale-110'
              )}
              style={{
                background: colorize
                  ? `linear-gradient(to right, currentColor ${percentage}%, #e5e7eb ${percentage}%)`
                  : undefined,
              }}
            />
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        )}

        {/* Quick Score Buttons */}
        {!readOnly && quickScores.length <= 11 && (
          <div className="flex flex-wrap gap-1">
            {quickScores.map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => handleChange(score)}
                disabled={disabled}
                className={clsx(
                  'rounded font-medium border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  styles.button,
                  score === currentValue
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:text-primary-600'
                )}
              >
                {score}
              </button>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p id="score-error" className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

ScoreInput.displayName = 'ScoreInput';

// -----------------------------------------------------------------------------
// Score Summary Component
// -----------------------------------------------------------------------------

export interface ScoreSummaryProps extends HTMLAttributes<HTMLDivElement> {
  /** Total score achieved */
  score: number;
  /** Maximum possible score */
  maxScore: number;
  /** Optional label */
  label?: string;
  /** Show as percentage */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreSummary({
  score,
  maxScore,
  label = 'Total Score',
  showPercentage = true,
  size = 'md',
  className,
  ...props
}: ScoreSummaryProps) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const colors = getScoreColor(percentage);

  const sizeStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const textStyles = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 bg-white',
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={clsx('font-bold', textStyles[size], colors.text)}>
          {score}
        </span>
        <span className="text-gray-400">/ {maxScore}</span>
        {showPercentage && (
          <span className={clsx('px-2 py-0.5 rounded-full text-sm font-medium', colors.bg, colors.text)}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      {/* Progress Bar */}
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            percentage >= 80 && 'bg-green-500',
            percentage >= 60 && percentage < 80 && 'bg-lime-500',
            percentage >= 40 && percentage < 60 && 'bg-amber-500',
            percentage >= 20 && percentage < 40 && 'bg-orange-500',
            percentage < 20 && 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ScoreInput;
