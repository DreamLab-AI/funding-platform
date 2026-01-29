import { query } from '../config/database';
import { AuditLog, AuditLogCreateInput, AuditLogQuery, AuditAction, UserRole } from '../types';
import { generateUUID } from '../utils/helpers';

export class AuditLogModel {
  /**
   * Create audit log entry
   */
  static async create(input: AuditLogCreateInput): Promise<AuditLog> {
    const event_id = generateUUID();

    const result = await query<AuditLog>(
      `INSERT INTO audit_logs (
        event_id, actor_id, actor_role, actor_email, action,
        target_type, target_id, details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        event_id,
        input.actor_id || null,
        input.actor_role || null,
        input.actor_email || null,
        input.action,
        input.target_type,
        input.target_id || null,
        JSON.stringify(input.details || {}),
        input.ip_address || null,
        input.user_agent || null,
      ]
    );

    const log = result.rows[0];
    log.details =
      typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

    return log;
  }

  /**
   * Find audit log by ID
   */
  static async findById(event_id: string): Promise<AuditLog | null> {
    const result = await query<AuditLog>(
      'SELECT * FROM audit_logs WHERE event_id = $1',
      [event_id]
    );

    if (result.rows.length === 0) return null;

    const log = result.rows[0];
    log.details =
      typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

    return log;
  }

  /**
   * Query audit logs with filters
   */
  static async query(
    filters: AuditLogQuery = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const page = 1;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.actor_id) {
      conditions.push(`actor_id = $${paramIndex++}`);
      values.push(filters.actor_id);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }
    if (filters.target_type) {
      conditions.push(`target_type = $${paramIndex++}`);
      values.push(filters.target_type);
    }
    if (filters.target_id) {
      conditions.push(`target_id = $${paramIndex++}`);
      values.push(filters.target_id);
    }
    if (filters.from_date) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(filters.from_date);
    }
    if (filters.to_date) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(filters.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    const logs = result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));

    return { logs, total };
  }

  /**
   * Get audit logs for a specific target
   */
  static async getForTarget(
    target_type: string,
    target_id: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE target_type = $1 AND target_id = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [target_type, target_id, limit]
    );

    return result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));
  }

  /**
   * Get audit logs for a specific actor
   */
  static async getForActor(actor_id: string, limit: number = 50): Promise<AuditLog[]> {
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE actor_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [actor_id, limit]
    );

    return result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));
  }

  /**
   * Get recent audit logs
   */
  static async getRecent(limit: number = 100): Promise<AuditLog[]> {
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));
  }

  /**
   * Get login history for a user
   */
  static async getLoginHistory(
    user_id: string,
    limit: number = 20
  ): Promise<AuditLog[]> {
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE actor_id = $1 AND action IN ($2, $3)
       ORDER BY timestamp DESC
       LIMIT $4`,
      [user_id, AuditAction.USER_LOGIN, AuditAction.USER_LOGOUT, limit]
    );

    return result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));
  }

  /**
   * Get file download history
   */
  static async getDownloadHistory(
    target_id?: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const conditions = ['action = $1'];
    const values: unknown[] = [AuditAction.FILE_DOWNLOADED];

    if (target_id) {
      conditions.push('target_id = $2');
      values.push(target_id);
    }

    values.push(limit);
    const result = await query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY timestamp DESC
       LIMIT $${values.length}`,
      values
    );

    return result.rows.map((log) => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }));
  }

  /**
   * Count actions by type in a time period
   */
  static async countByAction(
    action: AuditAction,
    fromDate?: Date,
    toDate?: Date
  ): Promise<number> {
    const conditions = ['action = $1'];
    const values: unknown[] = [action];

    if (fromDate) {
      conditions.push(`timestamp >= $${values.length + 1}`);
      values.push(fromDate);
    }
    if (toDate) {
      conditions.push(`timestamp <= $${values.length + 1}`);
      values.push(toDate);
    }

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs WHERE ${conditions.join(' AND ')}`,
      values
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete old audit logs (for data retention)
   */
  static async deleteOlderThan(date: Date): Promise<number> {
    const result = await query(
      'DELETE FROM audit_logs WHERE timestamp < $1',
      [date]
    );
    return result.rowCount || 0;
  }
}

export default AuditLogModel;
