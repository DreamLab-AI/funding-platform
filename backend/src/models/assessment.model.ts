import { query, transaction } from '../config/database';
import {
  Assignment,
  AssignmentCreateInput,
  AssignmentStatus,
  AssignmentWithDetails,
  Assessment,
  AssessmentCreateInput,
  AssessmentUpdateInput,
  AssessmentStatus,
  CriterionScore,
} from '../types';
import { generateUUID, calculateAverage } from '../utils/helpers';

export class AssignmentModel {
  /**
   * Create assignment
   */
  static async create(
    input: AssignmentCreateInput,
    assignedBy: string
  ): Promise<Assignment> {
    const assignment_id = generateUUID();

    const result = await query<Assignment>(
      `INSERT INTO assignments (
        assignment_id, application_id, assessor_id, assigned_by, due_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        assignment_id,
        input.application_id,
        input.assessor_id,
        assignedBy,
        input.due_at || null,
        AssignmentStatus.PENDING,
      ]
    );

    return result.rows[0];
  }

  /**
   * Create bulk assignments using round-robin strategy
   */
  static async createBulk(
    applicationIds: string[],
    assessorIds: string[],
    assignedBy: string,
    dueAt?: Date
  ): Promise<Assignment[]> {
    if (applicationIds.length === 0 || assessorIds.length === 0) {
      return [];
    }

    return transaction(async (client) => {
      const assignments: Assignment[] = [];
      let assessorIndex = 0;

      for (const application_id of applicationIds) {
        const assessor_id = assessorIds[assessorIndex % assessorIds.length];
        const assignment_id = generateUUID();

        const result = await client.query<Assignment>(
          `INSERT INTO assignments (
            assignment_id, application_id, assessor_id, assigned_by, due_at, status
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (application_id, assessor_id) DO NOTHING
          RETURNING *`,
          [
            assignment_id,
            application_id,
            assessor_id,
            assignedBy,
            dueAt || null,
            AssignmentStatus.PENDING,
          ]
        );

        if (result.rows.length > 0) {
          assignments.push(result.rows[0]);
        }

        assessorIndex++;
      }

      return assignments;
    });
  }

  /**
   * Find assignment by ID
   */
  static async findById(assignment_id: string): Promise<Assignment | null> {
    const result = await query<Assignment>(
      'SELECT * FROM assignments WHERE assignment_id = $1',
      [assignment_id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find assignment with details
   */
  static async findWithDetails(assignment_id: string): Promise<AssignmentWithDetails | null> {
    const result = await query<AssignmentWithDetails>(
      `SELECT asn.*,
        a.reference_number as application_reference,
        a.applicant_name,
        CONCAT(u.first_name, ' ', u.last_name) as assessor_name,
        u.email as assessor_email,
        fc.name as call_name
       FROM assignments asn
       JOIN applications a ON asn.application_id = a.application_id
       JOIN users u ON asn.assessor_id = u.user_id
       JOIN funding_calls fc ON a.call_id = fc.call_id
       WHERE asn.assignment_id = $1`,
      [assignment_id]
    );
    return result.rows[0] || null;
  }

  /**
   * List assignments for an assessor
   */
  static async listByAssessor(
    assessor_id: string,
    options: {
      call_id?: string;
      status?: AssignmentStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ assignments: AssignmentWithDetails[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['asn.assessor_id = $1'];
    const values: unknown[] = [assessor_id];
    let paramIndex = 2;

    if (options.call_id) {
      conditions.push(`a.call_id = $${paramIndex++}`);
      values.push(options.call_id);
    }
    if (options.status) {
      conditions.push(`asn.status = $${paramIndex++}`);
      values.push(options.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM assignments asn
       JOIN applications a ON asn.application_id = a.application_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await query<AssignmentWithDetails>(
      `SELECT asn.*,
        a.reference_number as application_reference,
        a.applicant_name,
        CONCAT(u.first_name, ' ', u.last_name) as assessor_name,
        u.email as assessor_email,
        fc.name as call_name
       FROM assignments asn
       JOIN applications a ON asn.application_id = a.application_id
       JOIN users u ON asn.assessor_id = u.user_id
       JOIN funding_calls fc ON a.call_id = fc.call_id
       ${whereClause}
       ORDER BY asn.due_at ASC NULLS LAST, asn.assigned_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { assignments: result.rows, total };
  }

  /**
   * List assignments for an application
   */
  static async listByApplication(application_id: string): Promise<AssignmentWithDetails[]> {
    const result = await query<AssignmentWithDetails>(
      `SELECT asn.*,
        a.reference_number as application_reference,
        a.applicant_name,
        CONCAT(u.first_name, ' ', u.last_name) as assessor_name,
        u.email as assessor_email,
        fc.name as call_name
       FROM assignments asn
       JOIN applications a ON asn.application_id = a.application_id
       JOIN users u ON asn.assessor_id = u.user_id
       JOIN funding_calls fc ON a.call_id = fc.call_id
       WHERE asn.application_id = $1
       ORDER BY asn.assigned_at`,
      [application_id]
    );
    return result.rows;
  }

  /**
   * Update assignment status
   */
  static async updateStatus(
    assignment_id: string,
    status: AssignmentStatus
  ): Promise<void> {
    const extraFields =
      status === AssignmentStatus.IN_PROGRESS
        ? ', started_at = COALESCE(started_at, NOW())'
        : status === AssignmentStatus.COMPLETED
          ? ', completed_at = NOW()'
          : '';

    await query(
      `UPDATE assignments SET status = $1${extraFields} WHERE assignment_id = $2`,
      [status, assignment_id]
    );
  }

  /**
   * Delete assignment
   */
  static async delete(assignment_id: string): Promise<void> {
    await query('DELETE FROM assignments WHERE assignment_id = $1', [assignment_id]);
  }

  /**
   * Check if assignment exists
   */
  static async exists(application_id: string, assessor_id: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) FROM assignments WHERE application_id = $1 AND assessor_id = $2',
      [application_id, assessor_id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Check if assignment belongs to assessor
   */
  static async belongsToAssessor(
    assignment_id: string,
    assessor_id: string
  ): Promise<boolean> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) FROM assignments WHERE assignment_id = $1 AND assessor_id = $2',
      [assignment_id, assessor_id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }
}

export class AssessmentModel {
  /**
   * Create or get assessment for assignment
   */
  static async createOrGet(input: AssessmentCreateInput): Promise<Assessment> {
    // Check if assessment already exists
    const existing = await this.findByAssignment(input.assignment_id);
    if (existing) return existing;

    const assessment_id = generateUUID();

    const result = await query<Assessment>(
      `INSERT INTO assessments (
        assessment_id, assignment_id, scores, overall_score, overall_comment,
        coi_confirmed, coi_details, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        assessment_id,
        input.assignment_id,
        JSON.stringify(input.scores || []),
        0,
        input.overall_comment || null,
        input.coi_confirmed || false,
        input.coi_details || null,
        AssessmentStatus.DRAFT,
      ]
    );

    const assessment = result.rows[0];
    assessment.scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    // Update assignment status
    await AssignmentModel.updateStatus(input.assignment_id, AssignmentStatus.IN_PROGRESS);

    return assessment;
  }

  /**
   * Find assessment by ID
   */
  static async findById(assessment_id: string): Promise<Assessment | null> {
    const result = await query<Assessment>(
      'SELECT * FROM assessments WHERE assessment_id = $1',
      [assessment_id]
    );

    if (result.rows.length === 0) return null;

    const assessment = result.rows[0];
    assessment.scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    return assessment;
  }

  /**
   * Find assessment by assignment ID
   */
  static async findByAssignment(assignment_id: string): Promise<Assessment | null> {
    const result = await query<Assessment>(
      'SELECT * FROM assessments WHERE assignment_id = $1',
      [assignment_id]
    );

    if (result.rows.length === 0) return null;

    const assessment = result.rows[0];
    assessment.scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    return assessment;
  }

  /**
   * Update assessment
   */
  static async update(
    assessment_id: string,
    input: AssessmentUpdateInput
  ): Promise<Assessment | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.scores !== undefined) {
      fields.push(`scores = $${paramIndex++}`);
      values.push(JSON.stringify(input.scores));

      // Recalculate overall score
      const overall_score = calculateAverage(input.scores.map((s) => s.score));
      fields.push(`overall_score = $${paramIndex++}`);
      values.push(overall_score);
    }
    if (input.overall_comment !== undefined) {
      fields.push(`overall_comment = $${paramIndex++}`);
      values.push(input.overall_comment);
    }
    if (input.coi_confirmed !== undefined) {
      fields.push(`coi_confirmed = $${paramIndex++}`);
      values.push(input.coi_confirmed);
    }
    if (input.coi_details !== undefined) {
      fields.push(`coi_details = $${paramIndex++}`);
      values.push(input.coi_details);
    }

    if (fields.length === 0) return this.findById(assessment_id);

    fields.push(`updated_at = NOW()`);
    values.push(assessment_id);

    const result = await query<Assessment>(
      `UPDATE assessments SET ${fields.join(', ')} WHERE assessment_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    const assessment = result.rows[0];
    assessment.scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    return assessment;
  }

  /**
   * Submit assessment
   */
  static async submit(assessment_id: string): Promise<Assessment | null> {
    const result = await query<Assessment>(
      `UPDATE assessments
       SET status = $1, submitted_at = NOW(), updated_at = NOW()
       WHERE assessment_id = $2
       RETURNING *`,
      [AssessmentStatus.SUBMITTED, assessment_id]
    );

    if (result.rows.length === 0) return null;

    const assessment = result.rows[0];
    assessment.scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    // Update assignment status
    await AssignmentModel.updateStatus(assessment.assignment_id, AssignmentStatus.COMPLETED);

    return assessment;
  }

  /**
   * Return assessment for revision
   */
  static async returnForRevision(assessment_id: string): Promise<void> {
    const assessment = await this.findById(assessment_id);
    if (!assessment) return;

    await query(
      'UPDATE assessments SET status = $1, updated_at = NOW() WHERE assessment_id = $2',
      [AssessmentStatus.RETURNED, assessment_id]
    );

    await AssignmentModel.updateStatus(assessment.assignment_id, AssignmentStatus.RETURNED);
  }

  /**
   * List assessments for an application
   */
  static async listByApplication(application_id: string): Promise<Assessment[]> {
    const result = await query<Assessment>(
      `SELECT ass.* FROM assessments ass
       JOIN assignments asn ON ass.assignment_id = asn.assignment_id
       WHERE asn.application_id = $1 AND ass.status = $2
       ORDER BY ass.submitted_at`,
      [application_id, AssessmentStatus.SUBMITTED]
    );

    return result.rows.map((assessment) => ({
      ...assessment,
      scores:
        typeof assessment.scores === 'string'
          ? JSON.parse(assessment.scores)
          : assessment.scores,
    }));
  }

  /**
   * Get assessments with assessor info for application
   */
  static async getWithAssessorInfo(
    application_id: string
  ): Promise<(Assessment & { assessor_name: string; assessor_id: string })[]> {
    const result = await query<Assessment & { assessor_name: string; assessor_id: string }>(
      `SELECT ass.*, CONCAT(u.first_name, ' ', u.last_name) as assessor_name, u.user_id as assessor_id
       FROM assessments ass
       JOIN assignments asn ON ass.assignment_id = asn.assignment_id
       JOIN users u ON asn.assessor_id = u.user_id
       WHERE asn.application_id = $1 AND ass.status = $2
       ORDER BY ass.submitted_at`,
      [application_id, AssessmentStatus.SUBMITTED]
    );

    return result.rows.map((assessment) => ({
      ...assessment,
      scores:
        typeof assessment.scores === 'string'
          ? JSON.parse(assessment.scores)
          : assessment.scores,
    }));
  }

  /**
   * Delete assessment
   */
  static async delete(assessment_id: string): Promise<void> {
    await query('DELETE FROM assessments WHERE assessment_id = $1', [assessment_id]);
  }
}

export default { AssignmentModel, AssessmentModel };
