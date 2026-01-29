import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { v4 as uuidv4 } from 'uuid';

export const assignmentsController = {
  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId, assessorId, dueAt } = req.body;

      // Check for conflicts of interest
      const coiCheck = await pool.query(
        `SELECT 1 FROM coi_declarations
         WHERE assessor_id = $1 AND application_id = $2`,
        [assessorId, applicationId]
      );

      if (coiCheck.rows.length > 0) {
        throw new AppError('Assessor has declared conflict of interest', 400);
      }

      const result = await pool.query(
        `INSERT INTO assignments (id, application_id, assessor_id, due_at, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [uuidv4(), applicationId, assessorId, dueAt]
      );

      // Send notification email
      const assessor = await pool.query('SELECT email FROM users WHERE id = $1', [assessorId]);
      if (assessor.rows[0]) {
        await emailService.sendAssignmentNotification(assessor.rows[0].email, result.rows[0]);
      }

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async bulkAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationIds, assessorIds, strategy = 'round-robin', assessorsPerApplication = 2, dueAt } = req.body;

      const assignments: any[] = [];

      if (strategy === 'round-robin') {
        let assessorIndex = 0;
        for (const appId of applicationIds) {
          for (let i = 0; i < assessorsPerApplication; i++) {
            const assessorId = assessorIds[assessorIndex % assessorIds.length];

            // Check COI
            const coiCheck = await pool.query(
              'SELECT 1 FROM coi_declarations WHERE assessor_id = $1 AND application_id = $2',
              [assessorId, appId]
            );

            if (coiCheck.rows.length === 0) {
              const result = await pool.query(
                `INSERT INTO assignments (id, application_id, assessor_id, due_at, status)
                 VALUES ($1, $2, $3, $4, 'pending')
                 ON CONFLICT (application_id, assessor_id) DO NOTHING
                 RETURNING *`,
                [uuidv4(), appId, assessorId, dueAt]
              );
              if (result.rows[0]) {
                assignments.push(result.rows[0]);
              }
            }
            assessorIndex++;
          }
        }
      } else if (strategy === 'balanced') {
        // Get current assignment counts
        const counts = await pool.query(
          `SELECT assessor_id, COUNT(*) as count
           FROM assignments WHERE status != 'completed'
           GROUP BY assessor_id`
        );
        const countMap = new Map(counts.rows.map(r => [r.assessor_id, parseInt(r.count)]));

        for (const appId of applicationIds) {
          // Sort assessors by workload
          const sortedAssessors = [...assessorIds].sort((a, b) =>
            (countMap.get(a) || 0) - (countMap.get(b) || 0)
          );

          for (let i = 0; i < assessorsPerApplication && i < sortedAssessors.length; i++) {
            const assessorId = sortedAssessors[i];
            const result = await pool.query(
              `INSERT INTO assignments (id, application_id, assessor_id, due_at, status)
               VALUES ($1, $2, $3, $4, 'pending')
               ON CONFLICT (application_id, assessor_id) DO NOTHING
               RETURNING *`,
              [uuidv4(), appId, assessorId, dueAt]
            );
            if (result.rows[0]) {
              assignments.push(result.rows[0]);
              countMap.set(assessorId, (countMap.get(assessorId) || 0) + 1);
            }
          }
        }
      } else {
        // Random assignment
        for (const appId of applicationIds) {
          const shuffled = [...assessorIds].sort(() => Math.random() - 0.5);
          for (let i = 0; i < assessorsPerApplication && i < shuffled.length; i++) {
            const result = await pool.query(
              `INSERT INTO assignments (id, application_id, assessor_id, due_at, status)
               VALUES ($1, $2, $3, $4, 'pending')
               ON CONFLICT (application_id, assessor_id) DO NOTHING
               RETURNING *`,
              [uuidv4(), appId, shuffled[i], dueAt]
            );
            if (result.rows[0]) {
              assignments.push(result.rows[0]);
            }
          }
        }
      }

      res.status(201).json({ success: true, data: assignments, count: assignments.length });
    } catch (error) {
      next(error);
    }
  },

  async listByCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT ass.*, a.reference_number, u.email as assessor_email
         FROM assignments ass
         JOIN applications a ON ass.application_id = a.id
         JOIN users u ON ass.assessor_id = u.id
         WHERE a.call_id = $1
         ORDER BY ass.created_at DESC`,
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
        `SELECT ass.*, u.email as assessor_email,
                asmt.status as assessment_status
         FROM assignments ass
         JOIN users u ON ass.assessor_id = u.id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id
         WHERE ass.application_id = $1`,
        [applicationId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async listByAssessor(req: Request, res: Response, next: NextFunction) {
    try {
      const { assessorId } = req.params;
      const result = await pool.query(
        `SELECT ass.*, a.reference_number, c.name as call_name
         FROM assignments ass
         JOIN applications a ON ass.application_id = a.id
         JOIN funding_calls c ON a.call_id = c.id
         WHERE ass.assessor_id = $1
         ORDER BY ass.due_at ASC NULLS LAST`,
        [assessorId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async unassign(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Check if assessment exists
      const assessmentCheck = await pool.query(
        'SELECT 1 FROM assessments WHERE assignment_id = $1',
        [id]
      );

      if (assessmentCheck.rows.length > 0) {
        throw new AppError('Cannot unassign - assessment already started', 400);
      }

      const result = await pool.query(
        'DELETE FROM assignments WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Assignment not found', 404);
      }

      res.json({ success: true, message: 'Assignment removed' });
    } catch (error) {
      next(error);
    }
  },

  async getProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT
           COUNT(*) as total_assignments,
           COUNT(CASE WHEN ass.status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN ass.status = 'pending' THEN 1 END) as pending,
           COUNT(CASE WHEN ass.status = 'in_progress' THEN 1 END) as in_progress,
           COUNT(CASE WHEN ass.due_at < NOW() AND ass.status != 'completed' THEN 1 END) as overdue
         FROM assignments ass
         JOIN applications a ON ass.application_id = a.id
         WHERE a.call_id = $1`,
        [callId]
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async getProgressByAssessor(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT
           u.id as assessor_id,
           u.email,
           COUNT(*) as total_assignments,
           COUNT(CASE WHEN ass.status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN ass.due_at < NOW() AND ass.status != 'completed' THEN 1 END) as overdue
         FROM assignments ass
         JOIN applications a ON ass.application_id = a.id
         JOIN users u ON ass.assessor_id = u.id
         WHERE a.call_id = $1
         GROUP BY u.id, u.email
         ORDER BY completed DESC`,
        [callId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async sendReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const assignment = await pool.query(
        `SELECT ass.*, u.email, a.reference_number
         FROM assignments ass
         JOIN users u ON ass.assessor_id = u.id
         JOIN applications a ON ass.application_id = a.id
         WHERE ass.id = $1`,
        [id]
      );

      if (assignment.rows.length === 0) {
        throw new AppError('Assignment not found', 404);
      }

      await emailService.sendReminderEmail(
        assignment.rows[0].email,
        {
          assessor_name: assignment.rows[0].first_name || 'Assessor',
          call_name: assignment.rows[0].reference_number,
          outstanding_count: 1,
          due_at: assignment.rows[0].due_at,
          login_url: `${process.env.FRONTEND_URL}/login`,
        }
      );

      // Update reminder sent timestamp
      await pool.query(
        'UPDATE assignments SET reminder_sent_at = NOW() WHERE id = $1',
        [id]
      );

      res.json({ success: true, message: 'Reminder sent' });
    } catch (error) {
      next(error);
    }
  },

  async sendBulkReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentIds } = req.body;

      const assignments = await pool.query(
        `SELECT ass.id, u.email, a.reference_number, ass.due_at
         FROM assignments ass
         JOIN users u ON ass.assessor_id = u.id
         JOIN applications a ON ass.application_id = a.id
         WHERE ass.id = ANY($1) AND ass.status != 'completed'`,
        [assignmentIds]
      );

      let sent = 0;
      for (const assignment of assignments.rows) {
        await emailService.sendReminderEmail(
          assignment.email,
          {
            assessor_name: assignment.first_name || 'Assessor',
            call_name: assignment.reference_number,
            outstanding_count: 1,
            due_at: assignment.due_at,
            login_url: `${process.env.FRONTEND_URL}/login`,
          }
        );
        await pool.query(
          'UPDATE assignments SET reminder_sent_at = NOW() WHERE id = $1',
          [assignment.id]
        );
        sent++;
      }

      res.json({ success: true, message: `${sent} reminders sent` });
    } catch (error) {
      next(error);
    }
  }
};
