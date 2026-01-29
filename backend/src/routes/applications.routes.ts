import { Router } from 'express';
import { applicationsController } from '../controllers/applications.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/rbac.middleware';
import { uploadMultiple } from '../middleware/upload.middleware';
import { UserRole } from '../types';

const router = Router();

// Demo routes (no auth required)
router.get('/demo', applicationsController.list);

// Protected routes
router.use(authenticate);

// Applicant routes
router.post('/', applicationsController.create);
router.get('/my', applicationsController.getMyApplications);
router.get('/:id', applicationsController.getById);
router.put('/:id', applicationsController.update);
router.delete('/:id', applicationsController.withdraw);

// File upload
router.post('/:id/files', uploadMultiple, applicationsController.uploadFiles);
router.delete('/:id/files/:fileId', applicationsController.deleteFile);
router.get('/:id/files/:fileId/download', applicationsController.downloadFile);

// Confirmations
router.post('/:id/confirmations', applicationsController.addConfirmation);
router.get('/:id/confirmations', applicationsController.getConfirmations);

// Submit application
router.post('/:id/submit', applicationsController.submit);

// Coordinator routes
router.get('/', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.list);
router.get('/call/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.listByCall);
router.get('/export/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.exportMetadata);
router.get('/download/:callId', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.downloadAllFiles);
router.post('/:id/reopen', requireRoles(UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.reopen);

// Assessor routes - view assigned applications
router.get('/assigned', requireRoles(UserRole.ASSESSOR), applicationsController.getAssignedApplications);
router.get('/:id/materials', requireRoles(UserRole.ASSESSOR, UserRole.COORDINATOR, UserRole.ADMIN), applicationsController.getMaterials);

export default router;
