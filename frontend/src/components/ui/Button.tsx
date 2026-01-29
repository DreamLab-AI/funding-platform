// =============================================================================
// Button Component - Funding Application Platform
// WCAG 2.1 AA Compliant | Multiple variants with loading states
// =============================================================================

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Loading text (replaces children when loading) */
  loadingText?: string;
  /** Icon to display before text */
  leftIcon?: ReactNode;
  /** Icon to display after text */
  rightIcon?: ReactNode;
  /** Make button full width */
  fullWidth?: boolean;
  /** Icon-only button (square aspect ratio) */
  iconOnly?: boolean;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseStyles = clsx(
  'inline-flex items-center justify-center gap-2',
  'font-medium text-center',
  'border-2 rounded',
  'transition-all duration-150 ease-out',
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#ffdd00] focus-visible:ring-offset-0',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'active:scale-[0.98]'
);

const variantStyles: Record<ButtonVariant, string> = {
  primary: clsx(
    'bg-primary-500 text-white border-primary-500',
    'hover:bg-primary-600 hover:border-primary-600',
    'active:bg-primary-700 active:border-primary-700'
  ),
  secondary: clsx(
    'bg-secondary-100 text-secondary-900 border-secondary-300',
    'hover:bg-secondary-200 hover:border-secondary-400',
    'active:bg-secondary-300'
  ),
  ghost: clsx(
    'bg-transparent text-secondary-700 border-transparent',
    'hover:bg-secondary-100',
    'active:bg-secondary-200'
  ),
  danger: clsx(
    'bg-error-500 text-white border-error-500',
    'hover:bg-error-600 hover:border-error-600',
    'active:bg-error-700 active:border-error-700'
  ),
  success: clsx(
    'bg-success-500 text-white border-success-500',
    'hover:bg-success-600 hover:border-success-600',
    'active:bg-success-700 active:border-success-700'
  ),
  outline: clsx(
    'bg-transparent text-primary-600 border-primary-500',
    'hover:bg-primary-50',
    'active:bg-primary-100'
  ),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2.5 text-base min-h-[44px]', // 44px minimum for touch targets
  lg: 'px-6 py-3.5 text-lg min-h-[52px]',
};

const iconOnlySizeStyles: Record<ButtonSize, string> = {
  sm: 'p-1.5 min-w-[32px] min-h-[32px]',
  md: 'p-2.5 min-w-[44px] min-h-[44px]',
  lg: 'p-3.5 min-w-[52px] min-h-[52px]',
};

// -----------------------------------------------------------------------------
// Loading Spinner Component
// -----------------------------------------------------------------------------

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Button Component
// -----------------------------------------------------------------------------

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      iconOnly = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const spinnerSize = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          iconOnly ? iconOnlySizeStyles[size] : sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner className={spinnerSize} />
            {loadingText && <span>{loadingText}</span>}
            {!loadingText && !iconOnly && <span className="sr-only">Loading</span>}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// -----------------------------------------------------------------------------
// Button Group Component
// -----------------------------------------------------------------------------

export interface ButtonGroupProps {
  children: ReactNode;
  /** Orientation of the button group */
  orientation?: 'horizontal' | 'vertical';
  /** Attach buttons together */
  attached?: boolean;
  className?: string;
}

export function ButtonGroup({
  children,
  orientation = 'horizontal',
  attached = false,
  className,
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={clsx(
        'inline-flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        attached && orientation === 'horizontal' && [
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          '[&>*:first-child]:rounded-r-none',
          '[&>*:last-child]:rounded-l-none',
          '[&>*:not(:first-child)]:-ml-[2px]',
        ],
        attached && orientation === 'vertical' && [
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          '[&>*:first-child]:rounded-b-none',
          '[&>*:last-child]:rounded-t-none',
          '[&>*:not(:first-child)]:-mt-[2px]',
        ],
        !attached && (orientation === 'horizontal' ? 'gap-2' : 'gap-2'),
        className
      )}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Icon Button Convenience Component
// -----------------------------------------------------------------------------

export interface IconButtonProps extends Omit<ButtonProps, 'iconOnly' | 'leftIcon' | 'rightIcon'> {
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label for the button (required for icon-only buttons) */
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, children, ...props }, ref) => {
    return (
      <Button ref={ref} iconOnly className={className} {...props}>
        <span className="flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
        {children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
