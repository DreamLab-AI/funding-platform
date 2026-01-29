import { Response, NextFunction } from 'express';
import { AuthRequest, AuditAction, AuditLogCreateInput } from '../types';
import { AuditLogModel } from '../models/auditLog.model';
import { getClientIP } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  req: AuthRequest,
  action: AuditAction,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const input: AuditLogCreateInput = {
      actor_id: req.user?.user_id,
      actor_role: req.user?.role,
      actor_email: req.user?.email,
      action,
      target_type: targetType,
      target_id: targetId,
      details: {
        ...details,
        method: req.method,
        path: req.originalUrl,
      },
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
    };

    await AuditLogModel.create(input);
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to create audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
      action,
      targetType,
      targetId,
    });
  }
}

/**
 * Audit middleware factory - logs action after successful response
 */
export function audit(
  action: AuditAction,
  targetType: string,
  getTargetId?: (req: AuthRequest) => string | undefined,
  getDetails?: (req: AuthRequest, res: Response) => Record<string, unknown>
) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log after successful response
    res.json = function (body: unknown) {
      // Only log for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const targetId = getTargetId ? getTargetId(req) : undefined;
        const details = getDetails ? getDetails(req, res) : undefined;

        createAuditLog(req, action, targetType, targetId, details).catch((err) => {
          logger.error('Audit log creation failed', { error: err });
        });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Audit login attempt
 */
export async function auditLogin(
  req: AuthRequest,
  success: boolean,
  userId?: string,
  email?: string
): Promise<void> {
  try {
    const input: AuditLogCreateInput = {
      actor_id: userId,
      actor_email: email,
      action: AuditAction.USER_LOGIN,
      target_type: 'user',
      target_id: userId,
      details: {
        success,
        email,
        method: req.method,
        path: req.originalUrl,
      },
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
    };

    await AuditLogModel.create(input);
  } catch (error) {
    logger.error('Failed to create login audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Audit logout
 */
export async function auditLogout(req: AuthRequest): Promise<void> {
  if (!req.user) return;

  try {
    const input: AuditLogCreateInput = {
      actor_id: req.user.user_id,
      actor_role: req.user.role,
      actor_email: req.user.email,
      action: AuditAction.USER_LOGOUT,
      target_type: 'user',
      target_id: req.user.user_id,
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
    };

    await AuditLogModel.create(input);
  } catch (error) {
    logger.error('Failed to create logout audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Audit file download
 */
export async function auditFileDownload(
  req: AuthRequest,
  fileId: string,
  filename: string,
  applicationId?: string
): Promise<void> {
  try {
    const input: AuditLogCreateInput = {
      actor_id: req.user?.user_id,
      actor_role: req.user?.role,
      actor_email: req.user?.email,
      action: AuditAction.FILE_DOWNLOADED,
      target_type: 'file',
      target_id: fileId,
      details: {
        filename,
        application_id: applicationId,
      },
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
    };

    await AuditLogModel.create(input);
  } catch (error) {
    logger.error('Failed to create file download audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Audit export
 */
export async function auditExport(
  req: AuthRequest,
  exportType: 'metadata' | 'results' | 'files',
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  const actionMap = {
    metadata: AuditAction.EXPORT_METADATA,
    results: AuditAction.EXPORT_RESULTS,
    files: AuditAction.EXPORT_FILES,
  };

  try {
    const input: AuditLogCreateInput = {
      actor_id: req.user?.user_id,
      actor_role: req.user?.role,
      actor_email: req.user?.email,
      action: actionMap[exportType],
      target_type: 'call',
      target_id: targetId,
      details,
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'],
    };

    await AuditLogModel.create(input);
  } catch (error) {
    logger.error('Failed to create export audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * General audit middleware for all API requests
 * Logs request info for audit trail
 */
export function auditMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Log request start
  const startTime = Date.now();

  // Store original json method
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    // Log audit info for non-health-check requests
    if (!req.originalUrl.includes('/health')) {
      logger.info('API Request', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        userId: req.user?.user_id,
        userRole: req.user?.role,
        ip: getClientIP(req),
      });
    }
    return originalJson(body);
  };

  next();
}

export default {
  createAuditLog,
  audit,
  auditLogin,
  auditLogout,
  auditFileDownload,
  auditExport,
  auditMiddleware,
};
