export {
  authenticate,
  optionalAuth,
  refreshToken,
  generateAccessToken,
  generateRefreshToken,
  createTokenPair,
} from './auth.middleware';

export {
  requireRoles,
  requireAdmin,
  requireCoordinator,
  requireAssessor,
  requireApplicant,
  requireOwnerOrCoordinator,
  checkPermission,
  requireMinimumRole,
} from './rbac.middleware';

export {
  createAuditLog,
  audit,
  auditLogin,
  auditLogout,
  auditFileDownload,
  auditExport,
} from './audit.middleware';

export {
  createUploadMiddleware,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadForS3,
  handleUploadError,
  validateUploadedFile,
} from './upload.middleware';

export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  validateUUID,
  sanitizeBody,
} from './validation.middleware';

export {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  timeoutHandler,
} from './error.middleware';
