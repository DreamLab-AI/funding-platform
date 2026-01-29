import { Router } from 'express';
import { assessmentsController } from '../controllers/assessments.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';
import { UserRole } from '../types';

const router = Router();

// Validation schemas
const scoreSchema = z.object({
  scores: z.array(z.object({
    criterionId: z.string().uuid(),
    score: z.number().min(0),
    comment: z.string().max(5000).optional(),
  })),
  overallComment: z.string().max(10000).optional(),
  coiConfirmed: z.boolean(),
});

// Protected routes
router.use(authenticate);

// Assessor routes
router.get('/my', requireRoles(UserRole.ASSESSOR), assessmentsController.getMyAssessments);
router.get('/assignment/:assignmentId', requireRoles(UserRole.ASSESSOR), assessmentsController.getByAssignment);
router.post('/assignment/:assignmentId', requireRoles(UserRole.ASSESSOR), validate(scoreSchema), assessmentsController.submitAssessment);
router.put('/assignment/:assignmentId', requireRoles(UserRole.ASSESSOR), validate(scoreSchema), assessmentsController.updateDraft);
router.post('/assignment/:assignmentId/submit', requireRoles(UserRole.ASSESSOR), assessmentsController.finalSubmit);

// Coordinator routes
router.get('/', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assessmentsController.list);
router.get('/call/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assessmentsController.listByCall);
router.get('/application/:applicationId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assessmentsController.listByApplication);
router.post('/:id/return', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assessmentsController.returnForRevision);

export default router;
