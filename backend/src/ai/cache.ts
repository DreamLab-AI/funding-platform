// =============================================================================
// AI Response Cache - LRU Cache with TTL
// =============================================================================

import crypto from 'crypto';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

/**
 * LRU Cache with TTL for AI responses
 */
export class AICache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private ttlSeconds: number;
  private stats: CacheStats;

  constructor(options: { maxEntries?: number; ttlSeconds?: number } = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.ttlSeconds = options.ttlSeconds || 3600; // 1 hour default
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: this.maxEntries,
    };
  }

  /**
   * Generate cache key from request parameters
   */
  static generateKey(params: Record<string, unknown>): string {
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 32);
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    // Check if we need to evict
    while (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const effectiveTtl = ttlSeconds ?? this.ttlSeconds;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + effectiveTtl * 1000,
      size: this.estimateSize(value),
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if a key exists (and is not expired)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }
    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    logger.info('AI cache cleared');
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    this.stats.size = this.cache.size;

    if (pruned > 0) {
      logger.debug('AI cache pruned', { pruned, remaining: this.cache.size });
    }

    return pruned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return (this.stats.hits / total) * 100;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Estimate the size of a value (for memory tracking)
   */
  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get or compute a cached value
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await compute();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

// Singleton instance for AI responses
let cacheInstance: AICache | null = null;

export function getAICache(
  options?: { maxEntries?: number; ttlSeconds?: number }
): AICache {
  if (!cacheInstance) {
    cacheInstance = new AICache(options);
  }
  return cacheInstance;
}

export function resetAICache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}
