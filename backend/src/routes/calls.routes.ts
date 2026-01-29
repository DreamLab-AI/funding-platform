import { Router } from 'express';
import { callsController } from '../controllers/calls.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';
import { UserRole } from '../types';

const router = Router();

// Validation schemas
const createCallSchema = z.object({
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
});

// Public routes - list open calls
router.get('/open', callsController.listOpenCalls);
router.get('/:id/public', callsController.getPublicCallDetails);

// Protected routes
router.use(authenticate);

// Coordinator-only routes
router.post('/', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), validate(createCallSchema), callsController.create);
router.get('/', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.list);
router.get('/:id', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN, UserRole.ASSESSOR), callsController.getById);
router.put('/:id', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.update);
router.delete('/:id', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.delete);

// Call status management
router.post('/:id/open', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.openCall);
router.post('/:id/close', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.closeCall);
router.post('/:id/clone', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.cloneCall);

// Assessor pool management
router.get('/:id/assessors', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.getAssessors);
router.post('/:id/assessors', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.addAssessor);
router.delete('/:id/assessors/:assessorId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.removeAssessor);

// Criteria management
router.get('/:id/criteria', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN, UserRole.ASSESSOR), callsController.getCriteria);
router.put('/:id/criteria', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), callsController.updateCriteria);

export default router;
