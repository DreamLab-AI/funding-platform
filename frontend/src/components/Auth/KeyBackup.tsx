// =============================================================================
// KeyBackup Component - Secure Key Backup and Restore
// =============================================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  generateKeypair,
  importKeypair,
  isValidNsec,
  isValidPrivkey,
  pubkeyToNpub,
} from '../../lib/nostr/keys';
import { NostrKeypair } from '../../lib/nostr/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface KeyBackupProps {
  onKeyGenerated?: (keypair: NostrKeypair) => void;
  onKeyImported?: (keypair: NostrKeypair) => void;
  className?: string;
}

type Mode = 'generate' | 'import' | 'backup';
type BackupFormat = 'nsec' | 'hex';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function KeyBackup({
  onKeyGenerated,
  onKeyImported,
  className = '',
}: KeyBackupProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('generate');
  const [keypair, setKeypair] = useState<NostrKeypair | null>(null);
  const [importInput, setImportInput] = useState('');
  const [backupFormat, setBackupFormat] = useState<BackupFormat>('nsec');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Generate new keypair
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const newKeypair = await generateKeypair();
      setKeypair(newKeypair);
      setMode('backup');
      setBackupConfirmed(false);
      onKeyGenerated?.(newKeypair);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keypair');
    } finally {
      setIsGenerating(false);
    }
  }, [onKeyGenerated]);

  // Import existing keypair
  const handleImport = useCallback(async () => {
    if (!importInput.trim()) {
      setError('Please enter a private key');
      return;
    }

    const input = importInput.trim();

    // Validate input format
    if (!isValidNsec(input) && !isValidPrivkey(input)) {
      setError('Invalid private key format. Use nsec or 64-character hex.');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const importedKeypair = await importKeypair(input);
      setKeypair(importedKeypair);
      setImportInput('');
      setMode('backup');
      onKeyImported?.(importedKeypair);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import keypair');
    } finally {
      setIsImporting(false);
    }
  }, [importInput, onKeyImported]);

  // Copy to clipboard
  const handleCopy = useCallback(async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Download backup file
  const handleDownload = useCallback(() => {
    if (!keypair) return;

    const backupData = {
      npub: keypair.npub,
      nsec: keypair.nsec,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE! Anyone with the private key can control your identity.',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    if (downloadRef.current) {
      downloadRef.current.href = url;
      downloadRef.current.download = `nostr-key-backup-${Date.now()}.json`;
      downloadRef.current.click();
      URL.revokeObjectURL(url);
    }
  }, [keypair]);

  // Clear state
  const handleClear = useCallback(() => {
    setKeypair(null);
    setImportInput('');
    setError(null);
    setShowPrivateKey(false);
    setBackupConfirmed(false);
    setMode('generate');
  }, []);

  return (
    <div className={`key-backup ${className}`}>
      {/* Mode Tabs */}
      <div className="key-backup__tabs">
        <button
          type="button"
          onClick={() => setMode('generate')}
          className={`key-backup__tab ${mode === 'generate' ? 'key-backup__tab--active' : ''}`}
        >
          Generate New
        </button>
        <button
          type="button"
          onClick={() => setMode('import')}
          className={`key-backup__tab ${mode === 'import' ? 'key-backup__tab--active' : ''}`}
        >
          Import Existing
        </button>
        {keypair && (
          <button
            type="button"
            onClick={() => setMode('backup')}
            className={`key-backup__tab ${mode === 'backup' ? 'key-backup__tab--active' : ''}`}
          >
            Backup
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="key-backup__error">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Generate Mode */}
      {mode === 'generate' && !keypair && (
        <div className="key-backup__generate">
          <div className="key-backup__info">
            <h3>Generate New Nostr Identity</h3>
            <p>
              Create a new cryptographic keypair. This will generate a unique identity
              that only you control.
            </p>
            <ul>
              <li>Your private key (nsec) must be kept secret</li>
              <li>Your public key (npub) can be shared freely</li>
              <li>Losing your private key means losing your identity</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="key-backup__button key-backup__button--primary"
          >
            {isGenerating ? 'Generating...' : 'Generate Keypair'}
          </button>
        </div>
      )}

      {/* Import Mode */}
      {mode === 'import' && !keypair && (
        <div className="key-backup__import">
          <div className="key-backup__info">
            <h3>Import Existing Key</h3>
            <p>
              Enter your private key to restore your Nostr identity.
              Accepts nsec (bech32) or hex format.
            </p>
          </div>
          <div className="key-backup__input-group">
            <label htmlFor="import-key">Private Key:</label>
            <input
              id="import-key"
              type={showPrivateKey ? 'text' : 'password'}
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="nsec1... or 64-character hex"
              disabled={isImporting}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="key-backup__toggle-visibility"
            >
              {showPrivateKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || !importInput.trim()}
            className="key-backup__button key-backup__button--primary"
          >
            {isImporting ? 'Importing...' : 'Import Key'}
          </button>
        </div>
      )}

      {/* Backup Mode */}
      {mode === 'backup' && keypair && (
        <div className="key-backup__backup">
          <div className="key-backup__warning">
            <strong>Important:</strong> Back up your private key now!
            You will not be able to recover it later.
          </div>

          {/* Public Key */}
          <div className="key-backup__key-section">
            <h4>Public Key (safe to share)</h4>
            <div className="key-backup__key-display">
              <code>{keypair.npub}</code>
              <button
                type="button"
                onClick={() => handleCopy('npub', keypair.npub!)}
                className="key-backup__copy"
              >
                {copied === 'npub' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Private Key */}
          <div className="key-backup__key-section">
            <h4>Private Key (keep secret!)</h4>
            <div className="key-backup__format-toggle">
              <button
                type="button"
                onClick={() => setBackupFormat('nsec')}
                className={backupFormat === 'nsec' ? 'active' : ''}
              >
                nsec
              </button>
              <button
                type="button"
                onClick={() => setBackupFormat('hex')}
                className={backupFormat === 'hex' ? 'active' : ''}
              >
                hex
              </button>
            </div>
            <div className="key-backup__key-display key-backup__key-display--private">
              {showPrivateKey ? (
                <code>
                  {backupFormat === 'nsec' ? keypair.nsec : keypair.privateKey}
                </code>
              ) : (
                <code className="key-backup__masked">
                  {'*'.repeat(60)}...
                </code>
              )}
              <div className="key-backup__key-actions">
                <button
                  type="button"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="key-backup__copy"
                >
                  {showPrivateKey ? 'Hide' : 'Reveal'}
                </button>
                {showPrivateKey && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        'privkey',
                        backupFormat === 'nsec' ? keypair.nsec! : keypair.privateKey
                      )
                    }
                    className="key-backup__copy"
                  >
                    {copied === 'privkey' ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Download */}
          <div className="key-backup__download-section">
            <button
              type="button"
              onClick={handleDownload}
              className="key-backup__button key-backup__button--secondary"
            >
              Download Backup File
            </button>
            <a ref={downloadRef} style={{ display: 'none' }} />
          </div>

          {/* Confirmation */}
          <div className="key-backup__confirm">
            <label>
              <input
                type="checkbox"
                checked={backupConfirmed}
                onChange={(e) => setBackupConfirmed(e.target.checked)}
              />
              <span>
                I have securely backed up my private key and understand I cannot
                recover it if lost.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="key-backup__actions">
            <button
              type="button"
              onClick={handleClear}
              className="key-backup__button key-backup__button--secondary"
            >
              Clear & Start Over
            </button>
          </div>
        </div>
      )}

      <style>{`
        .key-backup {
          max-width: 500px;
          padding: 1.5rem;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .key-backup__tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
        }

        .key-backup__tab {
          flex: 1;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 0.875rem;
          font-weight: 500;
          color: #666;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }

        .key-backup__tab:hover {
          color: #374151;
        }

        .key-backup__tab--active {
          color: #7c3aed;
          border-bottom-color: #7c3aed;
        }

        .key-backup__error {
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

        .key-backup__error button {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: #dc2626;
        }

        .key-backup__info {
          margin-bottom: 1.5rem;
        }

        .key-backup__info h3 {
          margin: 0 0 0.5rem;
          font-size: 1.125rem;
        }

        .key-backup__info p {
          margin: 0 0 0.75rem;
          color: #666;
          font-size: 0.875rem;
        }

        .key-backup__info ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: #666;
        }

        .key-backup__info li {
          margin-bottom: 0.25rem;
        }

        .key-backup__input-group {
          margin-bottom: 1rem;
        }

        .key-backup__input-group label {
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .key-backup__input-group input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.875rem;
        }

        .key-backup__input-group input:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .key-backup__toggle-visibility {
          margin-top: 0.25rem;
          padding: 0;
          background: none;
          border: none;
          color: #7c3aed;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .key-backup__button {
          display: block;
          width: 100%;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s, opacity 0.2s;
        }

        .key-backup__button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .key-backup__button--primary {
          background: #7c3aed;
          color: white;
        }

        .key-backup__button--primary:hover:not(:disabled) {
          background: #6d28d9;
        }

        .key-backup__button--secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .key-backup__button--secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .key-backup__warning {
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          background: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 6px;
          color: #92400e;
          font-size: 0.875rem;
        }

        .key-backup__key-section {
          margin-bottom: 1rem;
        }

        .key-backup__key-section h4 {
          margin: 0 0 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .key-backup__key-display {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #f3f4f6;
          border-radius: 6px;
        }

        .key-backup__key-display code {
          flex: 1;
          font-family: monospace;
          font-size: 0.75rem;
          word-break: break-all;
        }

        .key-backup__key-display--private {
          background: #fef2f2;
          flex-direction: column;
          align-items: stretch;
        }

        .key-backup__key-display--private code {
          margin-bottom: 0.5rem;
        }

        .key-backup__masked {
          color: #9ca3af;
        }

        .key-backup__key-actions {
          display: flex;
          gap: 0.5rem;
        }

        .key-backup__copy {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
        }

        .key-backup__copy:hover {
          background: #f9fafb;
        }

        .key-backup__format-toggle {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .key-backup__format-toggle button {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          background: #f3f4f6;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .key-backup__format-toggle button.active {
          background: #7c3aed;
          color: white;
        }

        .key-backup__download-section {
          margin-bottom: 1rem;
        }

        .key-backup__confirm {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
        }

        .key-backup__confirm label {
          display: flex;
          gap: 0.75rem;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .key-backup__confirm input {
          flex-shrink: 0;
          margin-top: 0.125rem;
        }

        .key-backup__actions {
          display: flex;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default KeyBackup;
