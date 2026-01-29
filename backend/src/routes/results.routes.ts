import { Router } from 'express';
import { resultsController } from '../controllers/results.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { UserRole } from '../types';

const router = Router();

// All routes require authentication and coordinator role
router.use(authenticate);
router.use(requireRoles(UserRole.COORDINATOR, UserRole.ADMIN));

// Master results
router.get('/call/:callId', resultsController.getMasterResults);
router.get('/call/:callId/summary', resultsController.getSummary);
router.get('/call/:callId/variance', resultsController.getVarianceFlags);
router.get('/call/:callId/ranking', resultsController.getRanking);

// Export
router.get('/call/:callId/export', resultsController.exportResults);
router.get('/call/:callId/export/detailed', resultsController.exportDetailedResults);

// Individual application results
router.get('/application/:applicationId', resultsController.getApplicationResults);
router.get('/application/:applicationId/breakdown', resultsController.getScoreBreakdown);

// Analytics
router.get('/call/:callId/analytics', resultsController.getAnalytics);
router.get('/call/:callId/distribution', resultsController.getScoreDistribution);

export default router;
