/**
 * Helper Functions Unit Tests
 * Tests all utility functions in utils/helpers.ts
 */

import {
  generateUUID,
  generateReferenceNumber,
  getCurrentTime,
  toUTC,
  fromUTC,
  formatDate,
  isDeadlinePassed,
  isCallOpen,
  calculateVariance,
  calculateStdDev,
  calculateAverage,
  calculateWeightedAverage,
  sanitizeFilename,
  generateUniqueFilename,
  getFileExtension,
  getMimeTypeFromExtension,
  formatFileSize,
  parseBoolean,
  deepClone,
  removeUndefined,
  chunkArray,
  sleep,
  retry,
  getClientIP,
  maskEmail,
  isEmpty,
} from '../../../src/utils/helpers';

// Mock the config module
jest.mock('../../../src/config', () => ({
  config: {
    timezone: 'Europe/London',
  },
}));

describe('Helper Functions', () => {
  // ============================================================================
  // UUID GENERATION
  // ============================================================================
  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
      expect(uuids.size).toBe(100);
    });

    it('should return lowercase UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toBe(uuid.toLowerCase());
    });
  });

  // ============================================================================
  // REFERENCE NUMBER GENERATION
  // ============================================================================
  describe('generateReferenceNumber', () => {
    it('should generate reference in correct format', () => {
      const ref = generateReferenceNumber('Research Grant', 1);
      const year = new Date().getFullYear();
      expect(ref).toMatch(new RegExp(`^${year}-RESE-000001$`));
    });

    it('should pad sequence number to 6 digits', () => {
      expect(generateReferenceNumber('Test', 1)).toContain('-000001');
      expect(generateReferenceNumber('Test', 123)).toContain('-000123');
      expect(generateReferenceNumber('Test', 999999)).toContain('-999999');
    });

    it('should truncate call name prefix to 4 characters', () => {
      const ref1 = generateReferenceNumber('A', 1);
      const ref2 = generateReferenceNumber('ABCDEFGHIJ', 1);
      expect(ref1.split('-')[1]).toBe('A');
      expect(ref2.split('-')[1]).toBe('ABCD');
    });

    it('should remove special characters from prefix', () => {
      const ref = generateReferenceNumber('Test-Call_2024!', 1);
      expect(ref.split('-')[1]).toBe('TEST');
    });

    it('should handle empty call name', () => {
      const ref = generateReferenceNumber('', 1);
      const year = new Date().getFullYear();
      expect(ref).toBe(`${year}--000001`);
    });

    it('should convert prefix to uppercase', () => {
      const ref = generateReferenceNumber('lowercase', 1);
      expect(ref.split('-')[1]).toBe('LOWE');
    });
  });

  // ============================================================================
  // DATE/TIME FUNCTIONS
  // ============================================================================
  describe('getCurrentTime', () => {
    it('should return a Date object', () => {
      const time = getCurrentTime();
      expect(time).toBeInstanceOf(Date);
    });

    it('should return approximately current time', () => {
      const before = Date.now();
      const time = getCurrentTime();
      const after = Date.now();
      expect(time.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(time.getTime()).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('toUTC', () => {
    it('should convert Date to UTC', () => {
      const date = new Date('2024-06-15T12:00:00');
      const utc = toUTC(date);
      expect(utc).toBeInstanceOf(Date);
    });

    it('should accept date string', () => {
      const utc = toUTC('2024-06-15T12:00:00');
      expect(utc).toBeInstanceOf(Date);
    });

    it('should preserve UTC time', () => {
      const utcDate = new Date('2024-06-15T12:00:00Z');
      const result = toUTC(utcDate);
      expect(result.toISOString()).toBe('2024-06-15T12:00:00.000Z');
    });
  });

  describe('fromUTC', () => {
    it('should convert UTC Date to configured timezone', () => {
      const utcDate = new Date('2024-06-15T12:00:00Z');
      const local = fromUTC(utcDate);
      expect(local).toBeInstanceOf(Date);
    });

    it('should accept date string', () => {
      const local = fromUTC('2024-06-15T12:00:00Z');
      expect(local).toBeInstanceOf(Date);
    });
  });

  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date('2024-06-15T12:30:45Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should accept custom format', () => {
      const date = new Date('2024-06-15T12:30:45Z');
      const formatted = formatDate(date, 'YYYY-MM-DD');
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should accept date string', () => {
      const formatted = formatDate('2024-06-15T12:30:45Z', 'YYYY');
      expect(formatted).toBe('2024');
    });
  });

  describe('isDeadlinePassed', () => {
    it('should return true for past deadline', () => {
      const pastDeadline = new Date(Date.now() - 86400000); // Yesterday
      expect(isDeadlinePassed(pastDeadline)).toBe(true);
    });

    it('should return false for future deadline', () => {
      const futureDeadline = new Date(Date.now() + 86400000); // Tomorrow
      expect(isDeadlinePassed(futureDeadline)).toBe(false);
    });
  });

  describe('isCallOpen', () => {
    it('should return true when current time is between open and close', () => {
      const openAt = new Date(Date.now() - 86400000); // Yesterday
      const closeAt = new Date(Date.now() + 86400000); // Tomorrow
      expect(isCallOpen(openAt, closeAt)).toBe(true);
    });

    it('should return false when current time is before open', () => {
      const openAt = new Date(Date.now() + 86400000); // Tomorrow
      const closeAt = new Date(Date.now() + 172800000); // Day after tomorrow
      expect(isCallOpen(openAt, closeAt)).toBe(false);
    });

    it('should return false when current time is after close', () => {
      const openAt = new Date(Date.now() - 172800000); // 2 days ago
      const closeAt = new Date(Date.now() - 86400000); // Yesterday
      expect(isCallOpen(openAt, closeAt)).toBe(false);
    });
  });

  // ============================================================================
  // STATISTICAL FUNCTIONS
  // ============================================================================
  describe('calculateVariance', () => {
    it('should calculate variance correctly', () => {
      const numbers = [2, 4, 4, 4, 5, 5, 7, 9];
      const variance = calculateVariance(numbers);
      expect(variance).toBeCloseTo(4, 5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateVariance([])).toBe(0);
    });

    it('should return 0 for single element', () => {
      expect(calculateVariance([5])).toBe(0);
    });

    it('should return 0 for identical values', () => {
      expect(calculateVariance([5, 5, 5, 5])).toBe(0);
    });

    it('should handle negative numbers', () => {
      const variance = calculateVariance([-2, -1, 0, 1, 2]);
      expect(variance).toBeCloseTo(2, 5);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation correctly', () => {
      const numbers = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = calculateStdDev(numbers);
      expect(stdDev).toBeCloseTo(2, 5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateStdDev([])).toBe(0);
    });

    it('should return 0 for single element', () => {
      expect(calculateStdDev([5])).toBe(0);
    });
  });

  describe('calculateAverage', () => {
    it('should calculate average correctly', () => {
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });

    it('should handle decimal results', () => {
      expect(calculateAverage([1, 2])).toBe(1.5);
    });

    it('should handle negative numbers', () => {
      expect(calculateAverage([-10, 10])).toBe(0);
    });

    it('should handle single element', () => {
      expect(calculateAverage([42])).toBe(42);
    });
  });

  describe('calculateWeightedAverage', () => {
    it('should calculate weighted average correctly', () => {
      const values = [80, 90, 100];
      const weights = [1, 2, 1];
      expect(calculateWeightedAverage(values, weights)).toBe(90);
    });

    it('should return 0 for empty arrays', () => {
      expect(calculateWeightedAverage([], [])).toBe(0);
    });

    it('should return 0 for mismatched array lengths', () => {
      expect(calculateWeightedAverage([1, 2, 3], [1, 2])).toBe(0);
    });

    it('should return 0 when all weights are zero', () => {
      expect(calculateWeightedAverage([1, 2, 3], [0, 0, 0])).toBe(0);
    });

    it('should handle single value and weight', () => {
      expect(calculateWeightedAverage([50], [2])).toBe(50);
    });
  });

  // ============================================================================
  // FILE FUNCTIONS
  // ============================================================================
  describe('sanitizeFilename', () => {
    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('file name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('file@name!.pdf')).toBe('file_name_.pdf');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFilename('file___name.pdf')).toBe('file_name.pdf');
    });

    it('should preserve alphanumeric, dots, and hyphens', () => {
      expect(sanitizeFilename('file-name.2024.pdf')).toBe('file-name.2024.pdf');
    });

    it('should truncate to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      expect(sanitizeFilename(longName).length).toBe(255);
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate unique filename with timestamp and UUID', () => {
      const filename = generateUniqueFilename('document.pdf');
      expect(filename).toMatch(/^\d+_[a-f0-9]{8}_document\.pdf$/);
    });

    it('should sanitize original filename', () => {
      const filename = generateUniqueFilename('my file@name.pdf');
      expect(filename).not.toContain(' ');
      expect(filename).not.toContain('@');
    });

    it('should preserve file extension', () => {
      expect(generateUniqueFilename('test.docx')).toContain('.docx');
      expect(generateUniqueFilename('image.png')).toContain('.png');
    });

    it('should handle filename without extension', () => {
      const filename = generateUniqueFilename('noextension');
      // When there's no extension, the function uses the basename as extension too
      expect(filename).toMatch(/^\d+_[a-f0-9]{8}_noextension\./);
    });

    it('should generate unique filenames on consecutive calls', () => {
      const names = new Set(Array.from({ length: 10 }, () => generateUniqueFilename('test.pdf')));
      expect(names.size).toBe(10);
    });
  });

  describe('getFileExtension', () => {
    it('should return lowercase extension', () => {
      expect(getFileExtension('document.PDF')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
    });

    it('should handle multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('noextension')).toBe('');
    });

    it('should handle edge cases', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
      expect(getFileExtension('')).toBe('');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types', () => {
      expect(getMimeTypeFromExtension('pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('png')).toBe('image/png');
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4');
    });

    it('should handle case insensitivity', () => {
      expect(getMimeTypeFromExtension('PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('PNG')).toBe('image/png');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeTypeFromExtension('xyz')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('unknown')).toBe('application/octet-stream');
    });

    it('should handle empty extension', () => {
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  describe('parseBoolean', () => {
    it('should return boolean values as-is', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    it('should parse string "true"', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('True')).toBe(true);
    });

    it('should parse string "1"', () => {
      expect(parseBoolean('1')).toBe(true);
    });

    it('should return false for other strings', () => {
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('yes')).toBe(false);
      expect(parseBoolean('')).toBe(false);
    });

    it('should return false for non-boolean/non-string values', () => {
      expect(parseBoolean(null)).toBe(false);
      expect(parseBoolean(undefined)).toBe(false);
      expect(parseBoolean(1)).toBe(false);
      expect(parseBoolean(0)).toBe(false);
      expect(parseBoolean({})).toBe(false);
      expect(parseBoolean([])).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should create deep copy of object', () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = deepClone(original);
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
    });

    it('should handle arrays', () => {
      const original = [1, [2, 3], { a: 4 }];
      const clone = deepClone(original);
      expect(clone).toEqual(original);
      expect(clone[1]).not.toBe(original[1]);
    });

    it('should handle nested objects', () => {
      const original = { a: { b: { c: { d: 1 } } } };
      const clone = deepClone(original);
      clone.a.b.c.d = 2;
      expect(original.a.b.c.d).toBe(1);
    });

    it('should handle primitives', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(null)).toBe(null);
    });
  });

  describe('removeUndefined', () => {
    it('should remove undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const result = removeUndefined(obj);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should keep null values', () => {
      const obj = { a: 1, b: null };
      const result = removeUndefined(obj);
      expect(result).toEqual({ a: 1, b: null });
    });

    it('should keep empty strings', () => {
      const obj = { a: '', b: undefined };
      const result = removeUndefined(obj);
      expect(result).toEqual({ a: '' });
    });

    it('should keep zero values', () => {
      const obj = { a: 0, b: undefined };
      const result = removeUndefined(obj);
      expect(result).toEqual({ a: 0 });
    });

    it('should handle empty object', () => {
      expect(removeUndefined({})).toEqual({});
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle chunk size larger than array', () => {
      expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    });

    it('should handle chunk size of 1', () => {
      expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
    });

    it('should handle empty array', () => {
      expect(chunkArray([], 5)).toEqual([]);
    });

    it('should handle exact division', () => {
      expect(chunkArray([1, 2, 3, 4], 2)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });

    it('should resolve immediately for 0', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('retry', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
      await expect(retry(fn, 3, 10)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      const start = Date.now();
      await retry(fn, 2, 50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // At least first delay
    });

    it('should convert non-Error throws to Error', async () => {
      const fn = jest.fn().mockRejectedValue('string error');
      await expect(retry(fn, 1, 10)).rejects.toThrow();
    });
  });

  describe('getClientIP', () => {
    it('should return IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        ip: '127.0.0.1',
      };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should handle array x-forwarded-for', () => {
      const req = {
        headers: { 'x-forwarded-for': ['192.168.1.1', '10.0.0.1'] },
        ip: '127.0.0.1',
      };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should fall back to req.ip', () => {
      const req = {
        headers: {},
        ip: '192.168.1.100',
      };
      expect(getClientIP(req)).toBe('192.168.1.100');
    });

    it('should return "unknown" when no IP available', () => {
      const req = {
        headers: {},
      };
      expect(getClientIP(req)).toBe('unknown');
    });

    it('should trim whitespace from forwarded IP', () => {
      const req = {
        headers: { 'x-forwarded-for': '  192.168.1.1  ' },
      };
      expect(getClientIP(req)).toBe('192.168.1.1');
    });
  });

  describe('maskEmail', () => {
    it('should mask email address', () => {
      expect(maskEmail('test@example.com')).toBe('t**t@example.com');
    });

    it('should handle short local part', () => {
      expect(maskEmail('ab@example.com')).toBe('**@example.com');
      expect(maskEmail('a@example.com')).toBe('*@example.com');
    });

    it('should handle longer local parts', () => {
      // "firstname.lastname" has 18 characters, so masking keeps first and last, with 16 asterisks
      expect(maskEmail('firstname.lastname@example.com')).toBe('f****************e@example.com');
    });

    it('should return original for invalid email', () => {
      expect(maskEmail('notanemail')).toBe('notanemail');
      expect(maskEmail('')).toBe('');
    });

    it('should preserve domain', () => {
      const masked = maskEmail('user@subdomain.example.co.uk');
      expect(masked).toContain('@subdomain.example.co.uk');
    });
  });

  describe('isEmpty', () => {
    it('should return true for null', () => {
      expect(isEmpty(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('should return true for empty object', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty(' a ')).toBe(false);
    });

    it('should return false for non-empty array', () => {
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty([null])).toBe(false);
    });

    it('should return false for non-empty object', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty({ a: undefined })).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(1)).toBe(false);
    });

    it('should return false for booleans', () => {
      expect(isEmpty(false)).toBe(false);
      expect(isEmpty(true)).toBe(false);
    });
  });
});
