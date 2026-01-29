// =============================================================================
// useNostrIdentity Hook - DID Resolution and Verification
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NostrIdentity,
  NostrDIDDocument,
  NostrProfileMetadata,
  Nip05Identifier,
  DIDResolutionResult,
} from '../lib/nostr/types';
import {
  isValidPubkey,
  pubkeyToNpub,
  parseToHexPubkey,
  isValidNpub,
} from '../lib/nostr/keys';
import {
  pubkeyToDid,
  didToPubkey,
  isValidNostrDid,
  resolveNostrDid,
  generateDIDDocument,
  createNostrIdentity,
  updateNostrIdentity,
  verifyDIDDocument,
} from '../lib/nostr/did';
import {
  verifyNip05,
  looksLikeNip05,
  clearNip05Cache,
} from '../lib/nostr/nip05';
import { useNostr } from './useNostr';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseNostrIdentityOptions {
  autoFetchProfile?: boolean;
  autoVerifyNip05?: boolean;
  relays?: string[];
}

interface UseNostrIdentityState {
  identity: NostrIdentity | null;
  isLoading: boolean;
  isVerifying: boolean;
  error: string | null;
  profileFetched: boolean;
  nip05Verified: boolean;
}

interface UseNostrIdentityReturn extends UseNostrIdentityState {
  resolve: (input: string) => Promise<NostrIdentity | null>;
  resolveDid: (did: string) => Promise<DIDResolutionResult>;
  verifyIdentityNip05: (nip05: string) => Promise<boolean>;
  fetchProfile: (pubkey: string) => Promise<NostrProfileMetadata | null>;
  refresh: () => Promise<void>;
  clear: () => void;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useNostrIdentity(
  initialInput?: string,
  options: UseNostrIdentityOptions = {}
): UseNostrIdentityReturn {
  const {
    autoFetchProfile = true,
    autoVerifyNip05 = true,
    relays,
  } = options;

  const [state, setState] = useState<UseNostrIdentityState>({
    identity: null,
    isLoading: false,
    isVerifying: false,
    error: null,
    profileFetched: false,
    nip05Verified: false,
  });

  const mountedRef = useRef(true);
  const currentInputRef = useRef<string | undefined>(initialInput);

  // Use Nostr hook for relay connections
  const nostr = useNostr({
    relays,
    autoConnect: autoFetchProfile,
  });

  // Resolve identity from various input formats
  const resolve = useCallback(
    async (input: string): Promise<NostrIdentity | null> => {
      if (!input) {
        setState((prev) => ({
          ...prev,
          error: 'No input provided',
        }));
        return null;
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        profileFetched: false,
        nip05Verified: false,
      }));

      try {
        let pubkey: string;

        // Determine input type and extract pubkey
        if (isValidPubkey(input)) {
          pubkey = input.toLowerCase();
        } else if (isValidNpub(input)) {
          pubkey = parseToHexPubkey(input);
        } else if (isValidNostrDid(input)) {
          pubkey = didToPubkey(input);
        } else if (looksLikeNip05(input)) {
          // Resolve NIP-05 to pubkey
          const nip05Result = await verifyNip05(input);
          if (!nip05Result) {
            throw new Error('NIP-05 verification failed');
          }
          pubkey = nip05Result.pubkey;
        } else {
          throw new Error('Invalid input format');
        }

        // Create identity
        let identity = await createNostrIdentity(pubkey);

        // Fetch profile if connected and auto-fetch enabled
        if (autoFetchProfile && nostr.isConnected) {
          const profile = await nostr.fetchProfile(pubkey);
          if (profile) {
            identity = await updateNostrIdentity(identity, { profile });
            if (mountedRef.current) {
              setState((prev) => ({ ...prev, profileFetched: true }));
            }
          }
        }

        // Verify NIP-05 if auto-verify enabled
        if (autoVerifyNip05 && identity.profile?.nip05) {
          const nip05Result = await verifyNip05(identity.profile.nip05, pubkey);
          if (nip05Result) {
            identity = {
              ...identity,
              nip05: nip05Result,
              didDocument: generateDIDDocument(pubkey, {
                profile: identity.profile,
                nip05: nip05Result,
              }),
            };
            if (mountedRef.current) {
              setState((prev) => ({ ...prev, nip05Verified: true }));
            }
          }
        }

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            identity,
            isLoading: false,
            error: null,
          }));
        }

        return identity;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Resolution failed';

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            identity: null,
            isLoading: false,
            error: errorMessage,
          }));
        }

        return null;
      }
    },
    [nostr.isConnected, nostr.fetchProfile, autoFetchProfile, autoVerifyNip05]
  );

  // Resolve DID document
  const resolveDid = useCallback(
    async (did: string): Promise<DIDResolutionResult> => {
      if (!isValidNostrDid(did)) {
        return {
          didDocument: null,
          didDocumentMetadata: {},
          didResolutionMetadata: {
            error: 'invalidDid',
            errorMessage: 'Not a valid Nostr DID',
          },
        };
      }

      return resolveNostrDid(did, {
        relays,
        fetchProfile: autoFetchProfile,
        verifyNip05: autoVerifyNip05,
      });
    },
    [relays, autoFetchProfile, autoVerifyNip05]
  );

  // Verify NIP-05 for current identity
  const verifyIdentityNip05 = useCallback(
    async (nip05: string): Promise<boolean> => {
      if (!state.identity) {
        return false;
      }

      setState((prev) => ({ ...prev, isVerifying: true }));

      try {
        const result = await verifyNip05(nip05, state.identity.pubkey);

        if (result && mountedRef.current) {
          setState((prev) => ({
            ...prev,
            identity: prev.identity
              ? {
                  ...prev.identity,
                  nip05: result,
                  didDocument: generateDIDDocument(prev.identity.pubkey, {
                    profile: prev.identity.profile,
                    nip05: result,
                  }),
                }
              : null,
            isVerifying: false,
            nip05Verified: true,
          }));
        } else if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isVerifying: false,
          }));
        }

        return !!result;
      } catch (error) {
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isVerifying: false,
            error: error instanceof Error ? error.message : 'NIP-05 verification failed',
          }));
        }
        return false;
      }
    },
    [state.identity]
  );

  // Fetch profile for a pubkey
  const fetchProfileFn = useCallback(
    async (pubkey: string): Promise<NostrProfileMetadata | null> => {
      if (!nostr.isConnected) {
        await nostr.connect();
      }
      return nostr.fetchProfile(pubkey);
    },
    [nostr]
  );

  // Refresh current identity
  const refresh = useCallback(async () => {
    if (!state.identity?.pubkey) {
      return;
    }

    // Clear NIP-05 cache for fresh verification
    if (state.identity.nip05?.identifier) {
      clearNip05Cache();
    }

    await resolve(state.identity.pubkey);
  }, [state.identity, resolve]);

  // Clear identity
  const clear = useCallback(() => {
    setState({
      identity: null,
      isLoading: false,
      isVerifying: false,
      error: null,
      profileFetched: false,
      nip05Verified: false,
    });
  }, []);

  // Resolve initial input on mount
  useEffect(() => {
    mountedRef.current = true;

    if (initialInput && initialInput !== currentInputRef.current) {
      currentInputRef.current = initialInput;
      resolve(initialInput);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [initialInput, resolve]);

  return {
    ...state,
    resolve,
    resolveDid,
    verifyIdentityNip05,
    fetchProfile: fetchProfileFn,
    refresh,
    clear,
  };
}

// -----------------------------------------------------------------------------
// Utility Hook: Verify Nostr Identity
// -----------------------------------------------------------------------------

/**
 * Simple hook to verify a Nostr identity string
 * Returns verification status and identity data
 */
export function useNostrVerification(input: string | undefined): {
  isVerified: boolean;
  isVerifying: boolean;
  identity: NostrIdentity | null;
  error: string | null;
} {
  const { identity, isLoading, error } = useNostrIdentity(input, {
    autoFetchProfile: true,
    autoVerifyNip05: true,
  });

  return {
    isVerified: !!identity?.nip05?.verified,
    isVerifying: isLoading,
    identity,
    error,
  };
}

export default useNostrIdentity;
