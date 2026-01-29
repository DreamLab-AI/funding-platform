// =============================================================================
// Avatar Component - Funding Application Platform
// User avatars with image support and fallback initials
// =============================================================================

import { forwardRef, HTMLAttributes, useState, useMemo } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** User's name (used for initials fallback) */
  name?: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Avatar shape */
  shape?: AvatarShape;
  /** Show online/offline status indicator */
  status?: 'online' | 'offline' | 'away' | 'busy';
  /** Custom fallback content */
  fallback?: React.ReactNode;
  /** Border color for the avatar */
  bordered?: boolean;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const sizeStyles: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: {
    container: 'w-6 h-6',
    text: 'text-[10px]',
    status: 'w-2 h-2 border',
  },
  sm: {
    container: 'w-8 h-8',
    text: 'text-xs',
    status: 'w-2.5 h-2.5 border-[1.5px]',
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-sm',
    status: 'w-3 h-3 border-2',
  },
  lg: {
    container: 'w-12 h-12',
    text: 'text-base',
    status: 'w-3.5 h-3.5 border-2',
  },
  xl: {
    container: 'w-16 h-16',
    text: 'text-lg',
    status: 'w-4 h-4 border-2',
  },
  '2xl': {
    container: 'w-24 h-24',
    text: 'text-2xl',
    status: 'w-5 h-5 border-2',
  },
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

// Generate consistent color from name
const stringToColor = (str: string): string => {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

// Get initials from name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// -----------------------------------------------------------------------------
// Avatar Component
// -----------------------------------------------------------------------------

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      fallback,
      bordered = false,
      className,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const sizeStyle = sizeStyles[size];

    const initials = useMemo(() => {
      if (name) return getInitials(name);
      return '?';
    }, [name]);

    const bgColor = useMemo(() => {
      if (name) return stringToColor(name);
      return 'bg-gray-400';
    }, [name]);

    const showImage = src && !imageError;
    const showFallback = !showImage;

    return (
      <div
        ref={ref}
        className={clsx(
          'relative inline-flex items-center justify-center flex-shrink-0',
          'overflow-hidden',
          sizeStyle.container,
          shape === 'circle' ? 'rounded-full' : 'rounded-lg',
          bordered && 'ring-2 ring-white',
          className
        )}
        {...props}
      >
        {/* Image */}
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}

        {/* Fallback */}
        {showFallback && (
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center',
              'font-semibold text-white',
              sizeStyle.text,
              fallback ? 'bg-gray-200' : bgColor
            )}
          >
            {fallback || initials}
          </div>
        )}

        {/* Status Indicator */}
        {status && (
          <span
            className={clsx(
              'absolute bottom-0 right-0 rounded-full border-white',
              sizeStyle.status,
              statusColors[status]
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// -----------------------------------------------------------------------------
// Avatar Group Component
// -----------------------------------------------------------------------------

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum number of avatars to show */
  max?: number;
  /** Size for all avatars in the group */
  size?: AvatarSize;
  /** Children should be Avatar components */
  children: React.ReactNode;
}

export function AvatarGroup({
  max = 4,
  size = 'md',
  children,
  className,
  ...props
}: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleAvatars = childArray.slice(0, max);
  const hiddenCount = childArray.length - max;

  // Overlap amount based on size
  const overlapStyles: Record<AvatarSize, string> = {
    xs: '-space-x-2',
    sm: '-space-x-2.5',
    md: '-space-x-3',
    lg: '-space-x-4',
    xl: '-space-x-5',
    '2xl': '-space-x-6',
  };

  return (
    <div
      className={clsx('flex items-center', overlapStyles[size], className)}
      {...props}
    >
      {visibleAvatars.map((child, index) => (
        <div
          key={index}
          className="relative ring-2 ring-white rounded-full"
          style={{ zIndex: visibleAvatars.length - index }}
        >
          {child}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div
          className={clsx(
            'relative flex items-center justify-center',
            'bg-gray-100 text-gray-600 font-medium rounded-full ring-2 ring-white',
            sizeStyles[size].container,
            sizeStyles[size].text
          )}
          style={{ zIndex: 0 }}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Avatar with Name Component
// -----------------------------------------------------------------------------

export interface AvatarWithNameProps extends AvatarProps {
  /** Primary text (usually name) */
  title: string;
  /** Secondary text (email, role, etc.) */
  subtitle?: string;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
}

export function AvatarWithName({
  title,
  subtitle,
  direction = 'horizontal',
  size = 'md',
  className,
  ...avatarProps
}: AvatarWithNameProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3',
        direction === 'vertical' && 'flex-col text-center',
        className
      )}
    >
      <Avatar size={size} name={title} {...avatarProps} />
      <div className={clsx(direction === 'vertical' && 'text-center')}>
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Skeleton Avatar - For loading states
// -----------------------------------------------------------------------------

export interface SkeletonAvatarProps {
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
}

export function SkeletonAvatar({
  size = 'md',
  shape = 'circle',
  className,
}: SkeletonAvatarProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200',
        sizeStyles[size].container,
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        className
      )}
      aria-hidden="true"
    />
  );
}

export default Avatar;
