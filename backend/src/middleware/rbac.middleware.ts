import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { AuthorizationError, AuthenticationError } from '../utils/errors';

/**
 * Role-based access control middleware factory
 * Checks if authenticated user has one of the required roles
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user is an admin
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (req.user.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user is a coordinator
 */
export function requireCoordinator(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (
      req.user.role !== UserRole.COORDINATOR &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError('Coordinator access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user is an assessor
 */
export function requireAssessor(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (
      req.user.role !== UserRole.ASSESSOR &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError('Assessor access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user is an applicant
 */
export function requireApplicant(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (
      req.user.role !== UserRole.APPLICANT &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new AuthorizationError('Applicant access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user is the resource owner or has admin/coordinator access
 */
export function requireOwnerOrCoordinator(userIdParam: string = 'userId') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const resourceUserId = req.params[userIdParam];

      // Allow if user is the owner
      if (req.user.user_id === resourceUserId) {
        return next();
      }

      // Allow if user is coordinator or admin
      if (
        req.user.role === UserRole.COORDINATOR ||
        req.user.role === UserRole.ADMIN
      ) {
        return next();
      }

      throw new AuthorizationError('Access denied');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Dynamic permission check based on context
 */
export function checkPermission(
  permissionCheck: (req: AuthRequest) => boolean | Promise<boolean>
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const hasPermission = await permissionCheck(req);

      if (!hasPermission) {
        throw new AuthorizationError('Access denied');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Role hierarchy check - higher roles include lower role permissions
 */
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN]: 100,
  [UserRole.COORDINATOR]: 80,
  [UserRole.SCHEME_OWNER]: 60,
  [UserRole.ASSESSOR]: 40,
  [UserRole.APPLICANT]: 20,
};

/**
 * Check if user has at least the minimum role level
 */
export function requireMinimumRole(minimumRole: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredLevel = roleHierarchy[minimumRole] || 0;

      if (userRoleLevel < requiredLevel) {
        throw new AuthorizationError(
          `Insufficient permissions. Minimum role required: ${minimumRole}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default {
  requireRoles,
  requireAdmin,
  requireCoordinator,
  requireAssessor,
  requireApplicant,
  requireOwnerOrCoordinator,
  checkPermission,
  requireMinimumRole,
};
