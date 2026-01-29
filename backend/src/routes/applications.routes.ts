import { Router } from 'express';
import { applicationsController } from '../controllers/applications.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

// Protected routes
router.use(authMiddleware);

// Applicant routes
router.post('/', applicationsController.create);
router.get('/my', applicationsController.getMyApplications);
router.get('/:id', applicationsController.getById);
router.put('/:id', applicationsController.update);
router.delete('/:id', applicationsController.withdraw);

// File upload
router.post('/:id/files', uploadMiddleware.array('files', 10), applicationsController.uploadFiles);
router.delete('/:id/files/:fileId', applicationsController.deleteFile);
router.get('/:id/files/:fileId/download', applicationsController.downloadFile);

// Confirmations
router.post('/:id/confirmations', applicationsController.addConfirmation);
router.get('/:id/confirmations', applicationsController.getConfirmations);

// Submit application
router.post('/:id/submit', applicationsController.submit);

// Coordinator routes
router.get('/', rbacMiddleware(['coordinator', 'admin']), applicationsController.list);
router.get('/call/:callId', rbacMiddleware(['coordinator', 'admin']), applicationsController.listByCall);
router.get('/export/:callId', rbacMiddleware(['coordinator', 'admin']), applicationsController.exportMetadata);
router.get('/download/:callId', rbacMiddleware(['coordinator', 'admin']), applicationsController.downloadAllFiles);
router.post('/:id/reopen', rbacMiddleware(['coordinator', 'admin']), applicationsController.reopen);

// Assessor routes - view assigned applications
router.get('/assigned', rbacMiddleware(['assessor']), applicationsController.getAssignedApplications);
router.get('/:id/materials', rbacMiddleware(['assessor', 'coordinator', 'admin']), applicationsController.getMaterials);

export default router;
