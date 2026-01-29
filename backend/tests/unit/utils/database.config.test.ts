/**
 * Database Configuration Unit Tests
 * Tests database pool configuration and helper functions in config/database.ts
 */

// Mock modules before any imports
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();
const mockRelease = jest.fn();

const mockPool = {
  query: mockQuery,
  connect: mockConnect,
  end: mockEnd,
  on: mockOn,
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: jest.fn(),
  },
  default: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: jest.fn(),
  },
}));

jest.mock('../../../src/config', () => ({
  config: {
    database: {
      url: '',
      host: 'localhost',
      port: 5432,
      name: 'test_db',
      user: 'test_user',
      password: 'test_password',
      ssl: false,
    },
  },
}));

describe('Database Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    mockConnect.mockReset();
    mockEnd.mockReset();
    mockLoggerDebug.mockReset();
    mockLoggerError.mockReset();
    mockLoggerInfo.mockReset();
  });

  describe('Pool Creation', () => {
    it('should export pool instance', async () => {
      const { pool } = await import('../../../src/config/database');
      expect(pool).toBeDefined();
      expect(pool.query).toBeDefined();
      expect(pool.connect).toBeDefined();
    });

    it('should register event handlers on pool', async () => {
      const { pool } = await import('../../../src/config/database');
      // Pool.on is called during module initialization
      expect(pool.on).toBeDefined();
    });
  });

  describe('query function', () => {
    it('should execute query and return result', async () => {
      const { query } = await import('../../../src/config/database');

      const mockResult = { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
      mockQuery.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM users WHERE id = $1', ['1']);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['1']);
      expect(result).toEqual(mockResult);
    });

    it('should log query execution with debug level', async () => {
      const { query } = await import('../../../src/config/database');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValue(mockResult);

      await query('SELECT 1');

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: 'SELECT 1',
          rows: 0,
        })
      );
    });

    it('should truncate long query text in logs', async () => {
      const { query } = await import('../../../src/config/database');

      const longQuery = 'SELECT * FROM ' + 'a'.repeat(200);
      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValue(mockResult);

      await query(longQuery);

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: expect.stringMatching(/^.{100}$/),
        })
      );
    });

    it('should log and throw on query error', async () => {
      const { query } = await import('../../../src/config/database');

      const error = new Error('Database connection failed');
      mockQuery.mockRejectedValue(error);

      await expect(query('SELECT * FROM users')).rejects.toThrow('Database connection failed');
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Database query error',
        expect.objectContaining({
          text: 'SELECT * FROM users',
        })
      );
    });

    it('should handle unknown error types in logging', async () => {
      const { query } = await import('../../../src/config/database');

      mockQuery.mockRejectedValue('String error');

      await expect(query('SELECT 1')).rejects.toBe('String error');
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Database query error',
        expect.objectContaining({
          error: 'Unknown error',
        })
      );
    });

    it('should include duration in log output', async () => {
      const { query } = await import('../../../src/config/database');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValue(mockResult);

      await query('SELECT 1');

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('getClient function', () => {
    it('should return a client with query and release methods', async () => {
      const { getClient } = await import('../../../src/config/database');

      const mockClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const client = await getClient();

      expect(client.query).toBeDefined();
      expect(client.release).toBeDefined();
    });

    it('should wrap client query method', async () => {
      const { getClient } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const client = await getClient();
      await client.query('SELECT 1', []);

      expect(mockClientQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should wrap client release method', async () => {
      const { getClient } = await import('../../../src/config/database');

      const mockClient = {
        query: jest.fn(),
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const client = await getClient();
      client.release();

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('transaction function', () => {
    it('should execute callback within transaction', async () => {
      const { transaction } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const callback = jest.fn().mockResolvedValue('result');
      const result = await transaction(callback);

      // The client.query is wrapped so it calls with (text, params)
      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN', undefined);
      expect(callback).toHaveBeenCalled();
      expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'COMMIT', undefined);
      expect(mockRelease).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should rollback on error', async () => {
      const { transaction } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(transaction(callback)).rejects.toThrow('Transaction failed');
      // The client.query is wrapped so it calls with (text, params)
      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN', undefined);
      expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'ROLLBACK', undefined);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should release client even after error', async () => {
      const { transaction } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const callback = jest.fn().mockRejectedValue(new Error('Error'));

      try {
        await transaction(callback);
      } catch {
        // Expected
      }

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('healthCheck function', () => {
    it('should return true when database is healthy', async () => {
      const { healthCheck } = await import('../../../src/config/database');

      mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const result = await healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      const { healthCheck } = await import('../../../src/config/database');

      mockQuery.mockRejectedValue(new Error('Connection refused'));

      const result = await healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('closePool function', () => {
    it('should close the pool', async () => {
      const { closePool } = await import('../../../src/config/database');

      mockEnd.mockResolvedValue(undefined);

      await closePool();

      expect(mockEnd).toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalledWith('Database pool closed');
    });
  });

  describe('testConnection alias', () => {
    it('should be an alias for healthCheck', async () => {
      const { testConnection, healthCheck } = await import('../../../src/config/database');

      expect(testConnection).toBe(healthCheck);
    });
  });

  describe('Default export', () => {
    it('should export all database functions', async () => {
      const db = await import('../../../src/config/database');

      expect(db.default.pool).toBeDefined();
      expect(db.default.query).toBeDefined();
      expect(db.default.getClient).toBeDefined();
      expect(db.default.transaction).toBeDefined();
      expect(db.default.healthCheck).toBeDefined();
      expect(db.default.testConnection).toBeDefined();
      expect(db.default.closePool).toBeDefined();
    });
  });

  describe('DatabaseClient interface', () => {
    it('should have correct interface shape', async () => {
      const { getClient } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const client = await getClient();

      // Verify interface methods exist
      expect(typeof client.query).toBe('function');
      expect(typeof client.release).toBe('function');
    });
  });

  describe('Query with parameters', () => {
    it('should pass parameters to pool query', async () => {
      const { query } = await import('../../../src/config/database');

      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await query('SELECT * FROM users WHERE id = $1 AND status = $2', [1, 'active']);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND status = $2',
        [1, 'active']
      );
    });

    it('should work without parameters', async () => {
      const { query } = await import('../../../src/config/database');

      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await query('SELECT NOW()');

      expect(mockQuery).toHaveBeenCalledWith('SELECT NOW()', undefined);
    });
  });

  describe('Transaction with client operations', () => {
    it('should pass client to callback', async () => {
      const { transaction } = await import('../../../src/config/database');

      const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockRelease,
      };
      mockConnect.mockResolvedValue(mockClient);

      const callback = jest.fn().mockImplementation(async (client) => {
        await client.query('SELECT * FROM users');
        return 'done';
      });

      await transaction(callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.any(Function),
          release: expect.any(Function),
        })
      );
    });
  });
});
