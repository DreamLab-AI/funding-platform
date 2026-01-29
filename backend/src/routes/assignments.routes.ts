import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const assignSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid(),
    assessorId: z.string().uuid(),
    dueAt: z.string().datetime().optional(),
  }),
});

const bulkAssignSchema = z.object({
  body: z.object({
    applicationIds: z.array(z.string().uuid()),
    assessorIds: z.array(z.string().uuid()),
    strategy: z.enum(['round-robin', 'random', 'balanced']).optional(),
    assessorsPerApplication: z.number().min(1).max(10).optional(),
    dueAt: z.string().datetime().optional(),
  }),
});

// Protected routes
router.use(authMiddleware);

// Coordinator routes
router.post('/', rbacMiddleware(['coordinator', 'admin']), validateRequest(assignSchema), assignmentsController.assign);
router.post('/bulk', rbacMiddleware(['coordinator', 'admin']), validateRequest(bulkAssignSchema), assignmentsController.bulkAssign);
router.get('/call/:callId', rbacMiddleware(['coordinator', 'admin']), assignmentsController.listByCall);
router.get('/application/:applicationId', rbacMiddleware(['coordinator', 'admin']), assignmentsController.listByApplication);
router.get('/assessor/:assessorId', rbacMiddleware(['coordinator', 'admin']), assignmentsController.listByAssessor);
router.delete('/:id', rbacMiddleware(['coordinator', 'admin']), assignmentsController.unassign);

// Progress tracking
router.get('/progress/:callId', rbacMiddleware(['coordinator', 'admin']), assignmentsController.getProgress);
router.get('/progress/:callId/assessors', rbacMiddleware(['coordinator', 'admin']), assignmentsController.getProgressByAssessor);

// Reminders
router.post('/remind/:id', rbacMiddleware(['coordinator', 'admin']), assignmentsController.sendReminder);
router.post('/remind-bulk', rbacMiddleware(['coordinator', 'admin']), assignmentsController.sendBulkReminders);

export default router;
