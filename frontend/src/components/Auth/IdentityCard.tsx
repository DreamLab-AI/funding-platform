// =============================================================================
// IdentityCard Component - Display Verified Nostr Identity
// =============================================================================

import React, { useState, useCallback } from 'react';
import { NostrIdentity, NostrProfileMetadata } from '../../lib/nostr/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface IdentityCardProps {
  identity: NostrIdentity;
  showDid?: boolean;
  showPubkey?: boolean;
  showVerification?: boolean;
  expandable?: boolean;
  onUnlink?: () => void;
  onRefresh?: () => void;
  className?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function truncateMiddle(str: string, startChars: number = 8, endChars: number = 8): string {
  if (str.length <= startChars + endChars + 3) {
    return str;
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function IdentityCard({
  identity,
  showDid = true,
  showPubkey = true,
  showVerification = true,
  expandable = true,
  onUnlink,
  onRefresh,
  className = '',
}: IdentityCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const profile = identity.profile;
  const nip05 = identity.nip05;

  // Handle copy
  const handleCopy = useCallback(async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // Display name
  const displayName = profile?.display_name || profile?.name || truncateMiddle(identity.npub, 8, 8);

  return (
    <div className={`identity-card ${className}`}>
      {/* Header */}
      <div className="identity-card__header">
        {profile?.picture ? (
          <img
            src={profile.picture}
            alt={displayName}
            className="identity-card__avatar"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="identity-card__avatar identity-card__avatar--placeholder">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="identity-card__info">
          <h3 className="identity-card__name">{displayName}</h3>

          {nip05?.verified && (
            <div className="identity-card__nip05">
              <span className="identity-card__verified-badge" title="NIP-05 Verified">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </span>
              <span>{nip05.identifier}</span>
            </div>
          )}

          {profile?.about && (
            <p className="identity-card__about">{profile.about}</p>
          )}
        </div>
      </div>

      {/* Identity Details */}
      <div className="identity-card__details">
        {showPubkey && (
          <div className="identity-card__field">
            <label>npub:</label>
            <div className="identity-card__value">
              <code title={identity.npub}>{truncateMiddle(identity.npub, 12, 8)}</code>
              <button
                type="button"
                onClick={() => handleCopy('npub', identity.npub)}
                className="identity-card__copy"
                title="Copy npub"
              >
                {copiedField === 'npub' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {showDid && (
          <div className="identity-card__field">
            <label>DID:</label>
            <div className="identity-card__value">
              <code title={identity.did}>{truncateMiddle(identity.did, 16, 8)}</code>
              <button
                type="button"
                onClick={() => handleCopy('did', identity.did)}
                className="identity-card__copy"
                title="Copy DID"
              >
                {copiedField === 'did' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {showVerification && nip05 && (
          <div className="identity-card__verification">
            <div className="identity-card__verification-status">
              {nip05.verified ? (
                <>
                  <span className="identity-card__status identity-card__status--verified">
                    Verified
                  </span>
                  <span className="identity-card__domain">via {nip05.domain}</span>
                </>
              ) : (
                <span className="identity-card__status identity-card__status--unverified">
                  Unverified
                </span>
              )}
            </div>
            {nip05.verifiedAt && (
              <span className="identity-card__verified-at">
                Verified on {formatDate(nip05.verifiedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable DID Document */}
      {expandable && identity.didDocument && (
        <div className="identity-card__expandable">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="identity-card__expand-button"
          >
            {isExpanded ? 'Hide' : 'Show'} DID Document
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isExpanded ? 'identity-card__chevron--up' : ''}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isExpanded && (
            <div className="identity-card__did-document">
              <pre>{JSON.stringify(identity.didDocument, null, 2)}</pre>
              <button
                type="button"
                onClick={() =>
                  handleCopy('didDocument', JSON.stringify(identity.didDocument, null, 2))
                }
                className="identity-card__copy identity-card__copy--document"
              >
                {copiedField === 'didDocument' ? 'Copied!' : 'Copy Document'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {(onUnlink || onRefresh) && (
        <div className="identity-card__actions">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="identity-card__action identity-card__action--refresh"
            >
              Refresh
            </button>
          )}
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              className="identity-card__action identity-card__action--unlink"
            >
              Unlink Identity
            </button>
          )}
        </div>
      )}

      {/* Profile Links */}
      {profile && (profile.website || profile.lud16) && (
        <div className="identity-card__links">
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="identity-card__link"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              Website
            </a>
          )}
          {profile.lud16 && (
            <span className="identity-card__lightning" title={profile.lud16}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
              Lightning
            </span>
          )}
        </div>
      )}

      <style>{`
        .identity-card {
          max-width: 400px;
          padding: 1.5rem;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .identity-card__header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .identity-card__avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .identity-card__avatar--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #7c3aed, #a78bfa);
          color: white;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .identity-card__info {
          flex: 1;
          min-width: 0;
        }

        .identity-card__name {
          margin: 0 0 0.25rem;
          font-size: 1.125rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .identity-card__nip05 {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.875rem;
          color: #059669;
        }

        .identity-card__verified-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: #d1fae5;
          border-radius: 50%;
        }

        .identity-card__about {
          margin: 0.5rem 0 0;
          font-size: 0.875rem;
          color: #666;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .identity-card__details {
          border-top: 1px solid #e5e7eb;
          padding-top: 1rem;
        }

        .identity-card__field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .identity-card__field label {
          color: #666;
          font-weight: 500;
        }

        .identity-card__value {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .identity-card__value code {
          font-family: monospace;
          font-size: 0.8125rem;
          padding: 0.125rem 0.375rem;
          background: #f3f4f6;
          border-radius: 4px;
        }

        .identity-card__copy {
          padding: 0.125rem 0.375rem;
          font-size: 0.75rem;
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          color: #666;
        }

        .identity-card__copy:hover {
          background: #f3f4f6;
        }

        .identity-card__verification {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px dashed #e5e7eb;
        }

        .identity-card__verification-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .identity-card__status {
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .identity-card__status--verified {
          background: #d1fae5;
          color: #059669;
        }

        .identity-card__status--unverified {
          background: #fef3c7;
          color: #d97706;
        }

        .identity-card__domain {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .identity-card__verified-at {
          display: block;
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .identity-card__expandable {
          margin-top: 1rem;
          border-top: 1px solid #e5e7eb;
          padding-top: 1rem;
        }

        .identity-card__expand-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          color: #7c3aed;
          cursor: pointer;
          font-size: 0.875rem;
          padding: 0;
        }

        .identity-card__expand-button svg {
          transition: transform 0.2s;
        }

        .identity-card__chevron--up {
          transform: rotate(180deg);
        }

        .identity-card__did-document {
          margin-top: 0.75rem;
          position: relative;
        }

        .identity-card__did-document pre {
          margin: 0;
          padding: 1rem;
          background: #1f2937;
          color: #e5e7eb;
          border-radius: 6px;
          font-size: 0.75rem;
          overflow-x: auto;
          max-height: 300px;
        }

        .identity-card__copy--document {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #e5e7eb;
        }

        .identity-card__actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .identity-card__action {
          flex: 1;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .identity-card__action--refresh {
          background: #f3f4f6;
          color: #374151;
        }

        .identity-card__action--refresh:hover {
          background: #e5e7eb;
        }

        .identity-card__action--unlink {
          background: #fef2f2;
          color: #dc2626;
        }

        .identity-card__action--unlink:hover {
          background: #fee2e2;
        }

        .identity-card__links {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .identity-card__link,
        .identity-card__lightning {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.8125rem;
          color: #666;
        }

        .identity-card__link {
          color: #7c3aed;
          text-decoration: none;
        }

        .identity-card__link:hover {
          text-decoration: underline;
        }

        .identity-card__lightning svg {
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}

export default IdentityCard;
