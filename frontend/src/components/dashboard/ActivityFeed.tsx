// =============================================================================
// ActivityFeed Component - Funding Application Platform
// Timeline of recent activities and events
// =============================================================================

import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ActivityType =
  | 'application_submitted'
  | 'application_updated'
  | 'assessment_completed'
  | 'assessment_assigned'
  | 'status_change'
  | 'comment_added'
  | 'document_uploaded'
  | 'deadline_reminder'
  | 'call_published'
  | 'call_closed'
  | 'user_joined'
  | 'score_submitted';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: {
    applicationId?: string;
    applicationTitle?: string;
    callId?: string;
    callTitle?: string;
    score?: number;
    status?: string;
  };
  link?: string;
}

export interface ActivityFeedProps extends HTMLAttributes<HTMLDivElement> {
  /** List of activities */
  activities: Activity[];
  /** Maximum items to show */
  maxItems?: number;
  /** Show "View all" link */
  showViewAll?: boolean;
  /** View all link URL */
  viewAllHref?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Grouped by date */
  groupByDate?: boolean;
}

// -----------------------------------------------------------------------------
// Activity Icons
// -----------------------------------------------------------------------------

const activityIcons: Record<ActivityType, { icon: ReactNode; color: string }> = {
  application_submitted: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'bg-green-100 text-green-600',
  },
  application_updated: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: 'bg-blue-100 text-blue-600',
  },
  assessment_completed: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: 'bg-green-100 text-green-600',
  },
  assessment_assigned: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: 'bg-purple-100 text-purple-600',
  },
  status_change: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    color: 'bg-amber-100 text-amber-600',
  },
  comment_added: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    color: 'bg-gray-100 text-gray-600',
  },
  document_uploaded: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    color: 'bg-blue-100 text-blue-600',
  },
  deadline_reminder: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'bg-red-100 text-red-600',
  },
  call_published: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    color: 'bg-primary-100 text-primary-600',
  },
  call_closed: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    color: 'bg-gray-100 text-gray-600',
  },
  user_joined: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    color: 'bg-green-100 text-green-600',
  },
  score_submitted: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    color: 'bg-amber-100 text-amber-600',
  },
};

// -----------------------------------------------------------------------------
// Time Formatting
// -----------------------------------------------------------------------------

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (activityDate.getTime() === today.getTime()) return 'Today';
  if (activityDate.getTime() === yesterday.getTime()) return 'Yesterday';
  if (activityDate.getTime() > today.getTime() - 7 * 86400000) {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// -----------------------------------------------------------------------------
// Activity Item Component
// -----------------------------------------------------------------------------

interface ActivityItemProps {
  activity: Activity;
  isLast?: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const { icon, color } = activityIcons[activity.type];

  const content = (
    <div className="flex gap-4 relative">
      {/* Timeline line */}
      {!isLast && (
        <div
          className="absolute left-5 top-10 w-0.5 h-full bg-gray-200"
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <div className={clsx(
        'relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
        color
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {activity.title}
            </p>
            {activity.description && (
              <p className="mt-1 text-sm text-gray-600">
                {activity.description}
              </p>
            )}
            {activity.user && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                  {activity.user.avatar ? (
                    <img
                      src={activity.user.avatar}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    activity.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
                  )}
                </div>
                <span className="text-xs text-gray-500">{activity.user.name}</span>
              </div>
            )}
          </div>
          <time
            dateTime={activity.timestamp.toISOString()}
            className="text-xs text-gray-500 whitespace-nowrap"
          >
            {formatTimeAgo(activity.timestamp)}
          </time>
        </div>
      </div>
    </div>
  );

  if (activity.link) {
    return (
      <a
        href={activity.link}
        className="block hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {content}
      </a>
    );
  }

  return <div className="py-1">{content}</div>;
}

// -----------------------------------------------------------------------------
// Loading Skeleton
// -----------------------------------------------------------------------------

function ActivitySkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 py-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main ActivityFeed Component
// -----------------------------------------------------------------------------

export const ActivityFeed = forwardRef<HTMLDivElement, ActivityFeedProps>(
  (
    {
      activities,
      maxItems,
      showViewAll = true,
      viewAllHref = '/dashboard/activity',
      emptyMessage = 'No recent activity',
      isLoading = false,
      groupByDate = false,
      className,
      ...props
    },
    ref
  ) => {
    const displayedActivities = maxItems
      ? activities.slice(0, maxItems)
      : activities;

    // Group activities by date if needed
    const groupedActivities = groupByDate
      ? displayedActivities.reduce<Record<string, Activity[]>>((groups, activity) => {
          const key = formatDateGroup(activity.timestamp);
          if (!groups[key]) groups[key] = [];
          groups[key].push(activity);
          return groups;
        }, {})
      : null;

    return (
      <div
        ref={ref}
        className={clsx('bg-white rounded-lg border border-gray-200', className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          {showViewAll && activities.length > 0 && (
            <a
              href={viewAllHref}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              View all
            </a>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <ActivitySkeleton />
          ) : activities.length === 0 ? (
            <EmptyState message={emptyMessage} />
          ) : groupByDate && groupedActivities ? (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {date}
                  </h3>
                  <div>
                    {items.map((activity, index) => (
                      <ActivityItem
                        key={activity.id}
                        activity={activity}
                        isLast={index === items.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {displayedActivities.map((activity, index) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  isLast={index === displayedActivities.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with count */}
        {maxItems && activities.length > maxItems && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <p className="text-sm text-gray-500 text-center">
              Showing {maxItems} of {activities.length} activities
            </p>
          </div>
        )}
      </div>
    );
  }
);

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;
