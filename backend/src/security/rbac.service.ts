/**
 * Role-Based Access Control (RBAC) Service
 * Enforces access control based on user roles and permissions
 * Aligned with PRD Section 4.1: Role Definitions and PRD 12.1: RBAC
 */

import { UserRole, Permission, AuthUser, JWTPayload } from '../types/security.types';
import { RBAC_CONFIG } from '../config/security';

/**
 * Role-Permission mapping based on PRD Section 4.1
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.APPLICANT]: [
    // Application permissions
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ_OWN,
    Permission.APPLICATION_UPDATE_OWN,
    Permission.APPLICATION_DELETE_OWN,
    Permission.APPLICATION_SUBMIT,
    Permission.APPLICATION_WITHDRAW,

    // GDPR permissions
    Permission.GDPR_EXPORT_DATA,
    Permission.GDPR_DELETE_DATA,
  ],

  [UserRole.ASSESSOR]: [
    // Assessment permissions
    Permission.ASSESSMENT_CREATE,
    Permission.ASSESSMENT_READ_OWN,
    Permission.ASSESSMENT_UPDATE_OWN,
    Permission.ASSESSMENT_SUBMIT,

    // Can view assigned applications only (enforced at service level)
    Permission.APPLICATION_READ_OWN, // Own assignments only

    // GDPR permissions
    Permission.GDPR_EXPORT_DATA,
  ],

  [UserRole.COORDINATOR]: [
    // Full application access
    Permission.APPLICATION_READ_ALL,
    Permission.APPLICATION_REOPEN,
    Permission.APPLICATION_EXPORT,
    Permission.APPLICATION_DOWNLOAD_FILES,

    // Full assessment access
    Permission.ASSESSMENT_READ_ALL,
    Permission.ASSESSMENT_RETURN,

    // Call management
    Permission.CALL_CREATE,
    Permission.CALL_READ,
    Permission.CALL_UPDATE,
    Permission.CALL_DELETE,
    Permission.CALL_CLONE,
    Permission.CALL_CONFIGURE,

    // Assessor pool management
    Permission.ASSESSOR_POOL_MANAGE,
    Permission.ASSESSOR_ASSIGN,
    Permission.ASSESSOR_REMOVE,

    // Results access
    Permission.RESULTS_VIEW_MASTER,
    Permission.RESULTS_EXPORT,

    // User management
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,

    // Audit access
    Permission.AUDIT_READ,

    // GDPR permissions
    Permission.GDPR_EXPORT_DATA,
  ],

  [UserRole.SCHEME_OWNER]: [
    // Read-only overview
    Permission.CALL_READ,
    Permission.APPLICATION_READ_ALL,
    Permission.ASSESSMENT_READ_ALL,
    Permission.RESULTS_VIEW_MASTER,
    Permission.RESULTS_EXPORT,
    Permission.AUDIT_READ,
    Permission.GDPR_EXPORT_DATA,
  ],
};

/**
 * Resource ownership types
 */
export interface ResourceOwnership {
  ownerId: string;
  callId?: string;
  assignedAssessorIds?: string[];
}

/**
 * Access control result
 */
export interface AccessControlResult {
  granted: boolean;
  reason?: string;
  missingPermissions?: Permission[];
}

/**
 * RBAC Service class
 */
export class RBACService {
  /**
   * Get all permissions for a role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = this.getPermissionsForRole(role);
    return permissions.includes(permission);
  }

  /**
   * Check if a user has a specific permission
   */
  userHasPermission(user: AuthUser | JWTPayload, permission: Permission): boolean {
    // Check explicit permissions first
    if (user.permissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    return this.roleHasPermission(user.role, permission);
  }

  /**
   * Check if a user has all of the specified permissions
   */
  userHasAllPermissions(user: AuthUser | JWTPayload, permissions: Permission[]): boolean {
    return permissions.every((permission) => this.userHasPermission(user, permission));
  }

  /**
   * Check if a user has any of the specified permissions
   */
  userHasAnyPermission(user: AuthUser | JWTPayload, permissions: Permission[]): boolean {
    return permissions.some((permission) => this.userHasPermission(user, permission));
  }

  /**
   * Get missing permissions for a user
   */
  getMissingPermissions(user: AuthUser | JWTPayload, requiredPermissions: Permission[]): Permission[] {
    return requiredPermissions.filter((permission) => !this.userHasPermission(user, permission));
  }

  /**
   * Check if a role is higher in the hierarchy than another
   */
  isRoleHigherThan(role: UserRole, otherRole: UserRole): boolean {
    const hierarchy = RBAC_CONFIG.roleHierarchy;
    return hierarchy[role] > hierarchy[otherRole];
  }

  /**
   * Check if a role can manage another role
   */
  canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    // Only coordinators can manage other roles
    if (managerRole !== UserRole.COORDINATOR) {
      return false;
    }

    // Coordinators cannot manage other coordinators or scheme owners
    return this.isRoleHigherThan(managerRole, targetRole) ||
           targetRole === UserRole.APPLICANT ||
           targetRole === UserRole.ASSESSOR;
  }

  /**
   * Check resource access with ownership consideration
   */
  checkResourceAccess(
    user: AuthUser | JWTPayload,
    permission: Permission,
    resource?: ResourceOwnership
  ): AccessControlResult {
    // Check basic permission
    if (!this.userHasPermission(user, permission)) {
      return {
        granted: false,
        reason: 'Insufficient permissions',
        missingPermissions: [permission],
      };
    }

    // If no resource ownership to check, permission is sufficient
    if (!resource) {
      return { granted: true };
    }

    // For "own" permissions, check ownership
    const isOwnPermission = permission.includes(':own');
    if (isOwnPermission) {
      // Check if user owns the resource
      if (resource.ownerId !== user.sub) {
        // For assessors, also check if they are assigned
        if (user.role === UserRole.ASSESSOR && resource.assignedAssessorIds) {
          if (!resource.assignedAssessorIds.includes(user.sub)) {
            return {
              granted: false,
              reason: 'You can only access resources assigned to you',
            };
          }
        } else {
          return {
            granted: false,
            reason: 'You can only access your own resources',
          };
        }
      }
    }

    return { granted: true };
  }

  /**
   * Check if user can access an application
   * Implements PRD requirements for application access
   */
  canAccessApplication(
    user: AuthUser | JWTPayload,
    applicationOwnerId: string,
    assignedAssessorIds?: string[]
  ): AccessControlResult {
    // Coordinators and Scheme Owners can access all applications
    if (user.role === UserRole.COORDINATOR || user.role === UserRole.SCHEME_OWNER) {
      return { granted: true };
    }

    // Applicants can only access their own applications
    if (user.role === UserRole.APPLICANT) {
      if (applicationOwnerId === user.sub) {
        return { granted: true };
      }
      return {
        granted: false,
        reason: 'You can only access your own applications',
      };
    }

    // Assessors can only access assigned applications
    if (user.role === UserRole.ASSESSOR) {
      if (assignedAssessorIds?.includes(user.sub)) {
        return { granted: true };
      }
      return {
        granted: false,
        reason: 'You can only access applications assigned to you',
      };
    }

    return {
      granted: false,
      reason: 'Access denied',
    };
  }

  /**
   * Check if user can access an assessment
   * Implements PRD requirement: Assessors cannot see other assessors' scores
   */
  canAccessAssessment(
    user: AuthUser | JWTPayload,
    assessmentOwnerId: string,
    applicationAssignedAssessorIds?: string[]
  ): AccessControlResult {
    // Coordinators can access all assessments
    if (user.role === UserRole.COORDINATOR) {
      return { granted: true };
    }

    // Scheme Owners can view all assessments (read-only)
    if (user.role === UserRole.SCHEME_OWNER) {
      return { granted: true };
    }

    // Assessors can only access their own assessments
    if (user.role === UserRole.ASSESSOR) {
      if (assessmentOwnerId === user.sub) {
        return { granted: true };
      }
      // Cannot see other assessors' assessments
      return {
        granted: false,
        reason: 'You cannot view other assessors\' assessments',
      };
    }

    // Applicants cannot access assessments
    if (user.role === UserRole.APPLICANT) {
      return {
        granted: false,
        reason: 'Applicants cannot access assessment data',
      };
    }

    return {
      granted: false,
      reason: 'Access denied',
    };
  }

  /**
   * Check if user can access master results
   * Implements PRD requirement: Master results visible only to Coordinators
   */
  canAccessMasterResults(user: AuthUser | JWTPayload): AccessControlResult {
    // Only Coordinators can access master results
    if (user.role === UserRole.COORDINATOR) {
      return { granted: true };
    }

    // Scheme Owners can view master results (read-only overview)
    if (user.role === UserRole.SCHEME_OWNER) {
      return { granted: true };
    }

    return {
      granted: false,
      reason: 'Master results are only accessible to Coordinators',
    };
  }

  /**
   * Check if user can manage a funding call
   */
  canManageCall(user: AuthUser | JWTPayload): AccessControlResult {
    if (user.role === UserRole.COORDINATOR) {
      return { granted: true };
    }

    return {
      granted: false,
      reason: 'Only Coordinators can manage funding calls',
    };
  }

  /**
   * Check if user can assign assessors
   */
  canAssignAssessors(user: AuthUser | JWTPayload): AccessControlResult {
    if (user.role === UserRole.COORDINATOR) {
      return { granted: true };
    }

    return {
      granted: false,
      reason: 'Only Coordinators can assign assessors',
    };
  }

  /**
   * Check if user can submit an application
   */
  canSubmitApplication(
    user: AuthUser | JWTPayload,
    applicationOwnerId: string,
    isBeforeDeadline: boolean
  ): AccessControlResult {
    // Must be the owner
    if (user.sub !== applicationOwnerId) {
      return {
        granted: false,
        reason: 'You can only submit your own applications',
      };
    }

    // Must be before deadline
    if (!isBeforeDeadline) {
      return {
        granted: false,
        reason: 'The submission deadline has passed',
      };
    }

    // Must have submission permission
    if (!this.userHasPermission(user, Permission.APPLICATION_SUBMIT)) {
      return {
        granted: false,
        reason: 'You do not have permission to submit applications',
      };
    }

    return { granted: true };
  }

  /**
   * Check if user can submit an assessment
   */
  canSubmitAssessment(
    user: AuthUser | JWTPayload,
    assignmentAssessorId: string
  ): AccessControlResult {
    // Must be the assigned assessor
    if (user.sub !== assignmentAssessorId) {
      return {
        granted: false,
        reason: 'You can only submit assessments for your assigned applications',
      };
    }

    // Must have submission permission
    if (!this.userHasPermission(user, Permission.ASSESSMENT_SUBMIT)) {
      return {
        granted: false,
        reason: 'You do not have permission to submit assessments',
      };
    }

    return { granted: true };
  }

  /**
   * Get effective permissions for a user (role + explicit)
   */
  getEffectivePermissions(user: AuthUser | JWTPayload): Permission[] {
    const rolePermissions = this.getPermissionsForRole(user.role);
    const explicitPermissions = user.permissions || [];

    // Combine and deduplicate
    return [...new Set([...rolePermissions, ...explicitPermissions])];
  }

  /**
   * Create a permission scope for a user (for filtering queries)
   */
  createPermissionScope(user: AuthUser | JWTPayload): {
    canAccessAll: boolean;
    ownerId?: string;
    assignedOnly?: boolean;
  } {
    switch (user.role) {
      case UserRole.COORDINATOR:
      case UserRole.SCHEME_OWNER:
        return { canAccessAll: true };

      case UserRole.APPLICANT:
        return {
          canAccessAll: false,
          ownerId: user.sub,
        };

      case UserRole.ASSESSOR:
        return {
          canAccessAll: false,
          assignedOnly: true,
        };

      default:
        return {
          canAccessAll: false,
          ownerId: user.sub,
        };
    }
  }
}

// Export singleton instance
export const rbacService = new RBACService();

// Export class for testing
export default RBACService;

/**
 * Permission check decorator factory (for use with controllers)
 */
export function requirePermissions(...permissions: Permission[]) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      // Assume first argument contains user context
      const context = args[0] as { user?: AuthUser | JWTPayload };

      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const missingPermissions = rbacService.getMissingPermissions(
        context.user,
        permissions
      );

      if (missingPermissions.length > 0) {
        throw new Error(
          `Forbidden: Missing permissions: ${missingPermissions.join(', ')}`
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Role check decorator factory
 */
export function requireRoles(...roles: UserRole[]) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const context = args[0] as { user?: AuthUser | JWTPayload };

      if (!context?.user) {
        throw new Error('Authentication required');
      }

      if (!roles.includes(context.user.role)) {
        throw new Error(`Forbidden: Required roles: ${roles.join(', ')}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
