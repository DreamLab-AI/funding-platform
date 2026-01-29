import { query, transaction, DatabaseClient } from '../config/database';
import {
  FundingCall,
  FundingCallCreateInput,
  FundingCallUpdateInput,
  FundingCallSummary,
  CallStatus,
  Criterion,
  SubmissionRequirements,
  AssessorPoolMember,
  UserPublic,
} from '../types';
import { generateUUID } from '../utils/helpers';

export class FundingCallModel {
  /**
   * Create a new funding call
   */
  static async create(
    input: FundingCallCreateInput,
    createdBy: string
  ): Promise<FundingCall> {
    return transaction(async (client) => {
      const call_id = generateUUID();

      // Create criteria with IDs
      const criteria: Criterion[] = input.criteria.map((c, index) => ({
        criterion_id: generateUUID(),
        name: c.name,
        description: c.description || '',
        max_points: c.max_points,
        weight: c.weight,
        comments_required: c.comments_required,
        order: c.order !== undefined ? c.order : index,
      }));

      const result = await client.query<FundingCall>(
        `INSERT INTO funding_calls (
          call_id, name, description, open_at, close_at, status,
          submission_requirements, criteria, required_assessors_per_application,
          variance_threshold, retention_years, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          call_id,
          input.name,
          input.description || '',
          input.open_at,
          input.close_at,
          CallStatus.DRAFT,
          JSON.stringify(input.submission_requirements),
          JSON.stringify(criteria),
          input.required_assessors_per_application,
          input.variance_threshold || null,
          input.retention_years || 7,
          createdBy,
        ]
      );

      const call = result.rows[0];
      call.submission_requirements =
        typeof call.submission_requirements === 'string'
          ? JSON.parse(call.submission_requirements)
          : call.submission_requirements;
      call.criteria =
        typeof call.criteria === 'string' ? JSON.parse(call.criteria) : call.criteria;

      return call;
    });
  }

  /**
   * Find funding call by ID
   */
  static async findById(call_id: string): Promise<FundingCall | null> {
    const result = await query<FundingCall>(
      'SELECT * FROM funding_calls WHERE call_id = $1',
      [call_id]
    );

    if (result.rows.length === 0) return null;

    const call = result.rows[0];
    call.submission_requirements =
      typeof call.submission_requirements === 'string'
        ? JSON.parse(call.submission_requirements)
        : call.submission_requirements;
    call.criteria =
      typeof call.criteria === 'string' ? JSON.parse(call.criteria) : call.criteria;

    return call;
  }

  /**
   * Update funding call
   */
  static async update(
    call_id: string,
    input: FundingCallUpdateInput
  ): Promise<FundingCall | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.open_at !== undefined) {
      fields.push(`open_at = $${paramIndex++}`);
      values.push(input.open_at);
    }
    if (input.close_at !== undefined) {
      fields.push(`close_at = $${paramIndex++}`);
      values.push(input.close_at);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.submission_requirements !== undefined) {
      fields.push(`submission_requirements = $${paramIndex++}`);
      values.push(JSON.stringify(input.submission_requirements));
    }
    if (input.criteria !== undefined) {
      fields.push(`criteria = $${paramIndex++}`);
      values.push(JSON.stringify(input.criteria));
    }
    if (input.required_assessors_per_application !== undefined) {
      fields.push(`required_assessors_per_application = $${paramIndex++}`);
      values.push(input.required_assessors_per_application);
    }
    if (input.variance_threshold !== undefined) {
      fields.push(`variance_threshold = $${paramIndex++}`);
      values.push(input.variance_threshold);
    }
    if (input.retention_years !== undefined) {
      fields.push(`retention_years = $${paramIndex++}`);
      values.push(input.retention_years);
    }

    if (fields.length === 0) return this.findById(call_id);

    fields.push(`updated_at = NOW()`);
    values.push(call_id);

    const result = await query<FundingCall>(
      `UPDATE funding_calls SET ${fields.join(', ')} WHERE call_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    const call = result.rows[0];
    call.submission_requirements =
      typeof call.submission_requirements === 'string'
        ? JSON.parse(call.submission_requirements)
        : call.submission_requirements;
    call.criteria =
      typeof call.criteria === 'string' ? JSON.parse(call.criteria) : call.criteria;

    return call;
  }

  /**
   * Update call status
   */
  static async updateStatus(call_id: string, status: CallStatus): Promise<void> {
    await query(
      'UPDATE funding_calls SET status = $1, updated_at = NOW() WHERE call_id = $2',
      [status, call_id]
    );
  }

  /**
   * List funding calls with pagination
   */
  static async list(
    options: {
      page?: number;
      limit?: number;
      status?: CallStatus | CallStatus[];
      search?: string;
    } = {}
  ): Promise<{ calls: FundingCallSummary[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      if (Array.isArray(options.status)) {
        conditions.push(`fc.status = ANY($${paramIndex++})`);
        values.push(options.status);
      } else {
        conditions.push(`fc.status = $${paramIndex++}`);
        values.push(options.status);
      }
    }
    if (options.search) {
      conditions.push(`(fc.name ILIKE $${paramIndex} OR fc.description ILIKE $${paramIndex})`);
      values.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM funding_calls fc ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await query<FundingCallSummary>(
      `SELECT
        fc.call_id, fc.name, fc.description, fc.open_at, fc.close_at, fc.status,
        COALESCE(app_count.count, 0)::int as application_count,
        COALESCE(assessor_count.count, 0)::int as assessor_count
       FROM funding_calls fc
       LEFT JOIN (
         SELECT call_id, COUNT(*) as count FROM applications GROUP BY call_id
       ) app_count ON fc.call_id = app_count.call_id
       LEFT JOIN (
         SELECT call_id, COUNT(*) as count FROM assessor_pool WHERE is_active = true GROUP BY call_id
       ) assessor_count ON fc.call_id = assessor_count.call_id
       ${whereClause}
       ORDER BY fc.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { calls: result.rows, total };
  }

  /**
   * List open calls (for applicants)
   */
  static async listOpen(): Promise<FundingCallSummary[]> {
    const result = await query<FundingCallSummary>(
      `SELECT
        fc.call_id, fc.name, fc.description, fc.open_at, fc.close_at, fc.status,
        0 as application_count, 0 as assessor_count
       FROM funding_calls fc
       WHERE fc.status = $1 AND fc.close_at > NOW()
       ORDER BY fc.close_at ASC`,
      [CallStatus.OPEN]
    );
    return result.rows;
  }

  /**
   * Clone a funding call
   */
  static async clone(
    sourceCallId: string,
    newName: string,
    createdBy: string
  ): Promise<FundingCall> {
    const sourceCall = await this.findById(sourceCallId);
    if (!sourceCall) {
      throw new Error('Source call not found');
    }

    const newCriteria = sourceCall.criteria.map((c) => ({
      ...c,
      criterion_id: generateUUID(),
    }));

    return transaction(async (client) => {
      const call_id = generateUUID();

      const result = await client.query<FundingCall>(
        `INSERT INTO funding_calls (
          call_id, name, description, open_at, close_at, status,
          submission_requirements, criteria, required_assessors_per_application,
          variance_threshold, retention_years, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          call_id,
          newName,
          sourceCall.description,
          new Date(), // Default open_at to now
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default close_at to 30 days from now
          CallStatus.DRAFT,
          JSON.stringify(sourceCall.submission_requirements),
          JSON.stringify(newCriteria),
          sourceCall.required_assessors_per_application,
          sourceCall.variance_threshold,
          sourceCall.retention_years,
          createdBy,
        ]
      );

      const call = result.rows[0];
      call.submission_requirements =
        typeof call.submission_requirements === 'string'
          ? JSON.parse(call.submission_requirements)
          : call.submission_requirements;
      call.criteria =
        typeof call.criteria === 'string' ? JSON.parse(call.criteria) : call.criteria;

      return call;
    });
  }

  /**
   * Delete funding call
   */
  static async delete(call_id: string): Promise<void> {
    await query('DELETE FROM funding_calls WHERE call_id = $1', [call_id]);
  }

  // ============================================================================
  // ASSESSOR POOL METHODS
  // ============================================================================

  /**
   * Add assessor to pool
   */
  static async addAssessorToPool(
    call_id: string,
    user_id: string,
    expertise_tags?: string[]
  ): Promise<AssessorPoolMember> {
    const pool_id = generateUUID();

    const result = await query<AssessorPoolMember>(
      `INSERT INTO assessor_pool (pool_id, call_id, user_id, expertise_tags, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (call_id, user_id) DO UPDATE SET is_active = true, expertise_tags = $4
       RETURNING *`,
      [pool_id, call_id, user_id, expertise_tags || null]
    );

    return result.rows[0];
  }

  /**
   * Remove assessor from pool
   */
  static async removeAssessorFromPool(call_id: string, user_id: string): Promise<void> {
    await query(
      'UPDATE assessor_pool SET is_active = false WHERE call_id = $1 AND user_id = $2',
      [call_id, user_id]
    );
  }

  /**
   * Get assessor pool for a call
   */
  static async getAssessorPool(call_id: string): Promise<(AssessorPoolMember & UserPublic)[]> {
    const result = await query<AssessorPoolMember & UserPublic>(
      `SELECT ap.*, u.email, u.first_name, u.last_name, u.organisation
       FROM assessor_pool ap
       JOIN users u ON ap.user_id = u.user_id
       WHERE ap.call_id = $1 AND ap.is_active = true
       ORDER BY u.last_name, u.first_name`,
      [call_id]
    );
    return result.rows;
  }

  /**
   * Check if user is in assessor pool for a call
   */
  static async isInAssessorPool(call_id: string, user_id: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) FROM assessor_pool WHERE call_id = $1 AND user_id = $2 AND is_active = true',
      [call_id, user_id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Get criterion by ID
   */
  static getCriterion(call: FundingCall, criterion_id: string): Criterion | undefined {
    return call.criteria.find((c) => c.criterion_id === criterion_id);
  }

  /**
   * Validate status transition
   */
  static isValidStatusTransition(currentStatus: CallStatus, newStatus: CallStatus): boolean {
    const validTransitions: Record<CallStatus, CallStatus[]> = {
      [CallStatus.DRAFT]: [CallStatus.OPEN],
      [CallStatus.OPEN]: [CallStatus.CLOSED],
      [CallStatus.CLOSED]: [CallStatus.IN_ASSESSMENT],
      [CallStatus.IN_ASSESSMENT]: [CallStatus.COMPLETED],
      [CallStatus.COMPLETED]: [CallStatus.ARCHIVED],
      [CallStatus.ARCHIVED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

export default FundingCallModel;
