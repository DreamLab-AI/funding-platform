import { Router } from 'express';
import { callsController } from '../controllers/calls.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCallSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(200),
    description: z.string().max(5000).optional(),
    open_at: z.string().datetime(),
    close_at: z.string().datetime(),
    requirements: z.object({
      allowedFileTypes: z.array(z.string()).optional(),
      maxFileSize: z.number().optional(),
      maxFiles: z.number().optional(),
      requiredConfirmations: z.array(z.string()).optional(),
      guidanceUrl: z.string().url().optional(),
      ediFormUrl: z.string().url().optional(),
    }).optional(),
    criteria_config: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      maxPoints: z.number().min(1).max(100),
      weight: z.number().min(0).max(10).optional(),
      commentsRequired: z.boolean().optional(),
    })).optional(),
  }),
});

// Public routes - list open calls
router.get('/open', callsController.listOpenCalls);
router.get('/:id/public', callsController.getPublicCallDetails);

// Protected routes
router.use(authMiddleware);

// Coordinator-only routes
router.post('/', rbacMiddleware(['coordinator', 'admin']), validateRequest(createCallSchema), callsController.create);
router.get('/', rbacMiddleware(['coordinator', 'admin']), callsController.list);
router.get('/:id', rbacMiddleware(['coordinator', 'admin', 'assessor']), callsController.getById);
router.put('/:id', rbacMiddleware(['coordinator', 'admin']), callsController.update);
router.delete('/:id', rbacMiddleware(['coordinator', 'admin']), callsController.delete);

// Call status management
router.post('/:id/open', rbacMiddleware(['coordinator', 'admin']), callsController.openCall);
router.post('/:id/close', rbacMiddleware(['coordinator', 'admin']), callsController.closeCall);
router.post('/:id/clone', rbacMiddleware(['coordinator', 'admin']), callsController.cloneCall);

// Assessor pool management
router.get('/:id/assessors', rbacMiddleware(['coordinator', 'admin']), callsController.getAssessors);
router.post('/:id/assessors', rbacMiddleware(['coordinator', 'admin']), callsController.addAssessor);
router.delete('/:id/assessors/:assessorId', rbacMiddleware(['coordinator', 'admin']), callsController.removeAssessor);

// Criteria management
router.get('/:id/criteria', rbacMiddleware(['coordinator', 'admin', 'assessor']), callsController.getCriteria);
router.put('/:id/criteria', rbacMiddleware(['coordinator', 'admin']), callsController.updateCriteria);

export default router;
