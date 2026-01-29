// =============================================================================
// QuickActions Component - Funding Application Platform
// Shortcut buttons for common actions
// =============================================================================

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  disabled?: boolean;
}

export interface QuickActionsProps extends HTMLAttributes<HTMLDivElement> {
  /** List of actions */
  actions: QuickAction[];
  /** Layout variant */
  variant?: 'grid' | 'list' | 'compact';
  /** Number of columns (for grid variant) */
  columns?: 2 | 3 | 4;
  /** Section title */
  title?: string;
  /** Show icons */
  showIcons?: boolean;
}

// -----------------------------------------------------------------------------
// Color Styles
// -----------------------------------------------------------------------------

const colorStyles = {
  primary: {
    icon: 'bg-primary-100 text-primary-600',
    hover: 'hover:bg-primary-50 hover:border-primary-200',
    badge: 'bg-primary-100 text-primary-700',
  },
  secondary: {
    icon: 'bg-gray-100 text-gray-600',
    hover: 'hover:bg-gray-50 hover:border-gray-300',
    badge: 'bg-gray-100 text-gray-700',
  },
  success: {
    icon: 'bg-green-100 text-green-600',
    hover: 'hover:bg-green-50 hover:border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-600',
    hover: 'hover:bg-amber-50 hover:border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  danger: {
    icon: 'bg-red-100 text-red-600',
    hover: 'hover:bg-red-50 hover:border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  info: {
    icon: 'bg-blue-100 text-blue-600',
    hover: 'hover:bg-blue-50 hover:border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
};

// -----------------------------------------------------------------------------
// Action Card Component (Grid/List variant)
// -----------------------------------------------------------------------------

interface ActionCardProps {
  action: QuickAction;
  variant: 'grid' | 'list';
  showIcon: boolean;
}

function ActionCard({ action, variant, showIcon }: ActionCardProps) {
  const colors = colorStyles[action.color || 'primary'];

  const content = (
    <div
      className={clsx(
        'relative flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-white',
        'transition-all duration-150',
        action.disabled
          ? 'opacity-50 cursor-not-allowed'
          : clsx(colors.hover, 'cursor-pointer'),
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
        variant === 'grid' ? 'flex-col text-center' : 'flex-row'
      )}
    >
      {/* Icon */}
      {showIcon && (
        <div
          className={clsx(
            'flex-shrink-0 rounded-lg flex items-center justify-center',
            colors.icon,
            variant === 'grid' ? 'w-12 h-12' : 'w-10 h-10'
          )}
        >
          {action.icon}
        </div>
      )}

      {/* Content */}
      <div className={clsx('flex-1 min-w-0', variant === 'list' && 'text-left')}>
        <p
          className={clsx(
            'font-medium text-gray-900',
            variant === 'grid' ? 'text-sm' : 'text-base'
          )}
        >
          {action.label}
        </p>
        {action.description && (
          <p
            className={clsx(
              'text-gray-500 mt-1',
              variant === 'grid' ? 'text-xs' : 'text-sm'
            )}
          >
            {action.description}
          </p>
        )}
      </div>

      {/* Badge */}
      {action.badge && (
        <span
          className={clsx(
            'absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full',
            colors.badge
          )}
        >
          {action.badge}
        </span>
      )}

      {/* Arrow indicator (list variant) */}
      {variant === 'list' && !action.disabled && (
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </div>
  );

  if (action.disabled) {
    return <div aria-disabled="true">{content}</div>;
  }

  if (action.href) {
    return (
      <Link
        to={action.href}
        className="block focus:outline-none"
        aria-label={action.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className="block w-full text-left focus:outline-none"
      aria-label={action.label}
    >
      {content}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Compact Action Button
// -----------------------------------------------------------------------------

interface CompactActionProps {
  action: QuickAction;
  showIcon: boolean;
}

function CompactAction({ action, showIcon }: CompactActionProps) {
  const colors = colorStyles[action.color || 'primary'];

  const content = (
    <div
      className={clsx(
        'relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg',
        'bg-white border border-gray-200',
        'transition-all duration-150',
        action.disabled
          ? 'opacity-50 cursor-not-allowed'
          : clsx(colors.hover, 'cursor-pointer'),
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2'
      )}
    >
      {/* Icon */}
      {showIcon && (
        <span className={clsx('flex-shrink-0', colors.icon.split(' ')[1])}>
          {action.icon}
        </span>
      )}

      {/* Label */}
      <span className="text-sm font-medium text-gray-900">{action.label}</span>

      {/* Badge */}
      {action.badge && (
        <span
          className={clsx(
            'px-1.5 py-0.5 text-xs font-medium rounded-full',
            colors.badge
          )}
        >
          {action.badge}
        </span>
      )}
    </div>
  );

  if (action.disabled) {
    return <span aria-disabled="true">{content}</span>;
  }

  if (action.href) {
    return (
      <Link
        to={action.href}
        className="inline-block focus:outline-none"
        aria-label={action.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className="inline-block focus:outline-none"
      aria-label={action.label}
    >
      {content}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Main QuickActions Component
// -----------------------------------------------------------------------------

export const QuickActions = forwardRef<HTMLDivElement, QuickActionsProps>(
  (
    {
      actions,
      variant = 'grid',
      columns = 3,
      title = 'Quick Actions',
      showIcons = true,
      className,
      ...props
    },
    ref
  ) => {
    const columnStyles = {
      2: 'sm:grid-cols-2',
      3: 'sm:grid-cols-2 lg:grid-cols-3',
      4: 'sm:grid-cols-2 lg:grid-cols-4',
    };

    return (
      <div
        ref={ref}
        className={clsx('bg-white rounded-lg border border-gray-200', className)}
        {...props}
      >
        {/* Header */}
        {title && (
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        )}

        {/* Actions */}
        <div className="p-4">
          {variant === 'compact' ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <CompactAction
                  key={action.id}
                  action={action}
                  showIcon={showIcons}
                />
              ))}
            </div>
          ) : (
            <div
              className={clsx(
                'grid gap-4',
                variant === 'grid' && columnStyles[columns],
                variant === 'list' && 'grid-cols-1'
              )}
            >
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  variant={variant}
                  showIcon={showIcons}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

QuickActions.displayName = 'QuickActions';

// -----------------------------------------------------------------------------
// Preset Action Sets
// -----------------------------------------------------------------------------

export const coordinatorActions: QuickAction[] = [
  {
    id: 'new-call',
    label: 'Create Funding Call',
    description: 'Launch a new funding opportunity',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    href: '/dashboard/calls/new',
    color: 'primary',
  },
  {
    id: 'review-applications',
    label: 'Review Applications',
    description: 'View pending applications',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/dashboard/applications',
    badge: 12,
    color: 'warning',
  },
  {
    id: 'assign-assessors',
    label: 'Assign Assessors',
    description: 'Manage reviewer assignments',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    href: '/dashboard/assessors/assign',
    color: 'info',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    description: 'Analytics and insights',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    href: '/dashboard/reports',
    color: 'secondary',
  },
];

export const assessorActions: QuickAction[] = [
  {
    id: 'pending-reviews',
    label: 'Pending Reviews',
    description: 'Applications awaiting your review',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    href: '/dashboard/assignments?status=pending',
    badge: 5,
    color: 'warning',
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    description: 'Reviews you have started',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '/dashboard/assignments?status=in_progress',
    badge: 2,
    color: 'info',
  },
  {
    id: 'completed',
    label: 'Completed Reviews',
    description: 'Your submitted assessments',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '/dashboard/completed',
    color: 'success',
  },
  {
    id: 'update-profile',
    label: 'Update Expertise',
    description: 'Manage your reviewer profile',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    href: '/dashboard/profile',
    color: 'secondary',
  },
];

export const applicantActions: QuickAction[] = [
  {
    id: 'new-application',
    label: 'Start Application',
    description: 'Apply for funding',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    href: '/opportunities',
    color: 'primary',
  },
  {
    id: 'my-applications',
    label: 'My Applications',
    description: 'View your submissions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/applications',
    badge: 3,
    color: 'info',
  },
  {
    id: 'drafts',
    label: 'Draft Applications',
    description: 'Continue where you left off',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    href: '/applications?status=draft',
    badge: 1,
    color: 'warning',
  },
  {
    id: 'help',
    label: 'Get Help',
    description: 'FAQs and support',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '/help',
    color: 'secondary',
  },
];

export default QuickActions;
