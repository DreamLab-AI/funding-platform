/**
 * Jest Setup File
 * Runs before each test file
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TZ = 'Europe/London';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testDb: any;
    }
  }
}

// Mock console methods to reduce test noise (optional)
// Uncomment if tests are too verbose
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Clean up function to run after all tests
afterAll(async () => {
  // Close any open handles (database connections, etc.)
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
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUUID(): R;
      toBeISO8601(): R;
    }
  }
}

export {};
