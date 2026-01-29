import { Router } from 'express';
import { assessmentsController } from '../controllers/assessments.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const scoreSchema = z.object({
  body: z.object({
    scores: z.array(z.object({
      criterionId: z.string().uuid(),
      score: z.number().min(0),
      comment: z.string().max(5000).optional(),
    })),
    overallComment: z.string().max(10000).optional(),
    coiConfirmed: z.boolean(),
  }),
});

// Protected routes
router.use(authMiddleware);

// Assessor routes
router.get('/my', rbacMiddleware(['assessor']), assessmentsController.getMyAssessments);
router.get('/assignment/:assignmentId', rbacMiddleware(['assessor']), assessmentsController.getByAssignment);
router.post('/assignment/:assignmentId', rbacMiddleware(['assessor']), validateRequest(scoreSchema), assessmentsController.submitAssessment);
router.put('/assignment/:assignmentId', rbacMiddleware(['assessor']), validateRequest(scoreSchema), assessmentsController.updateDraft);
router.post('/assignment/:assignmentId/submit', rbacMiddleware(['assessor']), assessmentsController.finalSubmit);

// Coordinator routes
router.get('/', rbacMiddleware(['coordinator', 'admin']), assessmentsController.list);
router.get('/call/:callId', rbacMiddleware(['coordinator', 'admin']), assessmentsController.listByCall);
router.get('/application/:applicationId', rbacMiddleware(['coordinator', 'admin']), assessmentsController.listByApplication);
router.post('/:id/return', rbacMiddleware(['coordinator', 'admin']), assessmentsController.returnForRevision);

export default router;
