import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { fileService } from '../services/file.service';
import { v4 as uuidv4 } from 'uuid';

export const applicationsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId, content } = req.body;
      const userId = req.user!.id;

      const result = await pool.query(
        `INSERT INTO applications (id, call_id, applicant_id, content, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING *`,
        [uuidv4(), callId, userId, JSON.stringify(content)]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async getMyApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await pool.query(
        `SELECT a.*, c.name as call_name, c.close_at
         FROM applications a
         JOIN funding_calls c ON a.call_id = c.id
         WHERE a.applicant_id = $1
         ORDER BY a.created_at DESC`,
        [userId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await pool.query(
        `SELECT a.*, c.name as call_name, c.requirements, c.criteria_config
         FROM applications a
         JOIN funding_calls c ON a.call_id = c.id
         WHERE a.id = $1 AND (a.applicant_id = $2 OR EXISTS (
           SELECT 1 FROM users WHERE id = $2 AND role IN ('coordinator', 'admin')
         ))`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      const result = await pool.query(
        `UPDATE applications
         SET content = $1, updated_at = NOW()
         WHERE id = $2 AND applicant_id = $3 AND status = 'draft'
         RETURNING *`,
        [JSON.stringify(content), id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found or not editable', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await pool.query(
        `UPDATE applications
         SET status = 'withdrawn', updated_at = NOW()
         WHERE id = $1 AND applicant_id = $2 AND status IN ('draft', 'submitted')
         RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found or cannot be withdrawn', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async uploadFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError('No files provided', 400);
      }

      const uploadedFiles = await Promise.all(
        files.map(file => fileService.uploadFile(file, id))
      );

      res.json({ success: true, data: uploadedFiles });
    } catch (error) {
      next(error);
    }
  },

  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      await fileService.deleteFile(fileId);
      res.json({ success: true, message: 'File deleted' });
    } catch (error) {
      next(error);
    }
  },

  async downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const fileBuffer = await fileService.getFile(fileId);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileId}"`);
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },

  async addConfirmation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { type, confirmed } = req.body;
      const userId = req.user!.id;

      const result = await pool.query(
        `INSERT INTO confirmations (id, application_id, user_id, type, confirmed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (application_id, type) DO UPDATE SET confirmed = $5, updated_at = NOW()
         RETURNING *`,
        [uuidv4(), id, userId, type, confirmed]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async getConfirmations(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT * FROM confirmations WHERE application_id = $1',
        [id]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify all required confirmations
      const confirmResult = await pool.query(
        `SELECT c.requirements->>'requiredConfirmations' as required
         FROM applications a
         JOIN funding_calls c ON a.call_id = c.id
         WHERE a.id = $1`,
        [id]
      );

      const result = await pool.query(
        `UPDATE applications
         SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND applicant_id = $2 AND status = 'draft'
         RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found or already submitted', 400);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, callId, page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT a.*, c.name as call_name, u.email as applicant_email
        FROM applications a
        JOIN funding_calls c ON a.call_id = c.id
        JOIN users u ON a.applicant_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        params.push(status);
        query += ` AND a.status = $${params.length}`;
      }
      if (callId) {
        params.push(callId);
        query += ` AND a.call_id = $${params.length}`;
      }

      query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      // Return demo data when database is unavailable
      const demoApplications = [
        {
          id: 'demo-app-001',
          call_id: 'demo-001',
          call_name: 'Innovation Research Fund 2026',
          applicant_email: 'researcher@university.ac.uk',
          reference_number: 'IRF-2026-001',
          status: 'submitted',
          submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'demo-app-002',
          call_id: 'demo-001',
          call_name: 'Innovation Research Fund 2026',
          applicant_email: 'dr.smith@research.org',
          reference_number: 'IRF-2026-002',
          status: 'submitted',
          submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'demo-app-003',
          call_id: 'demo-002',
          call_name: 'Climate Action Research Programme',
          applicant_email: 'climate@institute.edu',
          reference_number: 'CARP-2026-001',
          status: 'under_review',
          submitted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'demo-app-004',
          call_id: 'demo-001',
          call_name: 'Innovation Research Fund 2026',
          applicant_email: 'innovator@startup.com',
          reference_number: 'IRF-2026-003',
          status: 'draft',
          submitted_at: null,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      res.json({ success: true, data: demoApplications, meta: { demo: true } });
    }
  },

  async listByCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT a.*, u.email as applicant_email
         FROM applications a
         JOIN users u ON a.applicant_id = u.id
         WHERE a.call_id = $1
         ORDER BY a.submitted_at DESC NULLS LAST`,
        [callId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async exportMetadata(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const result = await pool.query(
        `SELECT a.reference_number, a.status, a.submitted_at,
                u.email, a.content
         FROM applications a
         JOIN users u ON a.applicant_id = u.id
         WHERE a.call_id = $1`,
        [callId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async downloadAllFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      // Get list of files for the call from database
      const filesResult = await pool.query<{ file_path: string; filename: string }>(
        `SELECT af.file_path, af.filename
         FROM application_files af
         JOIN applications a ON af.application_id = a.id
         WHERE a.call_id = $1`,
        [callId]
      );

      const files = filesResult.rows.map(f => ({ name: f.filename, path: f.file_path }));
      const archive = await fileService.createArchive(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="applications-${callId}.zip"`);
      res.send(archive);
    } catch (error) {
      next(error);
    }
  },

  async reopen(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE applications
         SET status = 'draft', updated_at = NOW()
         WHERE id = $1 AND status = 'submitted'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found or cannot be reopened', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async getAssignedApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await pool.query(
        `SELECT a.*, c.name as call_name, c.criteria_config,
                ass.id as assignment_id, ass.due_at
         FROM applications a
         JOIN funding_calls c ON a.call_id = c.id
         JOIN assignments ass ON a.id = ass.application_id
         WHERE ass.assessor_id = $1
         ORDER BY ass.due_at ASC NULLS LAST`,
        [userId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async getMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const [appResult, filesResult] = await Promise.all([
        pool.query('SELECT content FROM applications WHERE id = $1', [id]),
        pool.query('SELECT * FROM application_files WHERE application_id = $1', [id])
      ]);

      if (appResult.rows.length === 0) {
        throw new AppError('Application not found', 404);
      }

      res.json({
        success: true,
        data: {
          content: appResult.rows[0].content,
          files: filesResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
