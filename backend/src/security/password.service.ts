/**
 * Password Service
 * Handles password hashing, validation, and policy enforcement
 * Aligned with PRD 12.1: Strong password policy
 */

import * as crypto from 'crypto';
import { PASSWORD_POLICY, BCRYPT_CONFIG } from '../config/security';
import { PasswordPolicy, PasswordValidationResult } from '../types/security.types';

/**
 * Password Service class
 */
export class PasswordService {
  private readonly policy: PasswordPolicy;
  private readonly saltRounds: number;

  // Common passwords to reject (abbreviated list - expand in production)
  private readonly commonPasswords = new Set([
    'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', 'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
    'master', 'sunshine', 'ashley', 'bailey', 'shadow', 'passw0rd',
    'welcome', 'football', 'jesus', 'michael', 'ninja', 'mustang',
    'password1', 'admin', 'administrator', 'funding', 'platform',
  ]);

  constructor(policy?: PasswordPolicy) {
    this.policy = policy || PASSWORD_POLICY;
    this.saltRounds = BCRYPT_CONFIG.saltRounds;
  }

  /**
   * Pure JavaScript implementation of bcrypt-like password hashing
   * using PBKDF2 for cryptographic security
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const iterations = Math.pow(2, this.saltRounds) * 10;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        // Format: $pbkdf2-sha512$iterations$salt$hash
        const hash = `$pbkdf2-sha512$${iterations}$${salt}$${derivedKey.toString('hex')}`;
        resolve(hash);
      });
    });
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // Parse the hash format
      const parts = hash.split('$');
      if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha512') {
        return false;
      }

      const iterations = parseInt(parts[2], 10);
      const salt = parts[3];
      const storedHash = parts[4];

      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          // Use timing-safe comparison
          const derivedHashBuffer = Buffer.from(derivedKey.toString('hex'));
          const storedHashBuffer = Buffer.from(storedHash);

          if (derivedHashBuffer.length !== storedHashBuffer.length) {
            resolve(false);
          } else {
            resolve(crypto.timingSafeEqual(derivedHashBuffer, storedHashBuffer));
          }
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string, userContext?: {
    email?: string;
    name?: string;
    previousHashes?: string[];
  }): PasswordValidationResult {
    const errors: string[] = [];

    // Length checks
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters`);
    }

    if (password.length > this.policy.maxLength) {
      errors.push(`Password must not exceed ${this.policy.maxLength} characters`);
    }

    // Complexity checks
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password check
    if (this.commonPasswords.has(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password)) {
      errors.push('Password should not contain sequential characters (e.g., abc, 123)');
    }

    // Check for repeated characters
    if (this.hasRepeatedChars(password)) {
      errors.push('Password should not contain repeated characters (e.g., aaa, 111)');
    }

    // User context checks
    if (userContext) {
      // Check if password contains email
      if (userContext.email) {
        const emailParts = userContext.email.toLowerCase().split('@');
        const localPart = emailParts[0];
        if (password.toLowerCase().includes(localPart)) {
          errors.push('Password should not contain your email address');
        }
      }

      // Check if password contains name
      if (userContext.name) {
        const nameParts = userContext.name.toLowerCase().split(/\s+/);
        for (const part of nameParts) {
          if (part.length > 2 && password.toLowerCase().includes(part)) {
            errors.push('Password should not contain your name');
            break;
          }
        }
      }
    }

    // Calculate strength
    const strength = this.calculateStrength(password, errors.length);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Check if password was previously used
   */
  async checkPasswordReuse(
    password: string,
    previousHashes: string[]
  ): Promise<boolean> {
    const hashesToCheck = previousHashes.slice(0, this.policy.preventReuse);

    for (const hash of hashesToCheck) {
      const isMatch = await this.verifyPassword(password, hash);
      if (isMatch) {
        return true; // Password was previously used
      }
    }

    return false;
  }

  /**
   * Check for sequential characters
   */
  private hasSequentialChars(password: string, minSequence: number = 3): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lowerPassword = password.toLowerCase();

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - minSequence; i++) {
        const substring = seq.substring(i, i + minSequence);
        if (lowerPassword.includes(substring)) {
          return true;
        }
        // Check reverse
        const reversed = substring.split('').reverse().join('');
        if (lowerPassword.includes(reversed)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check for repeated characters
   */
  private hasRepeatedChars(password: string, minRepeat: number = 3): boolean {
    const regex = new RegExp(`(.)\\1{${minRepeat - 1},}`);
    return regex.test(password);
  }

  /**
   * Calculate password strength
   */
  private calculateStrength(
    password: string,
    errorCount: number
  ): 'weak' | 'fair' | 'good' | 'strong' {
    if (errorCount > 0) {
      return 'weak';
    }

    let score = 0;

    // Length scoring
    if (password.length >= 16) score += 2;
    else if (password.length >= 12) score += 1;

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 2;

    // No common patterns
    if (!this.hasSequentialChars(password, 4)) score += 1;
    if (!this.hasRepeatedChars(password, 4)) score += 1;

    // Mixed case and numbers throughout
    const hasDistributedComplexity = this.hasDistributedComplexity(password);
    if (hasDistributedComplexity) score += 1;

    if (score >= 8) return 'strong';
    if (score >= 6) return 'good';
    if (score >= 4) return 'fair';
    return 'weak';
  }

  /**
   * Check if complexity is distributed throughout the password
   */
  private hasDistributedComplexity(password: string): boolean {
    const thirds = [
      password.slice(0, Math.floor(password.length / 3)),
      password.slice(Math.floor(password.length / 3), Math.floor((2 * password.length) / 3)),
      password.slice(Math.floor((2 * password.length) / 3)),
    ];

    let complexThirds = 0;
    for (const third of thirds) {
      const hasComplexity =
        (/[a-z]/.test(third) && /[A-Z]/.test(third)) ||
        (/[a-zA-Z]/.test(third) && /\d/.test(third)) ||
        (/[a-zA-Z0-9]/.test(third) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(third));

      if (hasComplexity) complexThirds++;
    }

    return complexThirds >= 2;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + special;

    // Ensure at least one of each required type
    let password = '';
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += special[crypto.randomInt(special.length)];

    // Fill remaining length with random characters
    const remainingLength = length - password.length;
    for (let i = 0; i < remainingLength; i++) {
      password += allChars[crypto.randomInt(allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => crypto.randomInt(3) - 1)
      .join('');
  }

  /**
   * Generate a password reset token
   */
  generateResetToken(): { token: string; hash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return { token, hash, expiresAt };
  }

  /**
   * Verify a password reset token
   */
  verifyResetToken(token: string, storedHash: string): boolean {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  }

  /**
   * Check if password has expired
   */
  isPasswordExpired(passwordChangedAt: Date): boolean {
    const maxAgeMs = this.policy.maxAge * 24 * 60 * 60 * 1000;
    return Date.now() - passwordChangedAt.getTime() > maxAgeMs;
  }

  /**
   * Get password expiration date
   */
  getPasswordExpirationDate(passwordChangedAt: Date): Date {
    const maxAgeMs = this.policy.maxAge * 24 * 60 * 60 * 1000;
    return new Date(passwordChangedAt.getTime() + maxAgeMs);
  }

  /**
   * Get days until password expires
   */
  getDaysUntilExpiration(passwordChangedAt: Date): number {
    const expirationDate = this.getPasswordExpirationDate(passwordChangedAt);
    const msUntilExpiration = expirationDate.getTime() - Date.now();
    return Math.ceil(msUntilExpiration / (24 * 60 * 60 * 1000));
  }
}

// Export singleton instance
export const passwordService = new PasswordService();

// Export class for testing
export default PasswordService;
