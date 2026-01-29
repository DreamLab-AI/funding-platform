import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { scoringService } from '../services/scoring.service';
import { exportService } from '../services/export.service';

export const resultsController = {
  async getMasterResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;

      const result = await pool.query(
        `SELECT
           a.id,
           a.reference_number,
           a.status,
           a.submitted_at,
           COUNT(DISTINCT ass.id) as assessor_count,
           AVG(asmt.total_score) as average_score,
           STDDEV(asmt.total_score) as score_stddev,
           MIN(asmt.total_score) as min_score,
           MAX(asmt.total_score) as max_score,
           jsonb_agg(DISTINCT jsonb_build_object(
             'assessor_id', ass.assessor_id,
             'total_score', asmt.total_score,
             'submitted_at', asmt.submitted_at
           )) FILTER (WHERE asmt.id IS NOT NULL) as assessments
         FROM applications a
         LEFT JOIN assignments ass ON a.id = ass.application_id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id AND asmt.status = 'submitted'
         WHERE a.call_id = $1 AND a.status = 'submitted'
         GROUP BY a.id
         ORDER BY average_score DESC NULLS LAST`,
        [callId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;

      const result = await pool.query(
        `SELECT
           COUNT(DISTINCT a.id) as total_applications,
           COUNT(DISTINCT CASE WHEN a.status = 'submitted' THEN a.id END) as submitted,
           COUNT(DISTINCT ass.id) as total_assignments,
           COUNT(DISTINCT CASE WHEN asmt.status = 'submitted' THEN asmt.id END) as completed_assessments,
           AVG(asmt.total_score) as overall_average,
           STDDEV(asmt.total_score) as overall_stddev
         FROM applications a
         LEFT JOIN assignments ass ON a.id = ass.application_id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id
         WHERE a.call_id = $1`,
        [callId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async getVarianceFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const varianceThreshold = 2; // Standard deviations

      const result = await pool.query(
        `WITH app_scores AS (
           SELECT
             a.id,
             a.reference_number,
             AVG(asmt.total_score) as avg_score,
             STDDEV(asmt.total_score) as score_stddev,
             COUNT(asmt.id) as assessment_count,
             array_agg(asmt.total_score) as scores
           FROM applications a
           JOIN assignments ass ON a.id = ass.application_id
           JOIN assessments asmt ON ass.id = asmt.assignment_id
           WHERE a.call_id = $1 AND asmt.status = 'submitted'
           GROUP BY a.id
           HAVING COUNT(asmt.id) > 1
         )
         SELECT *,
           CASE WHEN score_stddev > $2 THEN true ELSE false END as flagged
         FROM app_scores
         WHERE score_stddev > $2
         ORDER BY score_stddev DESC`,
        [callId, varianceThreshold]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async getRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;

      const result = await pool.query(
        `SELECT
           a.id,
           a.reference_number,
           AVG(asmt.total_score) as average_score,
           COUNT(asmt.id) as assessment_count,
           RANK() OVER (ORDER BY AVG(asmt.total_score) DESC) as rank
         FROM applications a
         JOIN assignments ass ON a.id = ass.application_id
         JOIN assessments asmt ON ass.id = asmt.assignment_id
         WHERE a.call_id = $1 AND asmt.status = 'submitted'
         GROUP BY a.id
         HAVING COUNT(asmt.id) > 0
         ORDER BY rank`,
        [callId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  },

  async exportResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const { format = 'csv' } = req.query;

      const results = await pool.query(
        `SELECT
           a.reference_number,
           a.status,
           AVG(asmt.total_score) as average_score,
           COUNT(asmt.id) as assessment_count,
           RANK() OVER (ORDER BY AVG(asmt.total_score) DESC) as rank
         FROM applications a
         LEFT JOIN assignments ass ON a.id = ass.application_id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id AND asmt.status = 'submitted'
         WHERE a.call_id = $1
         GROUP BY a.id
         ORDER BY average_score DESC NULLS LAST`,
        [callId]
      );

      if (format === 'csv') {
        const csv = exportService.toCSV(results.rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="results-${callId}.csv"`);
        res.send(csv);
      } else {
        res.json({ success: true, data: results.rows });
      }
    } catch (error) {
      next(error);
    }
  },

  async exportDetailedResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;

      const results = await pool.query(
        `SELECT
           a.reference_number,
           a.content,
           ass.assessor_id,
           u.email as assessor_email,
           asmt.scores,
           asmt.overall_comment,
           asmt.total_score,
           asmt.submitted_at
         FROM applications a
         JOIN assignments ass ON a.id = ass.application_id
         JOIN assessments asmt ON ass.id = asmt.assignment_id
         JOIN users u ON ass.assessor_id = u.id
         WHERE a.call_id = $1 AND asmt.status = 'submitted'
         ORDER BY a.reference_number, ass.assessor_id`,
        [callId]
      );

      const csv = exportService.toDetailedCSV(results.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="detailed-results-${callId}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async getApplicationResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;

      const result = await pool.query(
        `SELECT
           a.reference_number,
           a.status,
           ass.assessor_id,
           u.email as assessor_email,
           asmt.scores,
           asmt.overall_comment,
           asmt.total_score,
           asmt.submitted_at
         FROM applications a
         LEFT JOIN assignments ass ON a.id = ass.application_id
         LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id
         LEFT JOIN users u ON ass.assessor_id = u.id
         WHERE a.id = $1
         ORDER BY asmt.submitted_at`,
        [applicationId]
      );

      if (result.rows.length === 0) {
        throw new AppError('Application not found', 404);
      }

      // Calculate aggregate scores
      const scores = result.rows.filter(r => r.total_score !== null);
      const aggregate = {
        application: result.rows[0].reference_number,
        assessmentCount: scores.length,
        averageScore: scores.length > 0
          ? scores.reduce((sum, r) => sum + parseFloat(r.total_score), 0) / scores.length
          : null,
        assessments: result.rows.filter(r => r.assessor_id !== null)
      };

      res.json({ success: true, data: aggregate });
    } catch (error) {
      next(error);
    }
  },

  async getScoreBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;

      // Get criteria config
      const callResult = await pool.query(
        `SELECT c.criteria_config
         FROM applications a
         JOIN funding_calls c ON a.call_id = c.id
         WHERE a.id = $1`,
        [applicationId]
      );

      if (callResult.rows.length === 0) {
        throw new AppError('Application not found', 404);
      }

      const criteria = callResult.rows[0].criteria_config || [];

      // Get all assessments for this application
      const assessments = await pool.query(
        `SELECT asmt.scores
         FROM assessments asmt
         JOIN assignments ass ON asmt.assignment_id = ass.id
         WHERE ass.application_id = $1 AND asmt.status = 'submitted'`,
        [applicationId]
      );

      // Calculate breakdown by criterion
      const breakdown = scoringService.calculateBreakdown(criteria, assessments.rows);

      res.json({ success: true, data: breakdown });
    } catch (error) {
      next(error);
    }
  },

  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;

      const [scoreStats, assessorStats, timeStats] = await Promise.all([
        // Score statistics
        pool.query(
          `SELECT
             AVG(total_score) as mean,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_score) as median,
             STDDEV(total_score) as stddev,
             MIN(total_score) as min,
             MAX(total_score) as max
           FROM assessments asmt
           JOIN assignments ass ON asmt.assignment_id = ass.id
           JOIN applications a ON ass.application_id = a.id
           WHERE a.call_id = $1 AND asmt.status = 'submitted'`,
          [callId]
        ),
        // Assessor statistics
        pool.query(
          `SELECT
             ass.assessor_id,
             u.email,
             COUNT(asmt.id) as completed,
             AVG(asmt.total_score) as avg_score,
             AVG(EXTRACT(EPOCH FROM (asmt.submitted_at - ass.created_at))/3600) as avg_hours
           FROM assignments ass
           JOIN users u ON ass.assessor_id = u.id
           LEFT JOIN assessments asmt ON ass.id = asmt.assignment_id
           JOIN applications a ON ass.application_id = a.id
           WHERE a.call_id = $1
           GROUP BY ass.assessor_id, u.email`,
          [callId]
        ),
        // Time statistics
        pool.query(
          `SELECT
             DATE_TRUNC('day', asmt.submitted_at) as date,
             COUNT(*) as count
           FROM assessments asmt
           JOIN assignments ass ON asmt.assignment_id = ass.id
           JOIN applications a ON ass.application_id = a.id
           WHERE a.call_id = $1 AND asmt.status = 'submitted'
           GROUP BY DATE_TRUNC('day', asmt.submitted_at)
           ORDER BY date`,
          [callId]
        )
      ]);

      res.json({
        success: true,
        data: {
          scores: scoreStats.rows[0],
          assessors: assessorStats.rows,
          timeline: timeStats.rows
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getScoreDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const { callId } = req.params;
      const { buckets = 10 } = req.query;

      const result = await pool.query(
        `WITH score_range AS (
           SELECT MIN(total_score) as min_score, MAX(total_score) as max_score
           FROM assessments asmt
           JOIN assignments ass ON asmt.assignment_id = ass.id
           JOIN applications a ON ass.application_id = a.id
           WHERE a.call_id = $1 AND asmt.status = 'submitted'
         ),
         bucketed AS (
           SELECT
             WIDTH_BUCKET(total_score, min_score, max_score + 0.01, $2) as bucket,
             COUNT(*) as count
           FROM assessments asmt
           JOIN assignments ass ON asmt.assignment_id = ass.id
           JOIN applications a ON ass.application_id = a.id
           CROSS JOIN score_range
           WHERE a.call_id = $1 AND asmt.status = 'submitted'
           GROUP BY bucket
         )
         SELECT
           bucket,
           count,
           (SELECT min_score + (bucket - 1) * (max_score - min_score) / $2 FROM score_range) as range_start,
           (SELECT min_score + bucket * (max_score - min_score) / $2 FROM score_range) as range_end
         FROM bucketed
         ORDER BY bucket`,
        [callId, Number(buckets)]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
};
