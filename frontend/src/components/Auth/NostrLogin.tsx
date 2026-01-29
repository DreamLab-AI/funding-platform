// =============================================================================
// NostrLogin Component - Login with Nostr Extension
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useNostrAuth } from '../../hooks/useNostrAuth';
import { NostrLoginResponse } from '../../lib/nostr/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NostrLoginProps {
  onSuccess?: (response: NostrLoginResponse) => void;
  onError?: (error: string) => void;
  className?: string;
  showNip05Input?: boolean;
  buttonText?: string;
  connectText?: string;
  loadingText?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NostrLogin({
  onSuccess,
  onError,
  className = '',
  showNip05Input = true,
  buttonText = 'Login with Nostr',
  connectText = 'Connect Extension',
  loadingText = 'Signing...',
}: NostrLoginProps): React.ReactElement {
  const [nip05, setNip05] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    isExtensionAvailable,
    isConnected,
    isConnecting,
    isLoggingIn,
    pubkey,
    npub,
    identity,
    error,
    connect,
    login,
    clearError,
  } = useNostrAuth({
    onLoginSuccess: onSuccess,
    onLoginError: onError,
  });

  // Handle connect button click
  const handleConnect = useCallback(async () => {
    clearError();
    await connect();
  }, [connect, clearError]);

  // Handle login button click
  const handleLogin = useCallback(async () => {
    clearError();
    const response = await login(nip05 || undefined);
    if (!response.success && onError) {
      onError(response.error || 'Login failed');
    }
  }, [login, nip05, clearError, onError]);

  // Auto-connect on mount if extension available
  useEffect(() => {
    if (isExtensionAvailable && !isConnected && !isConnecting) {
      // Small delay to let extension fully initialize
      const timeout = setTimeout(() => {
        connect();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isExtensionAvailable]);

  // No extension available
  if (!isExtensionAvailable) {
    return (
      <div className={`nostr-login ${className}`}>
        <div className="nostr-login__no-extension">
          <h3>Nostr Extension Required</h3>
          <p>
            To login with Nostr, please install a NIP-07 compatible browser extension:
          </p>
          <ul>
            <li>
              <a
                href="https://getalby.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Alby
              </a>{' '}
              - Lightning and Nostr wallet
            </li>
            <li>
              <a
                href="https://github.com/nickyc/nos2x"
                target="_blank"
                rel="noopener noreferrer"
              >
                nos2x
              </a>{' '}
              - Simple Nostr signer
            </li>
            <li>
              <a
                href="https://github.com/nickyc/nostr-keyx"
                target="_blank"
                rel="noopener noreferrer"
              >
                Nostr-keyx
              </a>{' '}
              - Cross-browser extension
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={`nostr-login ${className}`}>
      {error && (
        <div className="nostr-login__error">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="nostr-login__error-dismiss"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {!isConnected ? (
        <div className="nostr-login__connect">
          <p>Connect your Nostr extension to continue</p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="nostr-login__button nostr-login__button--connect"
          >
            {isConnecting ? 'Connecting...' : connectText}
          </button>
        </div>
      ) : (
        <div className="nostr-login__connected">
          <div className="nostr-login__identity">
            <div className="nostr-login__pubkey">
              <label>Connected as:</label>
              <code title={pubkey || undefined}>
                {npub ? `${npub.slice(0, 12)}...${npub.slice(-8)}` : 'Unknown'}
              </code>
            </div>

            {identity?.nip05?.verified && (
              <div className="nostr-login__nip05-verified">
                <span className="nostr-login__verified-badge">Verified</span>
                <span>{identity.nip05.identifier}</span>
              </div>
            )}
          </div>

          {showNip05Input && (
            <div className="nostr-login__advanced">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="nostr-login__advanced-toggle"
              >
                {showAdvanced ? 'Hide' : 'Show'} NIP-05 verification
              </button>

              {showAdvanced && (
                <div className="nostr-login__nip05-input">
                  <label htmlFor="nostr-nip05">
                    NIP-05 Identifier (optional):
                  </label>
                  <input
                    id="nostr-nip05"
                    type="text"
                    value={nip05}
                    onChange={(e) => setNip05(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoggingIn}
                  />
                  <small>
                    Enter your verified NIP-05 identifier for enhanced identity verification
                  </small>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="nostr-login__button nostr-login__button--login"
          >
            {isLoggingIn ? loadingText : buttonText}
          </button>

          <p className="nostr-login__hint">
            Your extension will prompt you to sign a message
          </p>
        </div>
      )}

      <style>{`
        .nostr-login {
          max-width: 400px;
          padding: 1.5rem;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .nostr-login__error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .nostr-login__error-dismiss {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: #dc2626;
          padding: 0 0.25rem;
        }

        .nostr-login__no-extension h3 {
          margin: 0 0 0.75rem;
          font-size: 1.125rem;
        }

        .nostr-login__no-extension p {
          margin: 0 0 1rem;
          color: #666;
        }

        .nostr-login__no-extension ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .nostr-login__no-extension li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        }

        .nostr-login__no-extension li:last-child {
          border-bottom: none;
        }

        .nostr-login__no-extension a {
          color: #7c3aed;
          font-weight: 500;
        }

        .nostr-login__connect {
          text-align: center;
        }

        .nostr-login__connect p {
          margin: 0 0 1rem;
          color: #666;
        }

        .nostr-login__button {
          display: block;
          width: 100%;
          padding: 0.875rem 1.5rem;
          font-size: 1rem;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s, opacity 0.2s;
        }

        .nostr-login__button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .nostr-login__button--connect {
          background: #f3f4f6;
          color: #374151;
        }

        .nostr-login__button--connect:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .nostr-login__button--login {
          background: #7c3aed;
          color: white;
        }

        .nostr-login__button--login:hover:not(:disabled) {
          background: #6d28d9;
        }

        .nostr-login__identity {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 6px;
        }

        .nostr-login__pubkey {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nostr-login__pubkey label {
          font-size: 0.875rem;
          color: #666;
        }

        .nostr-login__pubkey code {
          font-family: monospace;
          font-size: 0.875rem;
          padding: 0.25rem 0.5rem;
          background: #e5e7eb;
          border-radius: 4px;
        }

        .nostr-login__nip05-verified {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }

        .nostr-login__verified-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          background: #d1fae5;
          color: #059669;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .nostr-login__advanced {
          margin-bottom: 1rem;
        }

        .nostr-login__advanced-toggle {
          background: none;
          border: none;
          color: #7c3aed;
          cursor: pointer;
          font-size: 0.875rem;
          padding: 0;
          text-decoration: underline;
        }

        .nostr-login__nip05-input {
          margin-top: 0.75rem;
        }

        .nostr-login__nip05-input label {
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .nostr-login__nip05-input input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .nostr-login__nip05-input input:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .nostr-login__nip05-input small {
          display: block;
          margin-top: 0.25rem;
          color: #666;
          font-size: 0.75rem;
        }

        .nostr-login__hint {
          margin: 0.75rem 0 0;
          text-align: center;
          font-size: 0.75rem;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

export default NostrLogin;
