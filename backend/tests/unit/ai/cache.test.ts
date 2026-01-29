/**
 * AI Cache Unit Tests
 * Tests for LRU cache with TTL functionality
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { AICache, getAICache, resetAICache } from '../../../src/ai/cache';

describe('AICache', () => {
  let cache: AICache<string>;

  beforeEach(() => {
    cache = new AICache<string>({ maxEntries: 100, ttlSeconds: 3600 });
  });

  afterEach(() => {
    resetAICache();
  });

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const defaultCache = new AICache();
      const stats = defaultCache.getStats();

      expect(stats.maxSize).toBe(1000);
      expect(stats.size).toBe(0);
    });

    it('should create cache with custom options', () => {
      const customCache = new AICache({ maxEntries: 500, ttlSeconds: 7200 });
      const stats = customCache.getStats();

      expect(stats.maxSize).toBe(500);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same params', () => {
      const params = { type: 'completion', model: 'gpt-4', prompt: 'test' };

      const key1 = AICache.generateKey(params);
      const key2 = AICache.generateKey(params);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = AICache.generateKey({ model: 'gpt-4', prompt: 'test1' });
      const key2 = AICache.generateKey({ model: 'gpt-4', prompt: 'test2' });

      expect(key1).not.toBe(key2);
    });

    it('should generate same key regardless of param order', () => {
      const key1 = AICache.generateKey({ a: 1, b: 2, c: 3 });
      const key2 = AICache.generateKey({ c: 3, a: 1, b: 2 });

      expect(key1).toBe(key2);
    });

    it('should generate 32 character hash', () => {
      const key = AICache.generateKey({ test: 'value' });

      expect(key).toHaveLength(32);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update stats on get', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('missing'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should update size on set', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return undefined for expired entries', () => {
      const shortTtlCache = new AICache<string>({ ttlSeconds: 1 });
      shortTtlCache.set('key1', 'value1');

      expect(shortTtlCache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(2000); // Advance past TTL

      expect(shortTtlCache.get('key1')).toBeUndefined();
    });

    it('should count expired entries as misses', () => {
      const shortTtlCache = new AICache<string>({ ttlSeconds: 1 });
      shortTtlCache.set('key1', 'value1');

      jest.advanceTimersByTime(2000);
      shortTtlCache.get('key1');

      const stats = shortTtlCache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should use custom TTL when provided', () => {
      cache.set('key1', 'value1', 1); // 1 second TTL

      expect(cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(2000);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should keep entries within TTL', () => {
      cache.set('key1', 'value1', 10); // 10 second TTL

      jest.advanceTimersByTime(5000); // 5 seconds

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when full', () => {
      const smallCache = new AICache<string>({ maxEntries: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      smallCache.set('key4', 'value4'); // Should evict key1

      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key4')).toBe('value4');
    });

    it('should move accessed entries to end (most recent)', () => {
      const smallCache = new AICache<string>({ maxEntries: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access key1, making it most recently used
      smallCache.get('key1');

      // Add new entry, should evict key2 (oldest accessed)
      smallCache.set('key4', 'value4');

      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBeUndefined();
    });
  });

  describe('has', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      const shortTtlCache = new AICache<string>({ ttlSeconds: 1 });
      shortTtlCache.set('key1', 'value1');

      jest.advanceTimersByTime(2000);

      expect(shortTtlCache.has('key1')).toBe(false);
    });

    it('should remove expired keys from cache', () => {
      const shortTtlCache = new AICache<string>({ ttlSeconds: 1 });
      shortTtlCache.set('key1', 'value1');

      jest.advanceTimersByTime(2000);
      shortTtlCache.has('key1');

      const stats = shortTtlCache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('should remove entry from cache', () => {
      cache.set('key1', 'value1');

      const result = cache.delete('key1');

      expect(result).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent keys', () => {
      const result = cache.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should update size after delete', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should reset size to 0', () => {
      cache.set('key1', 'value1');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('prune', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should remove expired entries', () => {
      const shortTtlCache = new AICache<string>({ ttlSeconds: 1 });
      shortTtlCache.set('key1', 'value1');
      shortTtlCache.set('key2', 'value2');

      jest.advanceTimersByTime(2000);

      const pruned = shortTtlCache.prune();

      expect(pruned).toBe(2);
      expect(shortTtlCache.getStats().size).toBe(0);
    });

    it('should return 0 when nothing to prune', () => {
      cache.set('key1', 'value1');

      const pruned = cache.prune();

      expect(pruned).toBe(0);
    });

    it('should only remove expired entries', () => {
      const mixedCache = new AICache<string>({ ttlSeconds: 10 });
      mixedCache.set('long', 'value1', 100);
      mixedCache.set('short', 'value2', 1);

      jest.advanceTimersByTime(2000);

      mixedCache.prune();

      expect(mixedCache.get('long')).toBe('value1');
      expect(mixedCache.get('short')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1'); // Hit
      cache.get('missing'); // Miss

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.maxSize).toBe(100);
    });

    it('should return copy of stats', () => {
      const stats1 = cache.getStats();
      const stats2 = cache.getStats();

      expect(stats1).not.toBe(stats2);
    });
  });

  describe('getHitRate', () => {
    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('missing'); // Miss

      const hitRate = cache.getHitRate();

      expect(hitRate).toBeCloseTo(66.67, 1);
    });

    it('should return 0 when no requests', () => {
      expect(cache.getHitRate()).toBe(0);
    });

    it('should return 100 for all hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      expect(cache.getHitRate()).toBe(100);
    });

    it('should return 0 for all misses', () => {
      cache.get('missing1');
      cache.get('missing2');

      expect(cache.getHitRate()).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset hit and miss counters', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should not affect cached data', () => {
      cache.set('key1', 'value1');
      cache.resetStats();

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value');
      const compute = jest.fn().mockResolvedValue('computed-value');

      const result = await cache.getOrCompute('key1', compute);

      expect(result).toBe('cached-value');
      expect(compute).not.toHaveBeenCalled();
    });

    it('should compute and cache if not exists', async () => {
      const compute = jest.fn().mockResolvedValue('computed-value');

      const result = await cache.getOrCompute('key1', compute);

      expect(result).toBe('computed-value');
      expect(compute).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('computed-value');
    });

    it('should use custom TTL for computed values', async () => {
      jest.useFakeTimers();
      const compute = jest.fn().mockResolvedValue('computed-value');

      await cache.getOrCompute('key1', compute, 1);

      jest.advanceTimersByTime(2000);

      expect(cache.get('key1')).toBeUndefined();
      jest.useRealTimers();
    });

    it('should propagate compute errors', async () => {
      const compute = jest.fn().mockRejectedValue(new Error('Compute failed'));

      await expect(cache.getOrCompute('key1', compute)).rejects.toThrow('Compute failed');
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance with getAICache', () => {
      const cache1 = getAICache();
      const cache2 = getAICache();

      expect(cache1).toBe(cache2);
    });

    it('should use options only on first call', () => {
      const cache1 = getAICache({ maxEntries: 500 });
      const cache2 = getAICache({ maxEntries: 1000 });

      expect(cache1.getStats().maxSize).toBe(500);
      expect(cache1).toBe(cache2);
    });

    it('should create new instance after reset', () => {
      const cache1 = getAICache({ maxEntries: 500 });
      resetAICache();
      const cache2 = getAICache({ maxEntries: 1000 });

      expect(cache1).not.toBe(cache2);
      expect(cache2.getStats().maxSize).toBe(1000);
    });

    it('should clear cache on reset', () => {
      const cache1 = getAICache();
      cache1.set('key1', 'value1');

      resetAICache();
      const cache2 = getAICache();

      expect(cache2.get('key1')).toBeUndefined();
    });
  });

  describe('size estimation', () => {
    it('should estimate size of values', () => {
      const objectCache = new AICache<{ data: string }>();
      objectCache.set('key1', { data: 'test value' });

      // Size should be estimated from JSON.stringify
      const stats = objectCache.getStats();
      expect(stats.size).toBe(1);
    });

    it('should handle circular references gracefully', () => {
      const objectCache = new AICache<any>();
      const circular: any = { a: 1 };
      circular.self = circular;

      // Should not throw
      expect(() => objectCache.set('key1', circular)).not.toThrow();
    });
  });

  describe('type safety', () => {
    it('should work with complex types', () => {
      interface ComplexType {
        id: string;
        data: {
          values: number[];
          nested: {
            flag: boolean;
          };
        };
      }

      const typedCache = new AICache<ComplexType>();
      const value: ComplexType = {
        id: 'test',
        data: {
          values: [1, 2, 3],
          nested: { flag: true },
        },
      };

      typedCache.set('key1', value);

      const retrieved = typedCache.get('key1');
      expect(retrieved?.id).toBe('test');
      expect(retrieved?.data.values).toEqual([1, 2, 3]);
    });
  });

  describe('performance edge cases', () => {
    it('should handle many entries efficiently', () => {
      const largeCache = new AICache<string>({ maxEntries: 10000 });

      const startTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        largeCache.set(`key-${i}`, `value-${i}`);
      }
      const setTime = Date.now() - startTime;

      const readStartTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        largeCache.get(`key-${i}`);
      }
      const readTime = Date.now() - readStartTime;

      // Should complete in reasonable time (less than 1 second each)
      expect(setTime).toBeLessThan(1000);
      expect(readTime).toBeLessThan(1000);
    });

    it('should handle rapid evictions', () => {
      const tinyCache = new AICache<string>({ maxEntries: 5 });

      for (let i = 0; i < 100; i++) {
        tinyCache.set(`key-${i}`, `value-${i}`);
      }

      const stats = tinyCache.getStats();
      expect(stats.size).toBe(5);
    });

    it('should handle empty string values', () => {
      cache.set('empty', '');

      expect(cache.get('empty')).toBe('');
      expect(cache.has('empty')).toBe(true);
    });

    it('should handle null-like values', () => {
      const anyCache = new AICache<any>();
      anyCache.set('null', null);
      anyCache.set('zero', 0);
      anyCache.set('false', false);

      expect(anyCache.get('null')).toBeNull();
      expect(anyCache.get('zero')).toBe(0);
      expect(anyCache.get('false')).toBe(false);
    });
  });
});
