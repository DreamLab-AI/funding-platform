// =============================================================================
// Badge Component - Funding Application Platform
// Status badges for draft, submitted, in-review, completed states
// =============================================================================

import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import {
  ApplicationStatus,
  CallStatus,
  AssignmentStatus,
  AssessmentStatus,
  FileScanStatus,
} from '../../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge visual variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Show a dot indicator */
  dot?: boolean;
  /** Dot color (if different from variant) */
  dotColor?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Make the badge pill-shaped */
  pill?: boolean;
  /** Outlined style instead of filled */
  outlined?: boolean;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const variantStyles: Record<BadgeVariant, { filled: string; outlined: string; dot: string }> = {
  default: {
    filled: 'bg-gray-100 text-gray-700',
    outlined: 'bg-white text-gray-700 border-gray-300',
    dot: 'bg-gray-400',
  },
  primary: {
    filled: 'bg-primary-100 text-primary-700',
    outlined: 'bg-white text-primary-700 border-primary-300',
    dot: 'bg-primary-500',
  },
  secondary: {
    filled: 'bg-secondary-100 text-secondary-700',
    outlined: 'bg-white text-secondary-700 border-secondary-300',
    dot: 'bg-secondary-500',
  },
  success: {
    filled: 'bg-green-100 text-green-700',
    outlined: 'bg-white text-green-700 border-green-300',
    dot: 'bg-green-500',
  },
  warning: {
    filled: 'bg-amber-100 text-amber-800',
    outlined: 'bg-white text-amber-700 border-amber-300',
    dot: 'bg-amber-500',
  },
  error: {
    filled: 'bg-red-100 text-red-700',
    outlined: 'bg-white text-red-700 border-red-300',
    dot: 'bg-red-500',
  },
  info: {
    filled: 'bg-blue-100 text-blue-700',
    outlined: 'bg-white text-blue-700 border-blue-300',
    dot: 'bg-blue-500',
  },
};

const sizeStyles: Record<BadgeSize, { base: string; dot: string; icon: string }> = {
  sm: {
    base: 'px-2 py-0.5 text-xs',
    dot: 'w-1.5 h-1.5',
    icon: 'w-3 h-3',
  },
  md: {
    base: 'px-2.5 py-1 text-sm',
    dot: 'w-2 h-2',
    icon: 'w-4 h-4',
  },
  lg: {
    base: 'px-3 py-1.5 text-base',
    dot: 'w-2.5 h-2.5',
    icon: 'w-5 h-5',
  },
};

// -----------------------------------------------------------------------------
// Badge Component
// -----------------------------------------------------------------------------

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor,
  icon,
  pill = true,
  outlined = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium whitespace-nowrap',
        sizeStyle.base,
        outlined ? variantStyle.outlined : variantStyle.filled,
        outlined && 'border',
        pill ? 'rounded-full' : 'rounded',
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            'rounded-full flex-shrink-0',
            sizeStyle.dot,
            dotColor || variantStyle.dot
          )}
          aria-hidden="true"
        />
      )}
      {icon && (
        <span className={clsx('flex-shrink-0', sizeStyle.icon)} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Status Badge - Maps application statuses to badge variants
// -----------------------------------------------------------------------------

type StatusType =
  | ApplicationStatus
  | CallStatus
  | AssignmentStatus
  | AssessmentStatus
  | FileScanStatus;

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType;
  showDot?: boolean;
}

// Status config using string values - with fallback handling for duplicate values
function getStatusConfig(status: StatusType): { variant: BadgeVariant; label: string } {
  // Map status values to their display config
  const statusStr = String(status);

  switch (statusStr) {
    // Draft state - context-agnostic
    case 'draft':
      return { variant: 'default', label: 'Draft' };

    // Submitted states
    case 'submitted':
      return { variant: 'info', label: 'Submitted' };

    // In progress states
    case 'under_review':
      return { variant: 'warning', label: 'Under Review' };
    case 'in_assessment':
      return { variant: 'primary', label: 'In Assessment' };
    case 'in_progress':
      return { variant: 'info', label: 'In Progress' };

    // Completed states
    case 'assessed':
      return { variant: 'success', label: 'Assessed' };
    case 'completed':
      return { variant: 'success', label: 'Completed' };
    case 'clean':
      return { variant: 'success', label: 'Verified' };

    // Warning states
    case 'pending':
      return { variant: 'warning', label: 'Pending' };
    case 'returned':
      return { variant: 'warning', label: 'Returned' };

    // Success states
    case 'open':
      return { variant: 'success', label: 'Open' };

    // Error states
    case 'withdrawn':
      return { variant: 'error', label: 'Withdrawn' };
    case 'infected':
      return { variant: 'error', label: 'Rejected' };
    case 'error':
      return { variant: 'error', label: 'Error' };

    // Default states
    case 'closed':
      return { variant: 'default', label: 'Closed' };
    case 'archived':
      return { variant: 'secondary', label: 'Archived' };

    default:
      return { variant: 'default', label: statusStr };
  }
}

export function StatusBadge({ status, showDot = true, ...props }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  if (!config) {
    console.warn(`Unknown status: ${status}`);
    return (
      <Badge variant="default" dot={showDot} {...props}>
        Unknown
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} dot={showDot} {...props}>
      {config.label}
    </Badge>
  );
}

// -----------------------------------------------------------------------------
// Counter Badge - For notifications/counts
// -----------------------------------------------------------------------------

interface CounterBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number;
  max?: number;
  showZero?: boolean;
}

export function CounterBadge({
  count,
  max = 99,
  showZero = false,
  ...props
}: CounterBadgeProps) {
  if (count === 0 && !showZero) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge
      pill
      size="sm"
      variant={count > 0 ? 'error' : 'default'}
      aria-label={`${count} items`}
      {...props}
    >
      {displayCount}
    </Badge>
  );
}

// -----------------------------------------------------------------------------
// Badge Group - For displaying multiple badges
// -----------------------------------------------------------------------------

interface BadgeGroupProps {
  children: ReactNode;
  max?: number;
  className?: string;
}

export function BadgeGroup({ children, max = 5, className }: BadgeGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleChildren = childArray.slice(0, max);
  const hiddenCount = childArray.length - max;

  return (
    <div className={clsx('flex flex-wrap items-center gap-1', className)}>
      {visibleChildren}
      {hiddenCount > 0 && (
        <Badge variant="default" size="sm">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Priority Badge - For showing priority levels
// -----------------------------------------------------------------------------

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
  priority: Priority;
}

const priorityConfig: Record<Priority, { variant: BadgeVariant; label: string; icon: ReactNode }> = {
  low: {
    variant: 'default',
    label: 'Low',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ),
  },
  medium: {
    variant: 'warning',
    label: 'Medium',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  },
  high: {
    variant: 'error',
    label: 'High',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ),
  },
  critical: {
    variant: 'error',
    label: 'Critical',
    icon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
};

export function PriorityBadge({ priority, ...props }: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <Badge variant={config.variant} icon={config.icon} {...props}>
      {config.label}
    </Badge>
  );
}

export default Badge;
