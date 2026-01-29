import { query, transaction, DatabaseClient } from '../config/database';
import {
  Application,
  ApplicationCreateInput,
  ApplicationUpdateInput,
  ApplicationListItem,
  ApplicationFile,
  Confirmation,
  ApplicationStatus,
  ConfirmationType,
  FileScanStatus,
} from '../types';
import { generateUUID, generateReferenceNumber } from '../utils/helpers';

export class ApplicationModel {
  /**
   * Create a new application
   */
  static async create(
    input: ApplicationCreateInput,
    applicantId: string,
    applicantName: string,
    applicantEmail: string,
    applicantOrganisation?: string
  ): Promise<Application> {
    return transaction(async (client) => {
      // Get the next sequence number for the call
      const seqResult = await client.query<{ count: string }>(
        'SELECT COUNT(*) + 1 as count FROM applications WHERE call_id = $1',
        [input.call_id]
      );
      const sequence = parseInt(seqResult.rows[0].count, 10);

      // Get call name for reference number
      const callResult = await client.query<{ name: string }>(
        'SELECT name FROM funding_calls WHERE call_id = $1',
        [input.call_id]
      );
      const callName = callResult.rows[0]?.name || 'CALL';

      const application_id = generateUUID();
      const reference_number = generateReferenceNumber(callName, sequence);

      const result = await client.query<Application>(
        `INSERT INTO applications (
          application_id, call_id, applicant_id, reference_number,
          applicant_name, applicant_email, applicant_organisation, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          application_id,
          input.call_id,
          applicantId,
          reference_number,
          applicantName,
          applicantEmail,
          applicantOrganisation || null,
          ApplicationStatus.DRAFT,
        ]
      );

      const application = result.rows[0];
      application.files = [];
      application.confirmations = [];

      return application;
    });
  }

  /**
   * Find application by ID
   */
  static async findById(application_id: string): Promise<Application | null> {
    const result = await query<Application>(
      'SELECT * FROM applications WHERE application_id = $1',
      [application_id]
    );

    if (result.rows.length === 0) return null;

    const application = result.rows[0];
    application.files = await this.getFiles(application_id);
    application.confirmations = await this.getConfirmations(application_id);

    return application;
  }

  /**
   * Find application by reference number
   */
  static async findByReference(reference_number: string): Promise<Application | null> {
    const result = await query<Application>(
      'SELECT * FROM applications WHERE reference_number = $1',
      [reference_number]
    );

    if (result.rows.length === 0) return null;

    const application = result.rows[0];
    application.files = await this.getFiles(application.application_id);
    application.confirmations = await this.getConfirmations(application.application_id);

    return application;
  }

  /**
   * Update application
   */
  static async update(
    application_id: string,
    input: ApplicationUpdateInput
  ): Promise<Application | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.applicant_name !== undefined) {
      fields.push(`applicant_name = $${paramIndex++}`);
      values.push(input.applicant_name);
    }
    if (input.applicant_organisation !== undefined) {
      fields.push(`applicant_organisation = $${paramIndex++}`);
      values.push(input.applicant_organisation);
    }

    if (fields.length === 0) return this.findById(application_id);

    fields.push(`updated_at = NOW()`);
    values.push(application_id);

    await query(
      `UPDATE applications SET ${fields.join(', ')} WHERE application_id = $${paramIndex}`,
      values
    );

    return this.findById(application_id);
  }

  /**
   * Submit application
   */
  static async submit(application_id: string): Promise<Application | null> {
    await query(
      `UPDATE applications
       SET status = $1, submitted_at = NOW(), updated_at = NOW()
       WHERE application_id = $2`,
      [ApplicationStatus.SUBMITTED, application_id]
    );

    return this.findById(application_id);
  }

  /**
   * Withdraw application
   */
  static async withdraw(application_id: string): Promise<void> {
    await query(
      `UPDATE applications
       SET status = $1, withdrawn_at = NOW(), updated_at = NOW()
       WHERE application_id = $2`,
      [ApplicationStatus.WITHDRAWN, application_id]
    );
  }

  /**
   * Reopen application
   */
  static async reopen(application_id: string): Promise<void> {
    await query(
      `UPDATE applications
       SET status = $1, submitted_at = NULL, updated_at = NOW()
       WHERE application_id = $2`,
      [ApplicationStatus.REOPENED, application_id]
    );
  }

  /**
   * List applications for a call
   */
  static async listByCall(
    call_id: string,
    options: {
      page?: number;
      limit?: number;
      status?: ApplicationStatus;
      search?: string;
    } = {}
  ): Promise<{ applications: ApplicationListItem[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['a.call_id = $1'];
    const values: unknown[] = [call_id];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`a.status = $${paramIndex++}`);
      values.push(options.status);
    }
    if (options.search) {
      conditions.push(
        `(a.reference_number ILIKE $${paramIndex} OR a.applicant_name ILIKE $${paramIndex} OR a.applicant_email ILIKE $${paramIndex})`
      );
      values.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM applications a ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await query<ApplicationListItem>(
      `SELECT
        a.application_id, a.reference_number, a.applicant_name, a.applicant_email,
        a.applicant_organisation, a.status, a.submitted_at, a.created_at,
        COALESCE(f.file_count, 0)::int as file_count,
        COALESCE(c.confirmation_count, 0)::int as confirmation_count,
        COALESCE(asn.assignment_count, 0)::int as assignment_count,
        COALESCE(ass.completed_assessments, 0)::int as completed_assessments
       FROM applications a
       LEFT JOIN (
         SELECT application_id, COUNT(*) as file_count FROM application_files GROUP BY application_id
       ) f ON a.application_id = f.application_id
       LEFT JOIN (
         SELECT application_id, COUNT(*) as confirmation_count FROM confirmations GROUP BY application_id
       ) c ON a.application_id = c.application_id
       LEFT JOIN (
         SELECT application_id, COUNT(*) as assignment_count FROM assignments GROUP BY application_id
       ) asn ON a.application_id = asn.application_id
       LEFT JOIN (
         SELECT asn.application_id, COUNT(*) as completed_assessments
         FROM assessments ass
         JOIN assignments asn ON ass.assignment_id = asn.assignment_id
         WHERE ass.status = 'submitted'
         GROUP BY asn.application_id
       ) ass ON a.application_id = ass.application_id
       ${whereClause}
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { applications: result.rows, total };
  }

  /**
   * List applications by applicant
   */
  static async listByApplicant(
    applicant_id: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ applications: Application[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM applications WHERE applicant_id = $1',
      [applicant_id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query<Application>(
      `SELECT * FROM applications
       WHERE applicant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [applicant_id, limit, offset]
    );

    const applications = await Promise.all(
      result.rows.map(async (app) => {
        app.files = await this.getFiles(app.application_id);
        app.confirmations = await this.getConfirmations(app.application_id);
        return app;
      })
    );

    return { applications, total };
  }

  // ============================================================================
  // FILE METHODS
  // ============================================================================

  /**
   * Add file to application
   */
  static async addFile(
    application_id: string,
    filename: string,
    originalFilename: string,
    filePath: string,
    fileSize: number,
    mimeType: string
  ): Promise<ApplicationFile> {
    const file_id = generateUUID();

    const result = await query<ApplicationFile>(
      `INSERT INTO application_files (
        file_id, application_id, filename, original_filename, file_path,
        file_size, mime_type, scan_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        file_id,
        application_id,
        filename,
        originalFilename,
        filePath,
        fileSize,
        mimeType,
        FileScanStatus.PENDING,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get files for application
   */
  static async getFiles(application_id: string): Promise<ApplicationFile[]> {
    const result = await query<ApplicationFile>(
      'SELECT * FROM application_files WHERE application_id = $1 ORDER BY uploaded_at',
      [application_id]
    );
    return result.rows;
  }

  /**
   * Get file by ID
   */
  static async getFile(file_id: string): Promise<ApplicationFile | null> {
    const result = await query<ApplicationFile>(
      'SELECT * FROM application_files WHERE file_id = $1',
      [file_id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update file scan status
   */
  static async updateFileScanStatus(
    file_id: string,
    status: FileScanStatus
  ): Promise<void> {
    await query(
      'UPDATE application_files SET scan_status = $1 WHERE file_id = $2',
      [status, file_id]
    );
  }

  /**
   * Delete file
   */
  static async deleteFile(file_id: string): Promise<void> {
    await query('DELETE FROM application_files WHERE file_id = $1', [file_id]);
  }

  // ============================================================================
  // CONFIRMATION METHODS
  // ============================================================================

  /**
   * Add confirmation
   */
  static async addConfirmation(
    application_id: string,
    type: ConfirmationType,
    ipAddress: string
  ): Promise<Confirmation> {
    const confirmation_id = generateUUID();

    const result = await query<Confirmation>(
      `INSERT INTO confirmations (confirmation_id, application_id, type, ip_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (application_id, type) DO UPDATE SET confirmed_at = NOW(), ip_address = $4
       RETURNING *`,
      [confirmation_id, application_id, type, ipAddress]
    );

    return result.rows[0];
  }

  /**
   * Get confirmations for application
   */
  static async getConfirmations(application_id: string): Promise<Confirmation[]> {
    const result = await query<Confirmation>(
      'SELECT * FROM confirmations WHERE application_id = $1',
      [application_id]
    );
    return result.rows;
  }

  /**
   * Remove confirmation
   */
  static async removeConfirmation(
    application_id: string,
    type: ConfirmationType
  ): Promise<void> {
    await query(
      'DELETE FROM confirmations WHERE application_id = $1 AND type = $2',
      [application_id, type]
    );
  }

  /**
   * Check if all required confirmations are present
   */
  static async hasAllConfirmations(
    application_id: string,
    requiredTypes: ConfirmationType[]
  ): Promise<boolean> {
    if (requiredTypes.length === 0) return true;

    const result = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT type) as count FROM confirmations
       WHERE application_id = $1 AND type = ANY($2)`,
      [application_id, requiredTypes]
    );

    return parseInt(result.rows[0].count, 10) === requiredTypes.length;
  }

  /**
   * Check if application belongs to user
   */
  static async belongsToUser(application_id: string, user_id: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) FROM applications WHERE application_id = $1 AND applicant_id = $2',
      [application_id, user_id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Delete application
   */
  static async delete(application_id: string): Promise<void> {
    await transaction(async (client) => {
      await client.query('DELETE FROM confirmations WHERE application_id = $1', [
        application_id,
      ]);
      await client.query('DELETE FROM application_files WHERE application_id = $1', [
        application_id,
      ]);
      await client.query('DELETE FROM applications WHERE application_id = $1', [
        application_id,
      ]);
    });
  }
}

export default ApplicationModel;
