/**
 * Jest Setup File
 * Runs before each test file
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TZ = 'Europe/London';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.AWS_REGION = 'eu-west-2';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.LOG_LEVEL = 'silent';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testDb: any;
      testRedis: any;
    }
  }
  var testDb: any;
  var testRedis: any;
}

// Mock console methods to reduce test noise
const originalConsole = { ...console };
beforeAll(() => {
  if (process.env.VERBOSE_TESTS !== 'true') {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };
  }
});

afterAll(() => {
  global.console = originalConsole;
});

// Clean up function to run after all tests
afterAll(async () => {
  // Close any open handles (database connections, etc.)
  if (global.testDb) {
    await global.testDb.end?.();
  }
  if (global.testRedis) {
    await global.testRedis.quit?.();
  }
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`,
      pass,
    };
  },

  toBeISO8601(received: string) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    const pass = iso8601Regex.test(received) && !isNaN(Date.parse(received));
    return {
      message: () => pass
        ? `expected ${received} not to be a valid ISO 8601 date`
        : `expected ${received} to be a valid ISO 8601 date`,
      pass,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      message: () => pass
        ? `expected ${received} not to be a valid email`
        : `expected ${received} to be a valid email`,
      pass,
    };
  },

  toContainAllKeys(received: object, keys: string[]) {
    const receivedKeys = Object.keys(received);
    const pass = keys.every(key => receivedKeys.includes(key));
    return {
      message: () => pass
        ? `expected object not to contain all keys: ${keys.join(', ')}`
        : `expected object to contain all keys: ${keys.join(', ')}, but missing: ${keys.filter(k => !receivedKeys.includes(k)).join(', ')}`,
      pass,
    };
  },

  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    return {
      message: () => pass
        ? `expected ${received} not to be a valid JWT`
        : `expected ${received} to be a valid JWT`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUUID(): R;
      toBeISO8601(): R;
      toBeValidEmail(): R;
      toContainAllKeys(keys: string[]): R;
      toBeValidJWT(): R;
    }
  }
}

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

export {};
