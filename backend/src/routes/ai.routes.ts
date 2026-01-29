// =============================================================================
// AI Routes - API Endpoints for AI Features
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthRequest, UserRole } from '../types';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { getAIService } from '../ai/ai.service';
import {
  summarizeApplication,
  generateScoringSuggestions,
  detectScoringAnomalies,
  findSimilarApplications,
  indexApplication,
  batchIndexApplications,
  getIndexStats,
} from '../ai/features';
import { ApplicationModel } from '../models/application.model';
import { FundingCallModel } from '../models/fundingCall.model';
import { ScoringService } from '../services/scoring.service';
import { logger } from '../utils/logger';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Health & Status
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/ai/status
 * Get AI service status (coordinator only)
 */
router.get(
  '/status',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAIService();
      const status = await service.getStatus();
      const usage = service.getUsageStats();

      return res.json({
        success: true,
        data: {
          ...status,
          usage,
        },
      });
    } catch (error) {
      return void next(error);
    }
  }
);

/**
 * GET /api/v1/ai/providers
 * List available AI providers
 */
router.get(
  '/providers',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAIService();
      const providers = service.listProviders();
      const activeProvider = service.getActiveProvider();

      return res.json({
        success: true,
        data: {
          providers,
          activeProvider,
        },
      });
    } catch (error) {
      return void next(error);
    }
  }
);

/**
 * POST /api/v1/ai/provider
 * Switch AI provider
 */
router.post(
  '/provider',
  requireRole(UserRole.ADMIN),
  body('provider').isIn(['openai', 'anthropic', 'ollama', 'lmstudio', 'custom']),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid provider', details: errors.array() },
        });
      }

      const service = getAIService();
      service.setProvider(req.body.provider);

      logger.info('AI provider switched', {
        provider: req.body.provider,
        userId: req.user?.user_id,
      });

      return res.json({
        success: true,
        data: { activeProvider: req.body.provider },
      });
    } catch (error) {
      return void next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Summarization
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/summarize/:applicationId
 * Generate a summary for an application
 */
router.post(
  '/summarize/:applicationId',
  requireRole(UserRole.COORDINATOR, UserRole.ASSESSOR, UserRole.ADMIN),
  param('applicationId').isUUID(),
  body('maxLength').optional().isInt({ min: 50, max: 1000 }),
  body('focusAreas').optional().isArray(),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { applicationId } = req.params;
      const { maxLength, focusAreas } = req.body;

      // Get application content
      const application = await ApplicationModel.findById(applicationId);
      if (!application) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Application not found' },
        });
      }

      // TODO: Get actual application content from files
      // For now, use a placeholder
      const content = `Application ${application.reference_number} from ${application.applicant_name}`;

      const summary = await summarizeApplication({
        applicationId,
        content,
        maxLength,
        focusAreas,
      });

      return res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Scoring Assistance
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/scoring-assist/:applicationId
 * Get AI-assisted scoring suggestions
 */
router.post(
  '/scoring-assist/:applicationId',
  requireRole(UserRole.COORDINATOR, UserRole.ASSESSOR, UserRole.ADMIN),
  param('applicationId').isUUID(),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { applicationId } = req.params;

      // Get application and call details
      const application = await ApplicationModel.findById(applicationId);
      if (!application) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Application not found' },
        });
      }

      const call = await FundingCallModel.findById(application.call_id);
      if (!call) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Funding call not found' },
        });
      }

      // TODO: Get actual application content from files
      const content = `Application ${application.reference_number} from ${application.applicant_name}`;

      const suggestions = await generateScoringSuggestions({
        applicationId,
        applicationContent: content,
        criteria: call.criteria.map((c) => ({
          criterionId: c.criterion_id,
          name: c.name,
          description: c.description,
          maxPoints: c.max_points,
          weight: c.weight,
        })),
      });

      return res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Anomaly Detection
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/anomalies/:callId
 * Detect scoring anomalies for a funding call
 */
router.post(
  '/anomalies/:callId',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  param('callId').isUUID(),
  body('threshold').optional().isFloat({ min: 5, max: 50 }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { callId } = req.params;
      const { threshold } = req.body;

      // Get master results
      const results = await ScoringService.getMasterResults(callId);

      // Transform to anomaly detection format
      const applicationScores = results.results.map((r) => ({
        applicationId: r.application_id,
        assessorScores: r.assessor_scores.map((a) => ({
          assessorId: a.assessor_id,
          criterionScores: a.scores.map((s) => ({
            criterionId: s.criterion_id,
            score: s.score,
          })),
          overallScore: a.overall_score,
        })),
      }));

      const anomalies = await detectScoringAnomalies({
        callId,
        applicationScores,
        threshold,
      });

      return res.json({
        success: true,
        data: anomalies,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Similarity Search
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/similar/:applicationId
 * Find similar applications
 */
router.post(
  '/similar/:applicationId',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  param('applicationId').isUUID(),
  body('topK').optional().isInt({ min: 1, max: 20 }),
  body('minSimilarity').optional().isFloat({ min: 0, max: 1 }),
  body('callId').optional().isUUID(),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { applicationId } = req.params;
      const { topK, minSimilarity, callId } = req.body;

      const results = await findSimilarApplications({
        applicationId,
        topK,
        minSimilarity,
        callId,
      });

      return res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

/**
 * POST /api/v1/ai/index/:callId
 * Index all applications for a funding call
 */
router.post(
  '/index/:callId',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  param('callId').isUUID(),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { callId } = req.params;

      const call = await FundingCallModel.findById(callId);
      if (!call) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Funding call not found' },
        });
      }

      // Get all applications
      const { applications } = await ApplicationModel.listByCall(callId, {
        status: 'submitted' as any,
        limit: 10000,
      });

      // Prepare for indexing
      const toIndex = applications.map((app) => ({
        applicationId: app.application_id,
        referenceNumber: app.reference_number,
        applicantName: app.applicant_name,
        callId,
        callName: call.name,
        // TODO: Get actual content from files
        content: `${app.applicant_name} - ${app.reference_number}`,
      }));

      const result = await batchIndexApplications(toIndex);

      logger.info('Applications indexed for similarity search', {
        callId,
        indexed: result.indexed,
        failed: result.failed,
        userId: req.user?.user_id,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

/**
 * GET /api/v1/ai/index/stats
 * Get similarity index statistics
 */
router.get(
  '/index/stats',
  requireRole(UserRole.COORDINATOR, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = getIndexStats();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return void next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Simple Text Generation
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/generate
 * Generate text using AI (admin only)
 */
router.post(
  '/generate',
  requireRole(UserRole.ADMIN),
  body('prompt').isString().isLength({ min: 1, max: 10000 }),
  body('systemPrompt').optional().isString().isLength({ max: 2000 }),
  body('maxTokens').optional().isInt({ min: 10, max: 4000 }),
  body('temperature').optional().isFloat({ min: 0, max: 2 }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
        });
      }

      const { prompt, systemPrompt, maxTokens, temperature } = req.body;

      const service = getAIService();
      const result = await service.generateText(prompt, {
        systemPrompt,
        maxTokens,
        temperature,
        useCache: false,
      });

      return res.json({
        success: true,
        data: { text: result },
      });
    } catch (error) {
      return void next(error);
    }
  }
);

export { router as aiRouter };
export default router;
