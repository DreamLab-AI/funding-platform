// =============================================================================
// Tooltip Component - Funding Application Platform
// Accessible tooltips with keyboard support
// =============================================================================

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
  HTMLAttributes,
  cloneElement,
  isValidElement,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /** Tooltip content */
  content: ReactNode;
  /** Trigger element */
  children: ReactNode;
  /** Placement relative to trigger */
  placement?: TooltipPlacement;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Delay before hiding (ms) */
  hideDelay?: number;
  /** Disable the tooltip */
  disabled?: boolean;
  /** Show arrow */
  arrow?: boolean;
  /** Maximum width of tooltip */
  maxWidth?: number;
  /** Control visibility externally */
  open?: boolean;
  /** Callback when visibility changes */
  onOpenChange?: (open: boolean) => void;
}

// -----------------------------------------------------------------------------
// Hook for tooltip positioning
// -----------------------------------------------------------------------------

interface Position {
  top: number;
  left: number;
  arrowTop?: number;
  arrowLeft?: number;
}

function useTooltipPosition(
  triggerRef: React.RefObject<HTMLElement>,
  tooltipRef: React.RefObject<HTMLDivElement>,
  placement: TooltipPlacement,
  isOpen: boolean
): Position {
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current || !tooltipRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      const gap = 8; // Space between trigger and tooltip

      let top = 0;
      let left = 0;

      switch (placement) {
        case 'top':
          top = triggerRect.top + scrollY - tooltipRect.height - gap;
          left = triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + scrollY + gap;
          left = triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left + scrollX - tooltipRect.width - gap;
          break;
        case 'right':
          top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + scrollX + gap;
          break;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 8) left = 8;
      if (left + tooltipRect.width > viewportWidth - 8) {
        left = viewportWidth - tooltipRect.width - 8;
      }
      if (top < 8) top = 8;
      if (top + tooltipRect.height > viewportHeight + scrollY - 8) {
        top = viewportHeight + scrollY - tooltipRect.height - 8;
      }

      setPosition({ top, left });
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, placement, triggerRef, tooltipRef]);

  return position;
}

// -----------------------------------------------------------------------------
// Tooltip Component
// -----------------------------------------------------------------------------

export function Tooltip({
  content,
  children,
  placement = 'top',
  showDelay = 200,
  hideDelay = 100,
  disabled = false,
  arrow = true,
  maxWidth = 250,
  open: controlledOpen,
  onOpenChange,
  className,
  ...props
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const position = useTooltipPosition(triggerRef, tooltipRef, placement, isOpen);

  const setOpen = useCallback(
    (value: boolean) => {
      if (disabled) return;
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalOpen(value);
      }
    },
    [disabled, isControlled, onOpenChange]
  );

  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleShow = useCallback(() => {
    clearTimeouts();
    showTimeoutRef.current = window.setTimeout(() => {
      setOpen(true);
    }, showDelay);
  }, [clearTimeouts, setOpen, showDelay]);

  const handleHide = useCallback(() => {
    clearTimeouts();
    hideTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, hideDelay);
  }, [clearTimeouts, setOpen, hideDelay]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    },
    [isOpen, setOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeouts();
    };
  }, [handleKeyDown, clearTimeouts]);

  // Clone trigger element to add refs and event handlers
  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        ref: triggerRef,
        onMouseEnter: (e: React.MouseEvent) => {
          handleShow();
          (children as React.ReactElement<any>).props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleHide();
          (children as React.ReactElement<any>).props.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          handleShow();
          (children as React.ReactElement<any>).props.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          handleHide();
          (children as React.ReactElement<any>).props.onBlur?.(e);
        },
        'aria-describedby': isOpen ? 'tooltip' : undefined,
      })
    : children;

  const arrowStyles: Record<TooltipPlacement, string> = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };

  const tooltipContent = isOpen && (
    <div
      ref={tooltipRef}
      id="tooltip"
      role="tooltip"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        maxWidth,
        zIndex: 1070,
      }}
      className={clsx(
        'px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg',
        'animate-fade-in',
        className
      )}
      onMouseEnter={handleShow}
      onMouseLeave={handleHide}
      {...props}
    >
      {content}
      {arrow && (
        <div
          className={clsx(
            'absolute w-0 h-0',
            'border-4 border-gray-900',
            arrowStyles[placement]
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' &&
        createPortal(tooltipContent, document.body)}
    </>
  );
}

// -----------------------------------------------------------------------------
// Info Tooltip - Convenience wrapper with info icon
// -----------------------------------------------------------------------------

export interface InfoTooltipProps extends Omit<TooltipProps, 'children'> {
  /** Icon size */
  size?: 'sm' | 'md' | 'lg';
  /** Icon color */
  iconClassName?: string;
}

export function InfoTooltip({
  content,
  size = 'md',
  iconClassName,
  ...props
}: InfoTooltipProps) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <Tooltip content={content} {...props}>
      <button
        type="button"
        className={clsx(
          'inline-flex items-center justify-center',
          'text-gray-400 hover:text-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
          'rounded-full transition-colors',
          iconClassName
        )}
        aria-label="More information"
      >
        <svg
          className={sizeStyles[size]}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </Tooltip>
  );
}

// -----------------------------------------------------------------------------
// Help Text Tooltip - For form field hints
// -----------------------------------------------------------------------------

export interface HelpTextTooltipProps extends Omit<TooltipProps, 'children'> {
  /** Label text to display before the icon */
  label?: string;
}

export function HelpTextTooltip({
  content,
  label,
  ...props
}: HelpTextTooltipProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {label && <span className="text-sm text-gray-700">{label}</span>}
      <InfoTooltip content={content} size="sm" {...props} />
    </span>
  );
}

export default Tooltip;
