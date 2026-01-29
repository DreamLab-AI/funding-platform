// =============================================================================
// useNostr Hook - Nostr Connection and Event Handling
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NostrEvent,
  NostrFilter,
  RelayConnectionStatus,
  RelayConnection,
  NostrProfileMetadata,
  NostrEventKind,
} from '../lib/nostr/types';
import {
  hasNostrExtension,
  getPublicKeyFromExtension,
  getRelaysFromExtension,
  pubkeyToNpub,
} from '../lib/nostr/keys';
import { verifyEvent, getEventTagValue } from '../lib/nostr/events';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseNostrOptions {
  relays?: string[];
  autoConnect?: boolean;
  timeout?: number;
}

interface UseNostrState {
  isConnected: boolean;
  isConnecting: boolean;
  relays: Map<string, RelayConnection>;
  error: string | null;
}

interface UseNostrReturn extends UseNostrState {
  connect: (relays?: string[]) => Promise<void>;
  disconnect: () => void;
  subscribe: (
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ) => string;
  unsubscribe: (subscriptionId: string) => void;
  publish: (event: NostrEvent) => Promise<{ success: boolean; relays: string[] }>;
  fetchProfile: (pubkey: string) => Promise<NostrProfileMetadata | null>;
  fetchEvents: (filters: NostrFilter[], timeout?: number) => Promise<NostrEvent[]>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

const DEFAULT_TIMEOUT = 10000;

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useNostr(options: UseNostrOptions = {}): UseNostrReturn {
  const {
    relays: initialRelays = DEFAULT_RELAYS,
    autoConnect = false,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const [state, setState] = useState<UseNostrState>({
    isConnected: false,
    isConnecting: false,
    relays: new Map(),
    error: null,
  });

  const subscriptionsRef = useRef<Map<string, {
    filters: NostrFilter[];
    onEvent: (event: NostrEvent) => void;
    onEose?: () => void;
  }>>(new Map());

  const socketsRef = useRef<Map<string, WebSocket>>(new Map());

  // Generate subscription ID
  const generateSubId = useCallback((): string => {
    return Math.random().toString(36).substring(2, 15);
  }, []);

  // Handle incoming relay messages
  const handleRelayMessage = useCallback(
    (relayUrl: string, data: string) => {
      try {
        const message = JSON.parse(data);
        const [type, subId, ...rest] = message;

        switch (type) {
          case 'EVENT': {
            const event = rest[0] as NostrEvent;
            const subscription = subscriptionsRef.current.get(subId);
            if (subscription) {
              // Verify event before passing to callback
              verifyEvent(event).then(({ valid }) => {
                if (valid) {
                  subscription.onEvent(event);
                }
              });
            }
            break;
          }
          case 'EOSE': {
            const subscription = subscriptionsRef.current.get(subId);
            if (subscription?.onEose) {
              subscription.onEose();
            }
            break;
          }
          case 'OK': {
            // Event was accepted/rejected
            const [eventId, success, message] = rest;
            if (!success) {
              console.warn(`Event ${eventId} rejected by ${relayUrl}: ${message}`);
            }
            break;
          }
          case 'NOTICE': {
            console.log(`Notice from ${relayUrl}: ${subId}`);
            break;
          }
          case 'CLOSED': {
            const [, reason] = rest;
            console.log(`Subscription ${subId} closed by ${relayUrl}: ${reason}`);
            break;
          }
        }
      } catch (error) {
        console.error(`Error parsing message from ${relayUrl}:`, error);
      }
    },
    []
  );

  // Connect to a single relay
  const connectToRelay = useCallback(
    (relayUrl: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already connected
        const existingSocket = socketsRef.current.get(relayUrl);
        if (existingSocket?.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        // Clean up existing socket
        if (existingSocket) {
          existingSocket.close();
          socketsRef.current.delete(relayUrl);
        }

        try {
          const socket = new WebSocket(relayUrl);
          let timeoutId: NodeJS.Timeout;

          socket.onopen = () => {
            clearTimeout(timeoutId);
            socketsRef.current.set(relayUrl, socket);

            setState((prev) => {
              const relays = new Map(prev.relays);
              relays.set(relayUrl, {
                url: relayUrl,
                status: RelayConnectionStatus.CONNECTED,
                socket,
                subscriptions: new Map(),
                connectedAt: Date.now(),
              });
              return {
                ...prev,
                relays,
                isConnected: true,
              };
            });

            // Resubscribe to existing subscriptions
            for (const [subId, sub] of subscriptionsRef.current) {
              const message = JSON.stringify(['REQ', subId, ...sub.filters]);
              socket.send(message);
            }

            resolve();
          };

          socket.onmessage = (event) => {
            handleRelayMessage(relayUrl, event.data);
          };

          socket.onerror = (event) => {
            clearTimeout(timeoutId);
            console.error(`WebSocket error for ${relayUrl}:`, event);

            setState((prev) => {
              const relays = new Map(prev.relays);
              relays.set(relayUrl, {
                url: relayUrl,
                status: RelayConnectionStatus.ERROR,
                subscriptions: new Map(),
                lastError: 'Connection error',
              });
              return { ...prev, relays };
            });
          };

          socket.onclose = () => {
            socketsRef.current.delete(relayUrl);

            setState((prev) => {
              const relays = new Map(prev.relays);
              const existing = relays.get(relayUrl);
              relays.set(relayUrl, {
                url: relayUrl,
                status: RelayConnectionStatus.DISCONNECTED,
                subscriptions: existing?.subscriptions || new Map(),
                disconnectedAt: Date.now(),
              });

              // Check if any relay is still connected
              const isConnected = Array.from(relays.values()).some(
                (r) => r.status === RelayConnectionStatus.CONNECTED
              );

              return { ...prev, relays, isConnected };
            });
          };

          // Set connection timeout
          timeoutId = setTimeout(() => {
            socket.close();
            reject(new Error(`Connection to ${relayUrl} timed out`));
          }, timeout);
        } catch (error) {
          reject(error);
        }
      });
    },
    [handleRelayMessage, timeout]
  );

  // Connect to multiple relays
  const connect = useCallback(
    async (relays?: string[]) => {
      const relayList = relays || initialRelays;

      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      try {
        // Try to get relays from extension
        let extensionRelays: string[] = [];
        if (hasNostrExtension()) {
          try {
            const relayConfig = await getRelaysFromExtension();
            extensionRelays = Object.entries(relayConfig)
              .filter(([, config]) => config.read || config.write)
              .map(([url]) => url);
          } catch {
            // Extension doesn't support getRelays
          }
        }

        // Combine with provided relays (dedupe)
        const allRelays = [...new Set([...relayList, ...extensionRelays])];

        // Connect to all relays in parallel
        const results = await Promise.allSettled(
          allRelays.map((url) => connectToRelay(url))
        );

        // Check if at least one connection succeeded
        const connectedCount = results.filter(
          (r) => r.status === 'fulfilled'
        ).length;

        if (connectedCount === 0) {
          throw new Error('Failed to connect to any relay');
        }

        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        }));
      }
    },
    [initialRelays, connectToRelay]
  );

  // Disconnect from all relays
  const disconnect = useCallback(() => {
    for (const socket of socketsRef.current.values()) {
      socket.close();
    }
    socketsRef.current.clear();
    subscriptionsRef.current.clear();

    setState({
      isConnected: false,
      isConnecting: false,
      relays: new Map(),
      error: null,
    });
  }, []);

  // Subscribe to events
  const subscribe = useCallback(
    (
      filters: NostrFilter[],
      onEvent: (event: NostrEvent) => void,
      onEose?: () => void
    ): string => {
      const subId = generateSubId();

      subscriptionsRef.current.set(subId, { filters, onEvent, onEose });

      // Send subscription to all connected relays
      const message = JSON.stringify(['REQ', subId, ...filters]);
      for (const socket of socketsRef.current.values()) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }

      return subId;
    },
    [generateSubId]
  );

  // Unsubscribe
  const unsubscribe = useCallback((subscriptionId: string) => {
    subscriptionsRef.current.delete(subscriptionId);

    // Send CLOSE to all relays
    const message = JSON.stringify(['CLOSE', subscriptionId]);
    for (const socket of socketsRef.current.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }, []);

  // Publish event
  const publish = useCallback(
    async (event: NostrEvent): Promise<{ success: boolean; relays: string[] }> => {
      const successRelays: string[] = [];
      const message = JSON.stringify(['EVENT', event]);

      for (const [url, socket] of socketsRef.current) {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(message);
            successRelays.push(url);
          } catch {
            // Socket send failed
          }
        }
      }

      return {
        success: successRelays.length > 0,
        relays: successRelays,
      };
    },
    []
  );

  // Fetch profile metadata
  const fetchProfile = useCallback(
    async (pubkey: string): Promise<NostrProfileMetadata | null> => {
      return new Promise((resolve) => {
        const events: NostrEvent[] = [];

        const subId = subscribe(
          [{ kinds: [NostrEventKind.METADATA], authors: [pubkey], limit: 1 }],
          (event) => {
            events.push(event);
          },
          () => {
            unsubscribe(subId);

            if (events.length === 0) {
              resolve(null);
              return;
            }

            // Get the most recent metadata event
            const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

            try {
              const metadata = JSON.parse(latestEvent.content);
              resolve(metadata as NostrProfileMetadata);
            } catch {
              resolve(null);
            }
          }
        );

        // Timeout fallback
        setTimeout(() => {
          unsubscribe(subId);
          if (events.length === 0) {
            resolve(null);
          }
        }, timeout);
      });
    },
    [subscribe, unsubscribe, timeout]
  );

  // Fetch events with filters
  const fetchEvents = useCallback(
    async (filters: NostrFilter[], fetchTimeout?: number): Promise<NostrEvent[]> => {
      return new Promise((resolve) => {
        const events: NostrEvent[] = [];
        const seenIds = new Set<string>();

        const subId = subscribe(
          filters,
          (event) => {
            if (!seenIds.has(event.id)) {
              seenIds.add(event.id);
              events.push(event);
            }
          },
          () => {
            unsubscribe(subId);
            resolve(events);
          }
        );

        // Timeout fallback
        setTimeout(() => {
          unsubscribe(subId);
          resolve(events);
        }, fetchTimeout || timeout);
      });
    },
    [subscribe, unsubscribe, timeout]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // Intentionally not including connect/disconnect

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    fetchProfile,
    fetchEvents,
  };
}

export default useNostr;
