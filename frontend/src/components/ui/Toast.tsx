// =============================================================================
// Toast Component - Funding Application Platform
// Notification toasts with auto-dismiss and accessibility
// =============================================================================

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export interface ToastProviderProps {
  children: ReactNode;
  /** Position of the toast container */
  position?: ToastPosition;
  /** Maximum number of toasts to show */
  maxToasts?: number;
  /** Default duration in ms (0 for no auto-dismiss) */
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  defaultDuration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        ...toast,
        id,
        dismissible: toast.dismissible ?? true,
        duration: toast.duration ?? defaultDuration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Remove oldest toasts if exceeding max
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Auto-remove after duration
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    [defaultDuration, maxToasts, removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'error', title, message, duration: 8000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'warning', title, message });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      removeAllToasts,
      success,
      error,
      warning,
      info,
    }),
    [toasts, addToast, removeToast, removeAllToasts, success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} position={position} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Toast Container
// -----------------------------------------------------------------------------

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, position, onRemove }: ToastContainerProps) {
  const positionStyles: Record<ToastPosition, string> = {
    'top-left': 'top-0 left-0',
    'top-center': 'top-0 left-1/2 -translate-x-1/2',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-0 right-0',
  };

  const isTop = position.startsWith('top');

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={clsx(
        'fixed z-[1080] p-4 space-y-2 pointer-events-none',
        'max-w-sm w-full',
        positionStyles[position]
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {(isTop ? toasts : [...toasts].reverse()).map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
          position={position}
        />
      ))}
    </div>,
    document.body
  );
}

// -----------------------------------------------------------------------------
// Toast Item
// -----------------------------------------------------------------------------

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  position: ToastPosition;
}

function ToastItem({ toast, onRemove, position }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 150);
  }, [onRemove, toast.id]);

  const icons: Record<ToastType, ReactNode> = {
    success: (
      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const isRight = position.includes('right');
  const enterAnimation = isRight ? 'translate-x-full' : '-translate-x-full';

  return (
    <div
      className={clsx(
        'pointer-events-auto w-full bg-white rounded-lg shadow-lg border overflow-hidden',
        'transform transition-all duration-150 ease-out',
        bgColors[toast.type],
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : `${enterAnimation} opacity-0`
      )}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">{icons[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{toast.title}</p>
            {toast.message && (
              <p className="mt-1 text-sm text-gray-600">{toast.message}</p>
            )}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  handleRemove();
                }}
                className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          {toast.dismissible && (
            <button
              type="button"
              onClick={handleRemove}
              className={clsx(
                'flex-shrink-0 p-1 -m-1 rounded-md',
                'text-gray-400 hover:text-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                'transition-colors'
              )}
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <ToastProgressBar duration={toast.duration} onComplete={handleRemove} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Toast Progress Bar
// -----------------------------------------------------------------------------

interface ToastProgressBarProps {
  duration: number;
  onComplete: () => void;
}

function ToastProgressBar({ duration }: ToastProgressBarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const percentage = (remaining / duration) * 100;
      setProgress(percentage);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    const animationId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationId);
  }, [duration]);

  return (
    <div className="h-1 bg-black/5">
      <div
        className="h-full bg-black/10 transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Standalone Toast Function (for use outside React)
// -----------------------------------------------------------------------------

let toastQueue: Array<Omit<Toast, 'id'>> = [];
let toastCallback: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function setToastCallback(callback: ((toast: Omit<Toast, 'id'>) => void) | null) {
  toastCallback = callback;
  // Process queued toasts
  if (callback && toastQueue.length > 0) {
    toastQueue.forEach(callback);
    toastQueue = [];
  }
}

export function toast(options: Omit<Toast, 'id'>) {
  if (toastCallback) {
    toastCallback(options);
  } else {
    toastQueue.push(options);
  }
}

toast.success = (title: string, message?: string) => {
  toast({ type: 'success', title, message });
};

toast.error = (title: string, message?: string) => {
  toast({ type: 'error', title, message, duration: 8000 });
};

toast.warning = (title: string, message?: string) => {
  toast({ type: 'warning', title, message });
};

toast.info = (title: string, message?: string) => {
  toast({ type: 'info', title, message });
};

export default ToastProvider;
