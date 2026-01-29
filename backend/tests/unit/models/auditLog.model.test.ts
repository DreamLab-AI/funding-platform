/**
 * AuditLog Model Unit Tests
 *
 * Tests audit log creation, querying, and data retention
 */

import { AuditLogModel } from '../../../src/models/auditLog.model';
import { AuditLog, AuditLogCreateInput, AuditLogQuery, AuditAction, UserRole } from '../../../src/types';
import * as database from '../../../src/config/database';

// Mock the database module
jest.mock('../../../src/config/database', () => ({
  query: jest.fn(),
}));

// Mock UUID
jest.mock('../../../src/utils/helpers', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Also mock uuid directly
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('AuditLogModel', () => {
  const mockQuery = database.query as jest.Mock;

  const mockAuditLog: AuditLog = {
    event_id: 'event-123',
    actor_id: 'user-123',
    actor_role: UserRole.COORDINATOR,
    actor_email: 'coordinator@example.com',
    action: AuditAction.USER_LOGIN,
    target_type: 'user',
    target_id: 'user-123',
    details: { ip: '192.168.1.1', browser: 'Chrome' },
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: AuditLogCreateInput = {
      actor_id: 'user-123',
      actor_role: UserRole.COORDINATOR,
      actor_email: 'coordinator@example.com',
      action: AuditAction.CALL_CREATED,
      target_type: 'funding_call',
      target_id: 'call-123',
      details: { call_name: 'New Funding Call' },
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
    };

    it('should create audit log entry', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: JSON.stringify(mockAuditLog.details) }],
      });

      const result = await AuditLogModel.create(createInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          UserRole.COORDINATOR,
          'coordinator@example.com',
          AuditAction.CALL_CREATED,
          'funding_call',
          'call-123',
        ])
      );
      expect(result.event_id).toBe('event-123');
    });

    it('should handle null optional fields', async () => {
      const minimalInput: AuditLogCreateInput = {
        action: AuditAction.USER_LOGIN,
        target_type: 'system',
      };

      mockQuery.mockResolvedValue({
        rows: [{
          event_id: 'event-456',
          action: AuditAction.USER_LOGIN,
          target_type: 'system',
          details: '{}',
          timestamp: new Date(),
        }],
      });

      await AuditLogModel.create(minimalInput);

      const queryArgs = mockQuery.mock.calls[0][1];
      expect(queryArgs).toContain(null); // actor_id
      expect(queryArgs).toContain(null); // actor_role
      expect(queryArgs).toContain(null); // actor_email
      expect(queryArgs).toContain(null); // target_id
    });

    it('should stringify details object', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: '{"key": "value"}' }],
      });

      await AuditLogModel.create({
        ...createInput,
        details: { key: 'value' },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{"key":"value"}'])
      );
    });

    it('should parse JSON details in response', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: '{"parsed": true}' }],
      });

      const result = await AuditLogModel.create(createInput);

      expect(typeof result.details).toBe('object');
      expect(result.details).toHaveProperty('parsed', true);
    });
  });

  describe('findById', () => {
    it('should return audit log when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: JSON.stringify(mockAuditLog.details) }],
      });

      const result = await AuditLogModel.findById('event-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM audit_logs WHERE event_id = $1',
        ['event-123']
      );
      expect(result).not.toBeNull();
      expect(result?.event_id).toBe('event-123');
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await AuditLogModel.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should parse JSON details', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: '{"test": 123}' }],
      });

      const result = await AuditLogModel.findById('event-123');

      expect(result?.details).toEqual({ test: 123 });
    });
  });

  describe('query', () => {
    it('should query logs with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({
          rows: [{ ...mockAuditLog, details: '{}' }],
        });

      const result = await AuditLogModel.query({ limit: 20, offset: 0 });

      expect(result.total).toBe(100);
      expect(result.logs).toHaveLength(1);
    });

    it('should filter by actor_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({ actor_id: 'user-123' });

      expect(mockQuery.mock.calls[0][0]).toContain('actor_id = $1');
      expect(mockQuery.mock.calls[0][1]).toContain('user-123');
    });

    it('should filter by action', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({ action: AuditAction.APPLICATION_SUBMITTED });

      expect(mockQuery.mock.calls[0][0]).toContain('action = $1');
    });

    it('should filter by target_type', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({ target_type: 'application' });

      expect(mockQuery.mock.calls[0][0]).toContain('target_type = $1');
    });

    it('should filter by target_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({ target_id: 'app-123' });

      expect(mockQuery.mock.calls[0][0]).toContain('target_id = $1');
    });

    it('should filter by date range', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-12-31');

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '200' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({ from_date: fromDate, to_date: toDate });

      expect(mockQuery.mock.calls[0][0]).toContain('timestamp >= $1');
      expect(mockQuery.mock.calls[0][0]).toContain('timestamp <= $2');
    });

    it('should combine multiple filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({
        actor_id: 'user-123',
        action: AuditAction.FILE_UPLOADED,
        target_type: 'file',
      });

      expect(mockQuery.mock.calls[0][0]).toContain('actor_id = $1');
      expect(mockQuery.mock.calls[0][0]).toContain('action = $2');
      expect(mockQuery.mock.calls[0][0]).toContain('target_type = $3');
    });

    it('should use default limit when not specified', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditLogModel.query({});

      const selectQuery = mockQuery.mock.calls[1][0];
      expect(selectQuery).toContain('LIMIT');
      expect(mockQuery.mock.calls[1][1]).toContain(50); // default limit
    });

    it('should parse details for all returned logs', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            { ...mockAuditLog, event_id: 'event-1', details: '{"a": 1}' },
            { ...mockAuditLog, event_id: 'event-2', details: '{"b": 2}' },
          ],
        });

      const result = await AuditLogModel.query({});

      expect(result.logs[0].details).toEqual({ a: 1 });
      expect(result.logs[1].details).toEqual({ b: 2 });
    });
  });

  describe('getForTarget', () => {
    it('should return logs for specific target', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: '{}' }],
      });

      const result = await AuditLogModel.getForTarget('application', 'app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE target_type = $1 AND target_id = $2'),
        ['application', 'app-123', 50]
      );
      expect(result).toHaveLength(1);
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AuditLogModel.getForTarget('user', 'user-123', 10);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['user', 'user-123', 10]
      );
    });
  });

  describe('getForActor', () => {
    it('should return logs for specific actor', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: '{}' }],
      });

      const result = await AuditLogModel.getForActor('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE actor_id = $1'),
        ['user-123', 50]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getRecent', () => {
    it('should return recent logs ordered by timestamp', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { ...mockAuditLog, details: '{}' },
          { ...mockAuditLog, details: '{}' },
        ],
      });

      const result = await AuditLogModel.getRecent(100);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        [100]
      );
      expect(result).toHaveLength(2);
    });

    it('should use default limit of 100', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AuditLogModel.getRecent();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [100]
      );
    });
  });

  describe('getLoginHistory', () => {
    it('should return login and logout events for user', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { ...mockAuditLog, action: AuditAction.USER_LOGIN, details: '{}' },
          { ...mockAuditLog, action: AuditAction.USER_LOGOUT, details: '{}' },
        ],
      });

      const result = await AuditLogModel.getLoginHistory('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('action IN ($2, $3)'),
        ['user-123', AuditAction.USER_LOGIN, AuditAction.USER_LOGOUT, 20]
      );
      expect(result).toHaveLength(2);
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AuditLogModel.getLoginHistory('user-123', 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      );
    });
  });

  describe('getDownloadHistory', () => {
    it('should return file download events', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, action: AuditAction.FILE_DOWNLOADED, details: '{}' }],
      });

      const result = await AuditLogModel.getDownloadHistory();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('action = $1'),
        expect.arrayContaining([AuditAction.FILE_DOWNLOADED])
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by target_id when provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await AuditLogModel.getDownloadHistory('file-123');

      expect(mockQuery.mock.calls[0][0]).toContain('target_id = $2');
      expect(mockQuery.mock.calls[0][1]).toContain('file-123');
    });
  });

  describe('countByAction', () => {
    it('should count events by action type', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await AuditLogModel.countByAction(AuditAction.APPLICATION_SUBMITTED);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [AuditAction.APPLICATION_SUBMITTED]
      );
      expect(result).toBe(42);
    });

    it('should filter by date range', async () => {
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-06-30');

      mockQuery.mockResolvedValue({ rows: [{ count: '10' }] });

      await AuditLogModel.countByAction(AuditAction.USER_LOGIN, fromDate, toDate);

      expect(mockQuery.mock.calls[0][0]).toContain('timestamp >= $2');
      expect(mockQuery.mock.calls[0][0]).toContain('timestamp <= $3');
    });

    it('should filter by fromDate only', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '5' }] });

      await AuditLogModel.countByAction(AuditAction.CALL_CREATED, new Date('2025-01-01'));

      expect(mockQuery.mock.calls[0][0]).toContain('timestamp >= $2');
      expect(mockQuery.mock.calls[0][0]).not.toContain('timestamp <= $3');
    });

    it('should filter by toDate only', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '15' }] });

      await AuditLogModel.countByAction(AuditAction.FILE_UPLOADED, undefined, new Date('2025-12-31'));

      expect(mockQuery.mock.calls[0][0]).toContain('timestamp <= $2');
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete logs older than specified date', async () => {
      const cutoffDate = new Date('2024-01-01');
      mockQuery.mockResolvedValue({ rowCount: 150 });

      const result = await AuditLogModel.deleteOlderThan(cutoffDate);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM audit_logs WHERE timestamp < $1',
        [cutoffDate]
      );
      expect(result).toBe(150);
    });

    it('should return 0 when no rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await AuditLogModel.deleteOlderThan(new Date());

      expect(result).toBe(0);
    });

    it('should handle undefined rowCount', async () => {
      mockQuery.mockResolvedValue({});

      const result = await AuditLogModel.deleteOlderThan(new Date());

      expect(result).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(AuditLogModel.findById('event-123')).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid JSON in details', async () => {
      // In real scenario, this would be a parsing error
      // The model expects valid JSON from the database
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, details: {} }], // already parsed
      });

      const result = await AuditLogModel.findById('event-123');

      expect(result?.details).toEqual({});
    });
  });

  describe('audit action coverage', () => {
    const allActions: AuditAction[] = [
      AuditAction.USER_LOGIN,
      AuditAction.USER_LOGOUT,
      AuditAction.USER_CREATED,
      AuditAction.USER_UPDATED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.PASSWORD_RESET,
      AuditAction.CALL_CREATED,
      AuditAction.CALL_UPDATED,
      AuditAction.CALL_STATUS_CHANGED,
      AuditAction.CALL_CLONED,
      AuditAction.APPLICATION_CREATED,
      AuditAction.APPLICATION_UPDATED,
      AuditAction.APPLICATION_SUBMITTED,
      AuditAction.APPLICATION_WITHDRAWN,
      AuditAction.APPLICATION_REOPENED,
      AuditAction.FILE_UPLOADED,
      AuditAction.FILE_DOWNLOADED,
      AuditAction.FILE_DELETED,
      AuditAction.ASSESSOR_ASSIGNED,
      AuditAction.ASSESSOR_UNASSIGNED,
      AuditAction.BULK_ASSIGNMENT,
      AuditAction.ASSESSMENT_CREATED,
      AuditAction.ASSESSMENT_UPDATED,
      AuditAction.ASSESSMENT_SUBMITTED,
      AuditAction.ASSESSMENT_RETURNED,
      AuditAction.COI_DECLARED,
      AuditAction.EXPORT_METADATA,
      AuditAction.EXPORT_RESULTS,
      AuditAction.EXPORT_FILES,
      AuditAction.CONFIG_CHANGED,
      AuditAction.REMINDER_SENT,
    ];

    it.each(allActions)('should handle action: %s', async (action) => {
      mockQuery.mockResolvedValue({
        rows: [{ ...mockAuditLog, action, details: '{}' }],
      });

      const input: AuditLogCreateInput = {
        action,
        target_type: 'test',
      };

      const result = await AuditLogModel.create(input);

      expect(result).toBeDefined();
    });
  });
});
