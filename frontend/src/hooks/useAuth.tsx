// =============================================================================
// useAuth Hook - Authentication State Management
// =============================================================================

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { User, UserRole, LoginCredentials, RegisterData, AuthUser } from '../types';
import { authApi } from '../services/api';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isApplicant: boolean;
  isAssessor: boolean;
  isCoordinator: boolean;
  isSchemeOwner: boolean;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider Component
// -----------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const user = await authApi.getCurrentUser();
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch {
        // Token invalid or expired
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    checkAuth();
  }, []);

  const setAuthData = useCallback((authUser: AuthUser) => {
    localStorage.setItem('accessToken', authUser.accessToken);
    localStorage.setItem('refreshToken', authUser.refreshToken);
    setState({
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        organisation: authUser.organisation,
        createdAt: authUser.createdAt,
        updatedAt: authUser.updatedAt,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const authUser = await authApi.login(credentials);
        setAuthData(authUser);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Login failed. Please try again.';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw err;
      }
    },
    [setAuthData]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const authUser = await authApi.register(data);
        setAuthData(authUser);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Registration failed. Please try again.';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw err;
      }
    },
    [setAuthData]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors - clear local state anyway
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!state.user) return false;
      if (Array.isArray(role)) {
        return role.includes(state.user.role);
      }
      return state.user.role === role;
    },
    [state.user]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    clearError,
    hasRole,
    isApplicant: state.user?.role === UserRole.APPLICANT,
    isAssessor: state.user?.role === UserRole.ASSESSOR,
    isCoordinator: state.user?.role === UserRole.COORDINATOR,
    isSchemeOwner: state.user?.role === UserRole.SCHEME_OWNER,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Export Context for testing
// -----------------------------------------------------------------------------

export { AuthContext };
