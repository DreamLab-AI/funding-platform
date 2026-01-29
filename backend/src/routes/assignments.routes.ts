import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';
import { UserRole } from '../types';

const router = Router();

// Validation schemas
const assignSchema = z.object({
  applicationId: z.string().uuid(),
  assessorId: z.string().uuid(),
  dueAt: z.string().datetime().optional(),
});

const bulkAssignSchema = z.object({
  applicationIds: z.array(z.string().uuid()),
  assessorIds: z.array(z.string().uuid()),
  strategy: z.enum(['round-robin', 'random', 'balanced']).optional(),
  assessorsPerApplication: z.number().min(1).max(10).optional(),
  dueAt: z.string().datetime().optional(),
});

// Protected routes
router.use(authenticate);

// Coordinator routes
router.post('/', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), validate(assignSchema), assignmentsController.assign);
router.post('/bulk', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), validate(bulkAssignSchema), assignmentsController.bulkAssign);
router.get('/call/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.listByCall);
router.get('/application/:applicationId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.listByApplication);
router.get('/assessor/:assessorId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.listByAssessor);
router.delete('/:id', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.unassign);

// Progress tracking
router.get('/progress/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.getProgress);
router.get('/progress/:callId/assessors', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.getProgressByAssessor);

// Reminders
router.post('/remind/:id', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.sendReminder);
router.post('/remind-bulk', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), assignmentsController.sendBulkReminders);

export default router;
