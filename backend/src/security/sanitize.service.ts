/**
 * Sanitization Service
 * Input sanitization and XSS prevention
 * Aligned with secure input handling requirements
 */

import { SANITIZE_CONFIG } from '../config/security';

/**
 * Sanitization result
 */
export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  modifications: string[];
}

/**
 * Sanitization Service class
 */
export class SanitizeService {
  private readonly htmlConfig: typeof SANITIZE_CONFIG.html;
  private readonly maxLengths: typeof SANITIZE_CONFIG.maxLengths;

  // Regex patterns for detection
  private readonly scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  private readonly eventHandlerPattern = /\bon\w+\s*=/gi;
  private readonly javascriptUrlPattern = /javascript:/gi;
  private readonly dataUrlPattern = /data:[^;]+;base64/gi;
  private readonly htmlEntityPattern = /&(?:#\d+|#x[\da-fA-F]+|\w+);/g;

  constructor() {
    this.htmlConfig = SANITIZE_CONFIG.html;
    this.maxLengths = SANITIZE_CONFIG.maxLengths;
  }

  /**
   * Sanitize a string for safe display
   */
  sanitizeString(input: string, maxLength?: number): SanitizationResult {
    if (typeof input !== 'string') {
      return {
        sanitized: '',
        wasModified: true,
        modifications: ['Converted non-string to empty string'],
      };
    }

    const modifications: string[] = [];
    let sanitized = input;

    // Trim whitespace
    const trimmed = sanitized.trim();
    if (trimmed !== sanitized) {
      modifications.push('Trimmed whitespace');
      sanitized = trimmed;
    }

    // Remove null bytes
    const withoutNulls = sanitized.replace(/\0/g, '');
    if (withoutNulls !== sanitized) {
      modifications.push('Removed null bytes');
      sanitized = withoutNulls;
    }

    // Normalize unicode
    const normalized = sanitized.normalize('NFC');
    if (normalized !== sanitized) {
      modifications.push('Normalized unicode');
      sanitized = normalized;
    }

    // Apply length limit
    const limit = maxLength || this.maxLengths.shortText;
    if (sanitized.length > limit) {
      sanitized = sanitized.substring(0, limit);
      modifications.push(`Truncated to ${limit} characters`);
    }

    return {
      sanitized,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  escapeHtml(input: string): string {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };

    return input.replace(/[&<>"'`=/]/g, (char) => entityMap[char] || char);
  }

  /**
   * Unescape HTML entities
   */
  unescapeHtml(input: string): string {
    const entityMap: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '=',
    };

    return input.replace(/&(?:amp|lt|gt|quot|#x27|#x2F|#x60|#x3D);/g, (entity) => entityMap[entity] || entity);
  }

  /**
   * Sanitize HTML content (allow only safe tags)
   */
  sanitizeHtml(input: string): SanitizationResult {
    const modifications: string[] = [];
    let sanitized = input;

    // Remove script tags and their content
    const withoutScripts = sanitized.replace(this.scriptPattern, '');
    if (withoutScripts !== sanitized) {
      modifications.push('Removed script tags');
      sanitized = withoutScripts;
    }

    // Remove event handlers
    const withoutEventHandlers = sanitized.replace(this.eventHandlerPattern, '');
    if (withoutEventHandlers !== sanitized) {
      modifications.push('Removed event handlers');
      sanitized = withoutEventHandlers;
    }

    // Remove javascript: URLs
    const withoutJsUrls = sanitized.replace(this.javascriptUrlPattern, '');
    if (withoutJsUrls !== sanitized) {
      modifications.push('Removed javascript: URLs');
      sanitized = withoutJsUrls;
    }

    // Remove data: URLs (potential XSS vector)
    const withoutDataUrls = sanitized.replace(this.dataUrlPattern, '');
    if (withoutDataUrls !== sanitized) {
      modifications.push('Removed data: URLs');
      sanitized = withoutDataUrls;
    }

    // Strip all tags except allowed ones
    const allowedTagsRegex = new RegExp(
      `<(?!\/?(?:${this.htmlConfig.allowedTags.join('|')})\\b)[^>]*>`,
      'gi'
    );
    const withAllowedTags = sanitized.replace(allowedTagsRegex, '');
    if (withAllowedTags !== sanitized) {
      modifications.push('Removed disallowed HTML tags');
      sanitized = withAllowedTags;
    }

    // Clean attributes on allowed tags
    const cleanedAttributes = this.cleanAttributes(sanitized);
    if (cleanedAttributes !== sanitized) {
      modifications.push('Cleaned HTML attributes');
      sanitized = cleanedAttributes;
    }

    return {
      sanitized,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Clean HTML attributes, keeping only allowed ones
   */
  private cleanAttributes(html: string): string {
    const allowedAttributes = this.htmlConfig.allowedAttributes;

    // Match tags with attributes
    return html.replace(/<(\w+)([^>]*)>/gi, (match, tagName, attributes) => {
      const tag = tagName.toLowerCase();
      const allowed = allowedAttributes[tag as keyof typeof allowedAttributes];

      if (!allowed || allowed.length === 0) {
        // No attributes allowed for this tag
        return `<${tagName}>`;
      }

      // Filter attributes
      const cleanedAttrs: string[] = [];
      const attrRegex = /(\w+)=["']([^"']*)["']/gi;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(attributes)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const attrValue = attrMatch[2];

        if ((allowed as readonly string[]).includes(attrName)) {
          // Validate href for a tags
          if (attrName === 'href') {
            const isValidScheme = this.htmlConfig.allowedSchemes.some(
              (scheme) => attrValue.toLowerCase().startsWith(`${scheme}:`)
            );
            if (isValidScheme || attrValue.startsWith('/') || attrValue.startsWith('#')) {
              cleanedAttrs.push(`${attrName}="${this.escapeHtml(attrValue)}"`);
            }
          } else {
            cleanedAttrs.push(`${attrName}="${this.escapeHtml(attrValue)}"`);
          }
        }
      }

      return `<${tagName}${cleanedAttrs.length ? ' ' + cleanedAttrs.join(' ') : ''}>`;
    });
  }

  /**
   * Sanitize email address
   */
  sanitizeEmail(input: string): SanitizationResult {
    const modifications: string[] = [];
    let sanitized = input.toLowerCase().trim();

    // Remove any characters not valid in emails
    const cleaned = sanitized.replace(/[^a-z0-9._%+\-@]/g, '');
    if (cleaned !== sanitized) {
      modifications.push('Removed invalid characters from email');
      sanitized = cleaned;
    }

    // Limit length
    if (sanitized.length > this.maxLengths.email) {
      sanitized = sanitized.substring(0, this.maxLengths.email);
      modifications.push(`Truncated to ${this.maxLengths.email} characters`);
    }

    return {
      sanitized,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Validate and sanitize URL
   */
  sanitizeUrl(input: string): SanitizationResult {
    const modifications: string[] = [];
    let sanitized = input.trim();

    // Check for javascript: and data: protocols
    const lowerUrl = sanitized.toLowerCase();
    if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:')) {
      return {
        sanitized: '',
        wasModified: true,
        modifications: ['Removed dangerous URL protocol'],
      };
    }

    // Ensure http/https protocol for external URLs
    if (sanitized && !sanitized.startsWith('/') && !sanitized.startsWith('#')) {
      if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
        sanitized = 'https://' + sanitized;
        modifications.push('Added https:// protocol');
      }
    }

    return {
      sanitized,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(input: string): SanitizationResult {
    const modifications: string[] = [];
    let sanitized = input.trim();

    // Remove path separators
    const withoutPaths = sanitized.replace(/[/\\]/g, '_');
    if (withoutPaths !== sanitized) {
      modifications.push('Removed path separators');
      sanitized = withoutPaths;
    }

    // Remove null bytes
    const withoutNulls = sanitized.replace(/\0/g, '');
    if (withoutNulls !== sanitized) {
      modifications.push('Removed null bytes');
      sanitized = withoutNulls;
    }

    // Remove control characters
    const withoutControl = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
    if (withoutControl !== sanitized) {
      modifications.push('Removed control characters');
      sanitized = withoutControl;
    }

    // Replace spaces with underscores
    const withUnderscores = sanitized.replace(/\s+/g, '_');
    if (withUnderscores !== sanitized) {
      modifications.push('Replaced spaces with underscores');
      sanitized = withUnderscores;
    }

    // Remove double dots (path traversal prevention)
    const withoutDoubleDots = sanitized.replace(/\.{2,}/g, '.');
    if (withoutDoubleDots !== sanitized) {
      modifications.push('Removed consecutive dots');
      sanitized = withoutDoubleDots;
    }

    // Keep only alphanumeric, dots, underscores, hyphens
    const safeChars = sanitized.replace(/[^a-zA-Z0-9._\-]/g, '_');
    if (safeChars !== sanitized) {
      modifications.push('Replaced unsafe characters');
      sanitized = safeChars;
    }

    // Limit length (keep extension)
    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const extMatch = sanitized.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const baseName = sanitized.substring(0, maxLength - ext.length);
      sanitized = baseName + ext;
      modifications.push(`Truncated to ${maxLength} characters`);
    }

    return {
      sanitized,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Sanitize an object recursively
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T, maxDepth: number = 10): T {
    if (maxDepth <= 0) return obj;

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key
      const sanitizedKey = this.sanitizeString(key, 100).sanitized;

      if (typeof value === 'string') {
        result[sanitizedKey] = this.sanitizeString(value).sanitized;
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          result[sanitizedKey] = value.map((item) => {
            if (typeof item === 'string') {
              return this.sanitizeString(item).sanitized;
            } else if (typeof item === 'object' && item !== null) {
              return this.sanitizeObject(item as Record<string, unknown>, maxDepth - 1);
            }
            return item;
          });
        } else {
          result[sanitizedKey] = this.sanitizeObject(value as Record<string, unknown>, maxDepth - 1);
        }
      } else {
        result[sanitizedKey] = value;
      }
    }

    return result as T;
  }

  /**
   * Check if input contains potential XSS
   */
  containsXSS(input: string): boolean {
    return (
      this.scriptPattern.test(input) ||
      this.eventHandlerPattern.test(input) ||
      this.javascriptUrlPattern.test(input) ||
      /<[^>]*>/g.test(input)
    );
  }

  /**
   * Check if input contains SQL injection patterns
   */
  containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
      /(['"]?\s*OR\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
      /(['"]?\s*AND\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
      /(;\s*--)/,
      /(\b(EXEC|EXECUTE|xp_|sp_)\b)/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize for SQL (basic - use parameterized queries instead)
   */
  escapeSqlString(input: string): string {
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * Sanitize JSON string
   */
  sanitizeJson(input: string): SanitizationResult {
    const modifications: string[] = [];

    try {
      const parsed = JSON.parse(input);
      const sanitized = this.sanitizeObject(parsed);
      const result = JSON.stringify(sanitized);

      if (result !== input) {
        modifications.push('Sanitized JSON content');
      }

      return {
        sanitized: result,
        wasModified: modifications.length > 0,
        modifications,
      };
    } catch {
      return {
        sanitized: '',
        wasModified: true,
        modifications: ['Invalid JSON - returned empty string'],
      };
    }
  }

  /**
   * Strip all HTML tags
   */
  stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Convert HTML to plain text (preserving some structure)
   */
  htmlToText(input: string): string {
    let text = input;

    // Replace block elements with newlines
    text = text.replace(/<(p|div|br|h[1-6]|li)[^>]*>/gi, '\n');

    // Strip remaining tags
    text = this.stripHtml(text);

    // Decode entities
    text = this.unescapeHtml(text);

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    return text;
  }
}

// Export singleton instance
export const sanitizeService = new SanitizeService();

// Export class for testing
export default SanitizeService;
