import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { scoringService } from '../services/scoring.service';
import { v4 as uuidv4 } from 'uuid';

export const assessmentsController = {
  async getMyAssessments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await pool.query(
        `SELECT ass.*, a.reference_number, c.name as call_name,
                asmt.id as assessment_id, asmt.status as assessment_status
         FROM assignments ass
         JOIN applications a ON ass.application_id = a.id
         JOIN funding_calls c ON a.call_id = c.id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id
         WHERE ass.assessor_id = $1
         ORDER BY ass.due_at ASC NULLS LAST`,
        [userId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async getByAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const userId = req.user!.id;

      const result = await pool.query(
        `SELECT asmt.*, ass.application_id, ass.due_at,
                a.content as application_content, c.criteria_config
         FROM assessments asmt
         RIGHT JOIN assignments ass ON asmt.assignment_id = ass.id
         JOIN applications a ON ass.application_id = a.id
         JOIN funding_calls c ON a.call_id = c.id
         WHERE ass.id = $1 AND ass.assessor_id = $2`,
        [assignmentId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Assignment not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async submitAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const { scores, overallComment, coiConfirmed } = req.body;
      const userId = req.user!.id;

      // Verify assignment belongs to user
      const assignmentCheck = await pool.query(
        'SELECT id FROM assignments WHERE id = $1 AND assessor_id = $2',
        [assignmentId, userId]
      );

      if (assignmentCheck.rows.length === 0) {
        throw new AppError('Assignment not found', 404);
      }

      // Calculate total score (simple sum)
      const totalScore = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0);

      const result = await pool.query(
        `INSERT INTO assessments (id, assignment_id, scores, overall_comment, coi_confirmed, total_score, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft')
         ON CONFLICT (assignment_id) DO UPDATE SET
           scores = $3, overall_comment = $4, coi_confirmed = $5,
           total_score = $6, updated_at = NOW()
         RETURNING *`,
        [uuidv4(), assignmentId, JSON.stringify(scores), overallComment, coiConfirmed, totalScore]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async updateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const { scores, overallComment, coiConfirmed } = req.body;
      const userId = req.user!.id;

      // Calculate total score (simple sum)
      const totalScore = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0);

      const result = await pool.query(
        `UPDATE assessments
         SET scores = $1, overall_comment = $2, coi_confirmed = $3,
             total_score = $4, updated_at = NOW()
         WHERE assignment_id = $5 AND status = 'draft'
         AND EXISTS (SELECT 1 FROM assignments WHERE id = $5 AND assessor_id = $6)
         RETURNING *`,
        [JSON.stringify(scores), overallComment, coiConfirmed, totalScore, assignmentId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Assessment not found or not editable', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async finalSubmit(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const userId = req.user!.id;

      const result = await pool.query(
        `UPDATE assessments
         SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
         WHERE assignment_id = $1 AND status = 'draft'
         AND EXISTS (SELECT 1 FROM assignments WHERE id = $1 AND assessor_id = $2)
         RETURNING *`,
        [assignmentId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Assessment not found or already submitted', 400);
      }

      // Update assignment status
      await pool.query(
        'UPDATE assignments SET status = $1 WHERE id = $2',
        ['completed', assignmentId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT asmt.*, ass.assessor_id, a.reference_number,
               u.email as assessor_email
        FROM assessments asmt
        JOIN assignments ass ON asmt.assignment_id = ass.id
        JOIN applications a ON ass.application_id = a.id
        JOIN users u ON ass.assessor_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        params.push(status);
        query += ` AND asmt.status = $${params.length}`;
      }

      query += ` ORDER BY asmt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async listByCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT asmt.*, ass.assessor_id, a.reference_number,
                u.email as assessor_email
         FROM assessments asmt
         JOIN assignments ass ON asmt.assignment_id = ass.id
         JOIN applications a ON ass.application_id = a.id
         JOIN users u ON ass.assessor_id = u.id
         WHERE a.call_id = $1
         ORDER BY asmt.submitted_at DESC NULLS LAST`,
        [callId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async listByApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      const result = await pool.query(
        `SELECT asmt.*, u.email as assessor_email
         FROM assessments asmt
         JOIN assignments ass ON asmt.assignment_id = ass.id
         JOIN users u ON ass.assessor_id = u.id
         WHERE ass.application_id = $1
         ORDER BY asmt.submitted_at DESC NULLS LAST`,
        [applicationId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async returnForRevision(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(
        `UPDATE assessments
         SET status = 'revision_required', revision_reason = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'submitted'
         RETURNING *`,
        [reason, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Assessment not found or cannot be returned', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
};
