// =============================================================================
// Dialog Component - Funding Application Platform
// Modal dialogs with focus trap and accessibility
// =============================================================================

import {
  Fragment,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
  HTMLAttributes,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Dialog title */
  title?: ReactNode;
  /** Dialog description */
  description?: ReactNode;
  /** Dialog size */
  size?: DialogSize;
  /** Whether clicking the backdrop closes the dialog */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the dialog */
  closeOnEscape?: boolean;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Initial focus element ref */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element to return focus to on close */
  finalFocusRef?: React.RefObject<HTMLElement>;
  /** Don't render portal (for testing) */
  disablePortal?: boolean;
}

// -----------------------------------------------------------------------------
// Focus Trap Hook
// -----------------------------------------------------------------------------

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean,
  initialFocusRef?: React.RefObject<HTMLElement>
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus initial element or first focusable
    const focusInitial = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const firstFocusable = getFocusableElements(containerRef.current!)[0];
        if (firstFocusable) {
          (firstFocusable as HTMLElement).focus();
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(focusInitial, 50);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isActive, containerRef, initialFocusRef]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(containerRef.current!);
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, containerRef]);

  // Return focus on unmount
  useEffect(() => {
    if (!isActive) return;

    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);
}

function getFocusableElements(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const sizeStyles: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
};

// -----------------------------------------------------------------------------
// Dialog Component
// -----------------------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  initialFocusRef,
  finalFocusRef,
  disablePortal = false,
  className,
  children,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open, initialFocusRef);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Return focus to final element on close
  useEffect(() => {
    if (!open && finalFocusRef?.current) {
      finalFocusRef.current.focus();
    }
  }, [open, finalFocusRef]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnBackdrop && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  if (!open) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-[1050] overflow-y-auto"
      aria-labelledby={title ? 'dialog-title' : undefined}
      aria-describedby={description ? 'dialog-description' : undefined}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Dialog positioning */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        {/* Dialog panel */}
        <div
          ref={dialogRef}
          className={clsx(
            'relative w-full bg-white rounded-lg shadow-xl',
            'transform transition-all duration-200',
            open ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
            sizeStyles[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
              <div>
                {title && (
                  <h2
                    id="dialog-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="dialog-description"
                    className="mt-1 text-sm text-gray-500"
                  >
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className={clsx(
                    'p-2 -m-2 text-gray-400 hover:text-gray-600',
                    'rounded-md transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                  )}
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );

  if (disablePortal || typeof document === 'undefined') {
    return dialogContent;
  }

  return createPortal(dialogContent, document.body);
}

// -----------------------------------------------------------------------------
// Dialog Body Component
// -----------------------------------------------------------------------------

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove padding */
  noPadding?: boolean;
}

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
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

DialogBody.displayName = 'DialogBody';

// -----------------------------------------------------------------------------
// Dialog Footer Component
// -----------------------------------------------------------------------------

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Align footer content */
  align?: 'left' | 'center' | 'right' | 'between';
}

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
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
          'flex items-center gap-3 px-5 py-4',
          'border-t border-gray-200 bg-gray-50',
          'rounded-b-lg',
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

DialogFooter.displayName = 'DialogFooter';

// -----------------------------------------------------------------------------
// Confirmation Dialog - Convenience wrapper
// -----------------------------------------------------------------------------

export interface ConfirmDialogProps extends Omit<DialogProps, 'children'> {
  /** Confirm button text */
  confirmLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Called when confirm is clicked */
  onConfirm: () => void;
  /** Confirm button variant */
  confirmVariant?: 'primary' | 'danger';
  /** Whether the action is in progress */
  isLoading?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  confirmVariant = 'primary',
  isLoading = false,
  ...props
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      initialFocusRef={cancelRef}
      size="sm"
      {...props}
    >
      <DialogFooter>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className={clsx(
            'px-4 py-2 text-sm font-medium',
            'text-gray-700 bg-white border border-gray-300 rounded-md',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={clsx(
            'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            confirmVariant === 'danger'
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {confirmLabel}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Alert Dialog - For important messages
// -----------------------------------------------------------------------------

export interface AlertDialogProps extends Omit<DialogProps, 'children'> {
  /** Alert type */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Message content */
  message: ReactNode;
  /** Button text */
  buttonLabel?: string;
}

export function AlertDialog({
  title,
  message,
  type = 'info',
  buttonLabel = 'OK',
  onClose,
  ...props
}: AlertDialogProps) {
  const icons = {
    info: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <Dialog title={title} onClose={onClose} size="sm" {...props}>
      <DialogBody>
        <div className="flex gap-4">
          <div className="flex-shrink-0">{icons[type]}</div>
          <div className="text-sm text-gray-600">{message}</div>
        </div>
      </DialogBody>
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            'px-4 py-2 text-sm font-medium text-white rounded-md',
            'bg-primary-600 hover:bg-primary-700',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
          )}
        >
          {buttonLabel}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

export default Dialog;
