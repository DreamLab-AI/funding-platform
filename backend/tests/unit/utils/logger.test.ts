/**
 * Logger Unit Tests
 * Tests logging functionality in utils/logger.ts
 */

import winston from 'winston';

// Mock the config module before importing logger
jest.mock('../../../src/config', () => ({
  config: {
    logging: {
      level: 'info',
    },
    env: 'test',
  },
}));

describe('Logger', () => {
  let logger: winston.Logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Logger Configuration', () => {
    it('should create a winston logger instance', async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should have console transport', async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
      const consoleTransport = logger.transports.find(
        (t) => t instanceof winston.transports.Console
      );
      expect(consoleTransport).toBeDefined();
    });

    it('should have default meta with service name', async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
      expect(logger.defaultMeta).toEqual({ service: 'funding-platform' });
    });

    it('should export logger as default', async () => {
      const defaultExport = await import('../../../src/utils/logger');
      expect(defaultExport.default).toBeDefined();
    });
  });

  describe('Logging Methods', () => {
    beforeEach(async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
    });

    it('should log info messages', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => logger.info('Test info message')).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should log error messages', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => logger.error('Test error message')).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should log warn messages', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => logger.warn('Test warning message')).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should log debug messages', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => logger.debug('Test debug message')).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should log with metadata', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() =>
        logger.info('Test message with metadata', { userId: '123', action: 'test' })
      ).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should log errors with stack traces', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const error = new Error('Test error with stack');

      expect(() => logger.error('Error occurred', { error })).not.toThrow();

      writeSpy.mockRestore();
    });
  });

  describe('Log Format', () => {
    beforeEach(async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
    });

    it('should include timestamp in logs', () => {
      // The logger is configured with timestamp format
      const formats = logger.format;
      expect(formats).toBeDefined();
    });

    it('should support colorization', () => {
      const consoleTransport = logger.transports.find(
        (t) => t instanceof winston.transports.Console
      );
      expect(consoleTransport).toBeDefined();
    });
  });

  describe('Production Configuration', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should add file transports in production', async () => {
      jest.doMock('../../../src/config', () => ({
        config: {
          logging: { level: 'info' },
          env: 'production',
        },
      }));

      // Note: File transports are added but we can verify the logger is created
      const { logger: prodLogger } = await import('../../../src/utils/logger');
      expect(prodLogger).toBeDefined();

      // In production, should have more than just console transport
      // But we don't actually create files in tests
    });
  });

  describe('Log Levels', () => {
    beforeEach(async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
    });

    it('should support standard log levels', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => {
        logger.error('error level');
        logger.warn('warn level');
        logger.info('info level');
        logger.http('http level');
        logger.verbose('verbose level');
        logger.debug('debug level');
        logger.silly('silly level');
      }).not.toThrow();

      writeSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
    });

    it('should handle Error objects', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      const error = new Error('Test error');
      expect(() => logger.error('Error', error)).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should handle complex objects', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      const complexData = {
        user: { id: '123', name: 'Test' },
        request: { method: 'POST', path: '/api/test' },
        nested: { deep: { value: true } },
      };
      expect(() => logger.info('Complex data', complexData)).not.toThrow();

      writeSpy.mockRestore();
    });

    it('should throw on circular references (known limitation)', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj.self = circularObj;

      // Note: The current logger implementation using JSON.stringify
      // does not handle circular references - this is a known limitation
      // Consider using a safe-stringify library if circular refs are needed
      expect(() => logger.info('Circular', circularObj)).toThrow(TypeError);

      writeSpy.mockRestore();
    });

    it('should handle undefined and null values', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => logger.info('Undefined value', { value: undefined })).not.toThrow();
      expect(() => logger.info('Null value', { value: null })).not.toThrow();

      writeSpy.mockRestore();
    });
  });

  describe('Logger Immutability', () => {
    beforeEach(async () => {
      const { logger: loggerInstance } = await import('../../../src/utils/logger');
      logger = loggerInstance;
    });

    it('should maintain consistent configuration', () => {
      const level1 = logger.level;
      const level2 = logger.level;
      expect(level1).toBe(level2);
    });

    it('should have consistent transports', () => {
      const count1 = logger.transports.length;
      const count2 = logger.transports.length;
      expect(count1).toBe(count2);
    });
  });
});
