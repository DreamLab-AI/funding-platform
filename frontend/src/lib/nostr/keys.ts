// =============================================================================
// Nostr Key Management - NIP-06, NIP-07, NIP-19
// =============================================================================

import { NostrKeypair, NostrWindowExtension } from './types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// Bech32 character set
const BECH32_CHARS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// Human-readable prefixes for Nostr
const HRP = {
  NPUB: 'npub',
  NSEC: 'nsec',
  NOTE: 'note',
  NPROFILE: 'nprofile',
  NEVENT: 'nevent',
  NRELAY: 'nrelay',
  NADDR: 'naddr',
} as const;

// -----------------------------------------------------------------------------
// Bech32 Encoding/Decoding (NIP-19)
// -----------------------------------------------------------------------------

/**
 * Bech32 polymod for checksum calculation
 */
function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

/**
 * Expand human-readable part for checksum
 */
function hrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (const c of hrp) {
    ret.push(c.charCodeAt(0) >> 5);
  }
  ret.push(0);
  for (const c of hrp) {
    ret.push(c.charCodeAt(0) & 31);
  }
  return ret;
}

/**
 * Verify bech32 checksum
 */
function verifyChecksum(hrp: string, data: number[]): boolean {
  return bech32Polymod([...hrpExpand(hrp), ...data]) === 1;
}

/**
 * Create bech32 checksum
 */
function createChecksum(hrp: string, data: number[]): number[] {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  const ret: number[] = [];
  for (let i = 0; i < 6; i++) {
    ret.push((polymod >> (5 * (5 - i))) & 31);
  }
  return ret;
}

/**
 * Convert between bit groupings
 */
function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error('Invalid value for bit conversion');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    throw new Error('Invalid padding');
  }

  return ret;
}

/**
 * Encode data as bech32
 */
export function bech32Encode(hrp: string, data: Uint8Array): string {
  const words = convertBits([...data], 8, 5, true);
  const checksum = createChecksum(hrp, words);
  const combined = [...words, ...checksum];
  return hrp + '1' + combined.map((d) => BECH32_CHARS[d]).join('');
}

/**
 * Decode bech32 string
 */
export function bech32Decode(str: string): { hrp: string; data: Uint8Array } {
  const lowered = str.toLowerCase();
  const pos = lowered.lastIndexOf('1');

  if (pos < 1 || pos + 7 > lowered.length || lowered.length > 90) {
    throw new Error('Invalid bech32 string');
  }

  const hrp = lowered.slice(0, pos);
  const data: number[] = [];

  for (let i = pos + 1; i < lowered.length; i++) {
    const d = BECH32_CHARS.indexOf(lowered[i]);
    if (d === -1) {
      throw new Error('Invalid bech32 character');
    }
    data.push(d);
  }

  if (!verifyChecksum(hrp, data)) {
    throw new Error('Invalid bech32 checksum');
  }

  const decoded = convertBits(data.slice(0, -6), 5, 8, false);
  return { hrp, data: new Uint8Array(decoded) };
}

// -----------------------------------------------------------------------------
// Hex Encoding/Decoding
// -----------------------------------------------------------------------------

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// -----------------------------------------------------------------------------
// Key Encoding Functions (NIP-19)
// -----------------------------------------------------------------------------

/**
 * Encode public key as npub (NIP-19)
 */
export function pubkeyToNpub(pubkeyHex: string): string {
  if (pubkeyHex.length !== 64) {
    throw new Error('Invalid public key length');
  }
  return bech32Encode(HRP.NPUB, hexToBytes(pubkeyHex));
}

/**
 * Decode npub to hex public key
 */
export function npubToPubkey(npub: string): string {
  const { hrp, data } = bech32Decode(npub);
  if (hrp !== HRP.NPUB) {
    throw new Error('Invalid npub prefix');
  }
  return bytesToHex(data);
}

/**
 * Encode private key as nsec (NIP-19)
 */
export function privkeyToNsec(privkeyHex: string): string {
  if (privkeyHex.length !== 64) {
    throw new Error('Invalid private key length');
  }
  return bech32Encode(HRP.NSEC, hexToBytes(privkeyHex));
}

/**
 * Decode nsec to hex private key
 */
export function nsecToPrivkey(nsec: string): string {
  const { hrp, data } = bech32Decode(nsec);
  if (hrp !== HRP.NSEC) {
    throw new Error('Invalid nsec prefix');
  }
  return bytesToHex(data);
}

/**
 * Encode event ID as note ID (NIP-19)
 */
export function eventIdToNote(eventIdHex: string): string {
  if (eventIdHex.length !== 64) {
    throw new Error('Invalid event ID length');
  }
  return bech32Encode(HRP.NOTE, hexToBytes(eventIdHex));
}

/**
 * Decode note ID to hex event ID
 */
export function noteToEventId(note: string): string {
  const { hrp, data } = bech32Decode(note);
  if (hrp !== HRP.NOTE) {
    throw new Error('Invalid note prefix');
  }
  return bytesToHex(data);
}

// -----------------------------------------------------------------------------
// Key Generation (NIP-06 compatible with Web Crypto)
// -----------------------------------------------------------------------------

/**
 * Generate a random 32-byte private key using Web Crypto API
 */
export async function generatePrivateKey(): Promise<string> {
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);

  // Ensure the key is valid (less than secp256k1 order)
  const keyBigInt = BigInt('0x' + bytesToHex(privateKeyBytes));
  if (keyBigInt >= SECP256K1_ORDER || keyBigInt === 0n) {
    // Retry if invalid (extremely rare)
    return generatePrivateKey();
  }

  return bytesToHex(privateKeyBytes);
}

/**
 * Derive public key from private key using Web Crypto SubtleCrypto
 * Note: Web Crypto doesn't directly support secp256k1, so we use a pure JS implementation
 * For production, consider using @noble/secp256k1 or similar library
 */
export async function derivePublicKey(privateKeyHex: string): Promise<string> {
  // Import secp256k1 implementation dynamically to keep bundle size small
  // This is a simplified placeholder - in production use @noble/secp256k1
  const { getPublicKey } = await importSecp256k1();
  return getPublicKey(privateKeyHex);
}

/**
 * Generate a new Nostr keypair
 */
export async function generateKeypair(): Promise<NostrKeypair> {
  const privateKey = await generatePrivateKey();
  const publicKey = await derivePublicKey(privateKey);

  return {
    privateKey,
    publicKey,
    nsec: privkeyToNsec(privateKey),
    npub: pubkeyToNpub(publicKey),
  };
}

/**
 * Import keypair from private key (hex or nsec)
 */
export async function importKeypair(privateKeyInput: string): Promise<NostrKeypair> {
  let privateKey: string;

  if (privateKeyInput.startsWith('nsec1')) {
    privateKey = nsecToPrivkey(privateKeyInput);
  } else if (/^[0-9a-fA-F]{64}$/.test(privateKeyInput)) {
    privateKey = privateKeyInput.toLowerCase();
  } else {
    throw new Error('Invalid private key format');
  }

  const publicKey = await derivePublicKey(privateKey);

  return {
    privateKey,
    publicKey,
    nsec: privkeyToNsec(privateKey),
    npub: pubkeyToNpub(publicKey),
  };
}

// -----------------------------------------------------------------------------
// NIP-07 Browser Extension Integration
// -----------------------------------------------------------------------------

/**
 * Check if NIP-07 browser extension is available
 */
export function hasNostrExtension(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

/**
 * Get the NIP-07 extension object
 */
export function getNostrExtension(): NostrWindowExtension | null {
  if (hasNostrExtension()) {
    return window.nostr!;
  }
  return null;
}

/**
 * Get public key from NIP-07 extension
 */
export async function getPublicKeyFromExtension(): Promise<string> {
  const nostr = getNostrExtension();
  if (!nostr) {
    throw new Error('Nostr extension not found');
  }
  return nostr.getPublicKey();
}

/**
 * Get relays from NIP-07 extension
 */
export async function getRelaysFromExtension(): Promise<Record<string, { read: boolean; write: boolean }>> {
  const nostr = getNostrExtension();
  if (!nostr || !nostr.getRelays) {
    return {};
  }
  return nostr.getRelays();
}

// -----------------------------------------------------------------------------
// Mnemonic (NIP-06) - BIP39 Compatible
// -----------------------------------------------------------------------------

/**
 * Word list for BIP39 mnemonics (English)
 * This is a subset - full implementation should use complete word list
 */
const BIP39_WORDLIST_SAMPLE = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  // ... full list would have 2048 words
];

/**
 * Generate mnemonic seed phrase (NIP-06)
 * Note: For production, use a proper BIP39 library
 */
export async function generateMnemonic(strength: 128 | 160 | 192 | 224 | 256 = 128): Promise<string> {
  // This is a simplified implementation
  // Production should use bip39 package
  throw new Error('Mnemonic generation requires bip39 library - not implemented in this demo');
}

/**
 * Derive Nostr keypair from mnemonic (NIP-06)
 * Uses BIP32 derivation path: m/44'/1237'/<account>'/0/0
 */
export async function keypairFromMnemonic(
  mnemonic: string,
  passphrase: string = '',
  accountIndex: number = 0
): Promise<NostrKeypair> {
  // This is a simplified implementation
  // Production should use bip39 and bip32 packages
  throw new Error('Mnemonic derivation requires bip39/bip32 libraries - not implemented in this demo');
}

// -----------------------------------------------------------------------------
// Key Validation
// -----------------------------------------------------------------------------

/**
 * Validate a hex public key
 */
export function isValidPubkey(pubkey: string): boolean {
  if (typeof pubkey !== 'string') return false;
  if (pubkey.length !== 64) return false;
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Validate an npub
 */
export function isValidNpub(npub: string): boolean {
  try {
    if (!npub.startsWith('npub1')) return false;
    const { hrp } = bech32Decode(npub);
    return hrp === HRP.NPUB;
  } catch {
    return false;
  }
}

/**
 * Validate a hex private key
 */
export function isValidPrivkey(privkey: string): boolean {
  if (typeof privkey !== 'string') return false;
  if (privkey.length !== 64) return false;
  if (!/^[0-9a-f]{64}$/i.test(privkey)) return false;

  const keyBigInt = BigInt('0x' + privkey);
  return keyBigInt > 0n && keyBigInt < SECP256K1_ORDER;
}

/**
 * Validate an nsec
 */
export function isValidNsec(nsec: string): boolean {
  try {
    if (!nsec.startsWith('nsec1')) return false;
    const { hrp, data } = bech32Decode(nsec);
    if (hrp !== HRP.NSEC) return false;
    return isValidPrivkey(bytesToHex(data));
  } catch {
    return false;
  }
}

/**
 * Parse any key format to hex pubkey
 */
export function parseToHexPubkey(input: string): string {
  if (isValidPubkey(input)) {
    return input.toLowerCase();
  }
  if (isValidNpub(input)) {
    return npubToPubkey(input);
  }
  throw new Error('Invalid public key format');
}

// -----------------------------------------------------------------------------
// Secp256k1 Import Helper
// -----------------------------------------------------------------------------

/**
 * Dynamic import of secp256k1 implementation
 * This allows for code splitting and lazy loading
 */
async function importSecp256k1(): Promise<{
  getPublicKey: (privateKey: string) => string;
  sign: (message: Uint8Array, privateKey: string) => Uint8Array;
  verify: (signature: Uint8Array, message: Uint8Array, publicKey: string) => boolean;
}> {
  // In production, this would import @noble/secp256k1
  // For now, we provide a stub that requires the library to be installed
  try {
    const secp = await import('@noble/secp256k1');
    return {
      getPublicKey: (privateKey: string) => {
        const pubkeyBytes = secp.getPublicKey(privateKey, true);
        // Return x-coordinate only (32 bytes) for Nostr
        return bytesToHex(pubkeyBytes.slice(1));
      },
      sign: (message: Uint8Array, privateKey: string) => {
        return secp.signSync(message, privateKey);
      },
      verify: (signature: Uint8Array, message: Uint8Array, publicKey: string) => {
        return secp.verify(signature, message, publicKey);
      },
    };
  } catch {
    throw new Error('secp256k1 library not available. Install @noble/secp256k1');
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  HRP,
  importSecp256k1,
};
