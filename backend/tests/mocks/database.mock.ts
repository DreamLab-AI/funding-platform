/**
 * Database Mock
 * PostgreSQL pool and query mocking utilities
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export interface MockQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

export interface MockPoolClient {
  query: jest.Mock<Promise<MockQueryResult>>;
  release: jest.Mock<void>;
  connect: jest.Mock<Promise<void>>;
  end: jest.Mock<Promise<void>>;
}

/**
 * Create a mock query result
 */
export function createQueryResult<T>(rows: T[], command: string = 'SELECT'): MockQueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    command,
    oid: 0,
    fields: [],
  };
}

/**
 * Create a mock pool client
 */
export function createMockPoolClient(): MockPoolClient {
  return {
    query: jest.fn().mockResolvedValue(createQueryResult([])),
    release: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock database pool
 */
export function createMockPool() {
  const mockClient = createMockPoolClient();

  const pool = {
    query: jest.fn().mockResolvedValue(createQueryResult([])),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    removeListener: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
    _mockClient: mockClient,
  };

  return pool;
}

/**
 * Mock transaction helper
 */
export function createMockTransaction(mockClient: MockPoolClient) {
  return {
    begin: async () => {
      await mockClient.query('BEGIN');
    },
    commit: async () => {
      await mockClient.query('COMMIT');
    },
    rollback: async () => {
      await mockClient.query('ROLLBACK');
    },
    query: mockClient.query,
    release: mockClient.release,
  };
}

/**
 * Setup query responses for common operations
 */
export function setupQueryResponses(mockPool: ReturnType<typeof createMockPool>, responses: Record<string, any[]>) {
  mockPool.query.mockImplementation(async (sql: string, params?: any[]) => {
    const normalizedSql = sql.toLowerCase().trim();

    for (const [pattern, rows] of Object.entries(responses)) {
      if (normalizedSql.includes(pattern.toLowerCase())) {
        return createQueryResult(rows);
      }
    }

    return createQueryResult([]);
  });
}

/**
 * Create mock database connection for testing
 */
export function createMockDbConnection() {
  const mockPool = createMockPool();

  return {
    pool: mockPool,
    query: mockPool.query,
    getClient: async () => mockPool.connect(),
    end: mockPool.end,
    transaction: async <T>(callback: (client: MockPoolClient) => Promise<T>): Promise<T> => {
      const client = await mockPool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Mock database error
 */
export class MockDatabaseError extends Error {
  code: string;
  detail?: string;
  constraint?: string;
  table?: string;

  constructor(message: string, code: string = '23505', options?: { detail?: string; constraint?: string; table?: string }) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.detail = options?.detail;
    this.constraint = options?.constraint;
    this.table = options?.table;
  }
}

/**
 * Common database error codes
 */
export const DB_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  CONNECTION_REFUSED: 'ECONNREFUSED',
  CONNECTION_TIMEOUT: 'ETIMEDOUT',
} as const;

/**
 * Create mock for common database operations
 */
export function createMockDatabaseOperations() {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    exists: jest.fn(),
    executeRaw: jest.fn(),
  };
}

export default {
  createMockPool,
  createMockPoolClient,
  createQueryResult,
  createMockDbConnection,
  createMockTransaction,
  setupQueryResponses,
  MockDatabaseError,
  DB_ERROR_CODES,
  createMockDatabaseOperations,
};
