// =============================================================================
// NostrQR Component - QR Code for Mobile Wallet Authentication
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NostrAuthChallenge } from '../../lib/nostr/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NostrQRProps {
  challenge: NostrAuthChallenge | null;
  onRefresh?: () => Promise<NostrAuthChallenge>;
  onCopy?: () => void;
  className?: string;
  size?: number;
  expiryWarningSeconds?: number;
}

// -----------------------------------------------------------------------------
// QR Code Generation (using qrcode-generator pattern)
// -----------------------------------------------------------------------------

/**
 * Generate QR code as SVG
 * This is a simplified implementation - for production, use a library like 'qrcode'
 */
function generateQRCodeSVG(data: string, size: number = 200): string {
  // For a real implementation, use the 'qrcode' package
  // This is a placeholder that shows the data
  const cellSize = size / 25;

  // Simple placeholder pattern
  const pattern = `
    <rect x="0" y="0" width="${size}" height="${size}" fill="white"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" font-size="10" fill="#666">
      QR Code
    </text>
    <text x="${size / 2}" y="${size / 2 + 15}" text-anchor="middle" font-size="8" fill="#999">
      (Install qrcode package)
    </text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${pattern}</svg>`;
}

/**
 * Generate Nostr auth URI for QR code
 * Format: nostr+auth:<challenge>?relay=<relay>&callback=<callback>
 */
function generateNostrAuthUri(challenge: NostrAuthChallenge, callbackUrl?: string): string {
  const params = new URLSearchParams();

  if (challenge.relay) {
    params.set('relay', challenge.relay);
  }

  if (callbackUrl) {
    params.set('callback', callbackUrl);
  }

  const query = params.toString();
  return `nostr+auth:${challenge.challenge}${query ? '?' + query : ''}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NostrQR({
  challenge,
  onRefresh,
  onCopy,
  className = '',
  size = 200,
  expiryWarningSeconds = 60,
}: NostrQRProps): React.ReactElement {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate time remaining
  const updateTimeRemaining = useCallback(() => {
    if (!challenge) {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const remaining = challenge.expiresAt - now;

    if (remaining <= 0) {
      setTimeRemaining(0);
      setIsExpired(true);
    } else {
      setTimeRemaining(remaining);
      setIsExpired(false);
    }
  }, [challenge]);

  // Generate QR code when challenge changes
  useEffect(() => {
    if (challenge) {
      const uri = generateNostrAuthUri(challenge);
      const svg = generateQRCodeSVG(uri, size);
      setQrSvg(svg);
    } else {
      setQrSvg('');
    }
  }, [challenge, size]);

  // Update timer
  useEffect(() => {
    updateTimeRemaining();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (challenge) {
      timerRef.current = setInterval(updateTimeRemaining, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [challenge, updateTimeRemaining]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (!challenge) return;

    const uri = generateNostrAuthUri(challenge);

    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      onCopy?.();

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [challenge, onCopy]);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine status
  const isWarning = timeRemaining !== null && timeRemaining <= expiryWarningSeconds && !isExpired;

  if (!challenge) {
    return (
      <div className={`nostr-qr nostr-qr--loading ${className}`}>
        <div className="nostr-qr__placeholder">
          <p>Generating authentication code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`nostr-qr ${className}`}>
      <div className="nostr-qr__container">
        {isExpired ? (
          <div className="nostr-qr__expired">
            <p>Code expired</p>
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="nostr-qr__refresh-button"
              >
                {isRefreshing ? 'Refreshing...' : 'Generate New Code'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="nostr-qr__code"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <div className={`nostr-qr__timer ${isWarning ? 'nostr-qr__timer--warning' : ''}`}>
              <span>Expires in: </span>
              <strong>{formatTime(timeRemaining || 0)}</strong>
            </div>
          </>
        )}
      </div>

      <div className="nostr-qr__instructions">
        <h4>Scan with your Nostr app</h4>
        <ol>
          <li>Open your Nostr mobile app</li>
          <li>Navigate to the scanner or login section</li>
          <li>Scan this QR code to authenticate</li>
        </ol>
      </div>

      <div className="nostr-qr__actions">
        <button
          type="button"
          onClick={handleCopy}
          disabled={isExpired}
          className="nostr-qr__copy-button"
        >
          {copied ? 'Copied!' : 'Copy Auth Link'}
        </button>

        {onRefresh && !isExpired && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="nostr-qr__refresh-button nostr-qr__refresh-button--secondary"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      <p className="nostr-qr__supported-apps">
        Works with:{' '}
        <a href="https://damus.io" target="_blank" rel="noopener noreferrer">Damus</a>,{' '}
        <a href="https://snort.social" target="_blank" rel="noopener noreferrer">Snort</a>,{' '}
        <a href="https://nostrid.com" target="_blank" rel="noopener noreferrer">Nostrid</a>
      </p>

      <style>{`
        .nostr-qr {
          max-width: 320px;
          padding: 1.5rem;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .nostr-qr__container {
          text-align: center;
          margin-bottom: 1rem;
        }

        .nostr-qr__placeholder {
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border-radius: 8px;
          color: #666;
        }

        .nostr-qr__code {
          display: inline-block;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .nostr-qr__code svg {
          display: block;
        }

        .nostr-qr__timer {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: #666;
        }

        .nostr-qr__timer--warning {
          color: #f59e0b;
        }

        .nostr-qr__timer strong {
          font-family: monospace;
        }

        .nostr-qr__expired {
          height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: #fef2f2;
          border-radius: 8px;
          color: #dc2626;
        }

        .nostr-qr__instructions {
          margin-bottom: 1rem;
        }

        .nostr-qr__instructions h4 {
          margin: 0 0 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .nostr-qr__instructions ol {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: #666;
        }

        .nostr-qr__instructions li {
          margin-bottom: 0.25rem;
        }

        .nostr-qr__actions {
          display: flex;
          gap: 0.5rem;
        }

        .nostr-qr__copy-button,
        .nostr-qr__refresh-button {
          flex: 1;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s, opacity 0.2s;
        }

        .nostr-qr__copy-button:disabled,
        .nostr-qr__refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .nostr-qr__copy-button {
          background: #7c3aed;
          color: white;
        }

        .nostr-qr__copy-button:hover:not(:disabled) {
          background: #6d28d9;
        }

        .nostr-qr__refresh-button {
          background: #7c3aed;
          color: white;
        }

        .nostr-qr__refresh-button:hover:not(:disabled) {
          background: #6d28d9;
        }

        .nostr-qr__refresh-button--secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .nostr-qr__refresh-button--secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .nostr-qr__supported-apps {
          margin: 1rem 0 0;
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
        }

        .nostr-qr__supported-apps a {
          color: #7c3aed;
        }
      `}</style>
    </div>
  );
}

export default NostrQR;
