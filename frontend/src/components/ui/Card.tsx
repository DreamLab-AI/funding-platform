// =============================================================================
// Card Component - Funding Application Platform
// Elevated cards with hover effects and multiple variants
// =============================================================================

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CardVariant = 'elevated' | 'outlined' | 'filled';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card visual variant */
  variant?: CardVariant;
  /** Enable hover effect */
  hoverable?: boolean;
  /** Make the entire card clickable */
  clickable?: boolean;
  /** Add padding to the card */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Card border radius */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Header title */
  title?: ReactNode;
  /** Header subtitle */
  subtitle?: ReactNode;
  /** Action element (usually a button or menu) */
  action?: ReactNode;
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove padding */
  noPadding?: boolean;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Align footer content */
  align?: 'left' | 'center' | 'right' | 'between';
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const variantStyles: Record<CardVariant, string> = {
  elevated: clsx(
    'bg-white border border-gray-200',
    'shadow-[0_1px_3px_0_rgb(0_0_0/0.08),0_1px_2px_-1px_rgb(0_0_0/0.06)]'
  ),
  outlined: clsx(
    'bg-white border-2 border-gray-200',
    'shadow-none'
  ),
  filled: clsx(
    'bg-gray-50 border border-gray-100',
    'shadow-none'
  ),
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const roundedStyles = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

// -----------------------------------------------------------------------------
// Card Component
// -----------------------------------------------------------------------------

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'elevated',
      hoverable = false,
      clickable = false,
      padding = 'none',
      rounded = 'lg',
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isInteractive = hoverable || clickable || !!onClick;

    return (
      <div
        ref={ref}
        className={clsx(
          'overflow-hidden',
          variantStyles[variant],
          paddingStyles[padding],
          roundedStyles[rounded],
          isInteractive && [
            'transition-all duration-150 ease-out',
            'hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.12),0_2px_6px_-2px_rgb(0_0_0/0.08)]',
            'hover:-translate-y-0.5',
          ],
          clickable && [
            'cursor-pointer',
            'active:translate-y-0',
            'active:shadow-[0_1px_3px_0_rgb(0_0_0/0.08),0_1px_2px_-1px_rgb(0_0_0/0.06)]',
          ],
          'focus-within:ring-[3px] focus-within:ring-[#ffdd00] focus-within:ring-offset-0',
          className
        )}
        onClick={onClick}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// -----------------------------------------------------------------------------
// Card Header Component
// -----------------------------------------------------------------------------

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'px-5 py-4',
          'border-b border-gray-200',
          'flex items-start justify-between gap-4',
          className
        )}
        {...props}
      >
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {children}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// -----------------------------------------------------------------------------
// Card Body Component
// -----------------------------------------------------------------------------

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ noPadding = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(!noPadding && 'p-5', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// -----------------------------------------------------------------------------
// Card Footer Component
// -----------------------------------------------------------------------------

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ align = 'right', className, children, ...props }, ref) => {
    const alignStyles = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'px-5 py-4',
          'border-t border-gray-200',
          'bg-gray-50',
          'flex items-center gap-3',
          alignStyles[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// -----------------------------------------------------------------------------
// Card Image Component
// -----------------------------------------------------------------------------

export interface CardImageProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  aspectRatio?: 'video' | 'square' | 'wide' | 'auto';
}

export const CardImage = forwardRef<HTMLDivElement, CardImageProps>(
  ({ src, alt, aspectRatio = 'video', className, ...props }, ref) => {
    const aspectStyles = {
      video: 'aspect-video',
      square: 'aspect-square',
      wide: 'aspect-[21/9]',
      auto: '',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'relative overflow-hidden bg-gray-100',
          aspectStyles[aspectRatio],
          className
        )}
        {...props}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
);

CardImage.displayName = 'CardImage';

// -----------------------------------------------------------------------------
// Stat Card - Specialized card for KPIs
// -----------------------------------------------------------------------------

export interface StatCardProps extends Omit<CardProps, 'children'> {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional change indicator */
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  /** Optional icon */
  icon?: ReactNode;
  /** Optional sparkline data (array of numbers) */
  sparklineData?: number[];
}

export function StatCard({
  label,
  value,
  change,
  icon,
  sparklineData,
  className,
  ...props
}: StatCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <Card padding="md" className={clsx('relative', className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className={clsx('mt-2 flex items-center gap-1 text-sm', trendColors[change.trend])}>
              {trendIcons[change.trend]}
              <span>{Math.abs(change.value)}%</span>
              <span className="text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-3 bg-primary-50 rounded-lg text-primary-600">
            {icon}
          </div>
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-12">
          <Sparkline data={sparklineData} />
        </div>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Sparkline Component (for StatCard)
// -----------------------------------------------------------------------------

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

function Sparkline({ data, color = '#1d70b8', height = 48 }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const padding = 2;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((value - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default Card;
