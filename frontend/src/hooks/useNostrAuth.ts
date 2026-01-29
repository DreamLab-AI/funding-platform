// =============================================================================
// useNostrAuth Hook - Authentication with Browser Extension
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NostrIdentity,
  NostrProfileMetadata,
  NostrLoginResponse,
} from '../lib/nostr/types';
import {
  hasNostrExtension,
  getPublicKeyFromExtension,
  pubkeyToNpub,
  isValidPubkey,
} from '../lib/nostr/keys';
import {
  nostrLogin,
  linkNostrIdentity,
  unlinkNostrIdentity,
} from '../lib/nostr/auth';
import { createNostrIdentity, pubkeyToDid } from '../lib/nostr/did';
import { verifyNip05 } from '../lib/nostr/nip05';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseNostrAuthOptions {
  apiEndpoint?: string;
  onLoginSuccess?: (response: NostrLoginResponse) => void;
  onLoginError?: (error: string) => void;
}

interface UseNostrAuthState {
  isExtensionAvailable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isLoggingIn: boolean;
  pubkey: string | null;
  npub: string | null;
  identity: NostrIdentity | null;
  error: string | null;
}

interface UseNostrAuthReturn extends UseNostrAuthState {
  connect: () => Promise<void>;
  disconnect: () => void;
  login: (nip05?: string) => Promise<NostrLoginResponse>;
  linkIdentity: (accessToken: string, nip05?: string) => Promise<{ success: boolean; error?: string }>;
  unlinkIdentity: (accessToken: string) => Promise<{ success: boolean; error?: string }>;
  refreshIdentity: () => Promise<void>;
  clearError: () => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const STORAGE_KEY_PUBKEY = 'nostr_pubkey';

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useNostrAuth(options: UseNostrAuthOptions = {}): UseNostrAuthReturn {
  const {
    apiEndpoint = API_BASE_URL,
    onLoginSuccess,
    onLoginError,
  } = options;

  const [state, setState] = useState<UseNostrAuthState>({
    isExtensionAvailable: false,
    isConnected: false,
    isConnecting: false,
    isLoggingIn: false,
    pubkey: null,
    npub: null,
    identity: null,
    error: null,
  });

  const mountedRef = useRef(true);

  // Check for extension availability
  useEffect(() => {
    mountedRef.current = true;

    const checkExtension = () => {
      const available = hasNostrExtension();
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isExtensionAvailable: available }));
      }
    };

    // Check immediately
    checkExtension();

    // Also check after a delay (extension might load after page)
    const timeoutId = setTimeout(checkExtension, 1000);

    // Check for stored pubkey
    const storedPubkey = localStorage.getItem(STORAGE_KEY_PUBKEY);
    if (storedPubkey && isValidPubkey(storedPubkey)) {
      setState((prev) => ({
        ...prev,
        pubkey: storedPubkey,
        npub: pubkeyToNpub(storedPubkey),
      }));
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Connect to extension and get public key
  const connect = useCallback(async () => {
    if (!hasNostrExtension()) {
      setState((prev) => ({
        ...prev,
        error: 'Nostr extension not found. Please install nos2x, Alby, or another NIP-07 compatible extension.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const pubkey = await getPublicKeyFromExtension();

      if (!isValidPubkey(pubkey)) {
        throw new Error('Invalid public key from extension');
      }

      const npub = pubkeyToNpub(pubkey);

      // Store pubkey for persistence
      localStorage.setItem(STORAGE_KEY_PUBKEY, pubkey);

      // Create basic identity
      const identity = await createNostrIdentity(pubkey);

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          pubkey,
          npub,
          identity,
          error: null,
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: error instanceof Error ? error.message : 'Failed to connect',
        }));
      }
    }
  }, []);

  // Disconnect (clear local state)
  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_PUBKEY);

    setState((prev) => ({
      ...prev,
      isConnected: false,
      pubkey: null,
      npub: null,
      identity: null,
      error: null,
    }));
  }, []);

  // Login with Nostr
  const login = useCallback(
    async (nip05?: string): Promise<NostrLoginResponse> => {
      setState((prev) => ({ ...prev, isLoggingIn: true, error: null }));

      try {
        const response = await nostrLogin(apiEndpoint, nip05);

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoggingIn: false,
            error: response.success ? null : response.error || 'Login failed',
          }));
        }

        if (response.success) {
          onLoginSuccess?.(response);
        } else {
          onLoginError?.(response.error || 'Login failed');
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoggingIn: false,
            error: errorMessage,
          }));
        }

        onLoginError?.(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [apiEndpoint, onLoginSuccess, onLoginError]
  );

  // Link Nostr identity to existing account
  const linkIdentityFn = useCallback(
    async (
      accessToken: string,
      nip05?: string
    ): Promise<{ success: boolean; error?: string }> => {
      return linkNostrIdentity(apiEndpoint, accessToken, nip05);
    },
    [apiEndpoint]
  );

  // Unlink Nostr identity from account
  const unlinkIdentityFn = useCallback(
    async (accessToken: string): Promise<{ success: boolean; error?: string }> => {
      const result = await unlinkNostrIdentity(apiEndpoint, accessToken);

      if (result.success) {
        disconnect();
      }

      return result;
    },
    [apiEndpoint, disconnect]
  );

  // Refresh identity (re-fetch profile and verify NIP-05)
  const refreshIdentity = useCallback(async () => {
    if (!state.pubkey) {
      return;
    }

    try {
      // Re-create identity with fresh verification
      const identity = await createNostrIdentity(state.pubkey);

      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          identity,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh identity:', error);
    }
  }, [state.pubkey]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    login,
    linkIdentity: linkIdentityFn,
    unlinkIdentity: unlinkIdentityFn,
    refreshIdentity,
    clearError,
  };
}

export default useNostrAuth;
