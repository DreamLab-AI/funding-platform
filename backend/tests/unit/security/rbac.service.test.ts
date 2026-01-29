/**
 * RBAC Service Unit Tests
 * Tests role permissions, access control, and resource ownership
 */

import RBACService, {
  rbacService,
  ResourceOwnership,
  requirePermissions,
  requireRoles,
} from '../../../src/security/rbac.service';
import { UserRole, Permission, AuthUser, JWTPayload } from '../../../src/types/security.types';

// Mock config
jest.mock('../../../src/config/security', () => ({
  RBAC_CONFIG: {
    roleHierarchy: {
      applicant: 0,
      assessor: 1,
      coordinator: 2,
      scheme_owner: 3,
    },
    inheritPermissions: false,
    superAdminRole: 'coordinator',
  },
}));

describe('RBACService', () => {
  let service: RBACService;

  beforeEach(() => {
    service = new RBACService();
  });

  // Test fixtures
  const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed',
    role: UserRole.APPLICANT,
    permissions: [],
    isActive: true,
    isEmailVerified: true,
    mfaEnabled: false,
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createJWTPayload = (overrides: Partial<JWTPayload> = {}): JWTPayload => ({
    sub: 'user-123',
    email: 'test@example.com',
    role: UserRole.APPLICANT,
    permissions: [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'test-issuer',
    aud: 'test-audience',
    jti: 'test-jti',
    ...overrides,
  });

  describe('getPermissionsForRole', () => {
    it('should return correct permissions for APPLICANT role', () => {
      const permissions = service.getPermissionsForRole(UserRole.APPLICANT);

      expect(permissions).toContain(Permission.APPLICATION_CREATE);
      expect(permissions).toContain(Permission.APPLICATION_READ_OWN);
      expect(permissions).toContain(Permission.APPLICATION_UPDATE_OWN);
      expect(permissions).toContain(Permission.APPLICATION_DELETE_OWN);
      expect(permissions).toContain(Permission.APPLICATION_SUBMIT);
      expect(permissions).toContain(Permission.APPLICATION_WITHDRAW);
      expect(permissions).toContain(Permission.GDPR_EXPORT_DATA);
      expect(permissions).toContain(Permission.GDPR_DELETE_DATA);
    });

    it('should return correct permissions for ASSESSOR role', () => {
      const permissions = service.getPermissionsForRole(UserRole.ASSESSOR);

      expect(permissions).toContain(Permission.ASSESSMENT_CREATE);
      expect(permissions).toContain(Permission.ASSESSMENT_READ_OWN);
      expect(permissions).toContain(Permission.ASSESSMENT_UPDATE_OWN);
      expect(permissions).toContain(Permission.ASSESSMENT_SUBMIT);
      expect(permissions).toContain(Permission.GDPR_EXPORT_DATA);
      expect(permissions).not.toContain(Permission.GDPR_DELETE_DATA);
    });

    it('should return correct permissions for COORDINATOR role', () => {
      const permissions = service.getPermissionsForRole(UserRole.COORDINATOR);

      expect(permissions).toContain(Permission.APPLICATION_READ_ALL);
      expect(permissions).toContain(Permission.ASSESSMENT_READ_ALL);
      expect(permissions).toContain(Permission.CALL_CREATE);
      expect(permissions).toContain(Permission.CALL_UPDATE);
      expect(permissions).toContain(Permission.CALL_DELETE);
      expect(permissions).toContain(Permission.ASSESSOR_POOL_MANAGE);
      expect(permissions).toContain(Permission.ASSESSOR_ASSIGN);
      expect(permissions).toContain(Permission.RESULTS_VIEW_MASTER);
      expect(permissions).toContain(Permission.USER_CREATE);
      expect(permissions).toContain(Permission.AUDIT_READ);
    });

    it('should return correct permissions for SCHEME_OWNER role', () => {
      const permissions = service.getPermissionsForRole(UserRole.SCHEME_OWNER);

      expect(permissions).toContain(Permission.CALL_READ);
      expect(permissions).toContain(Permission.APPLICATION_READ_ALL);
      expect(permissions).toContain(Permission.ASSESSMENT_READ_ALL);
      expect(permissions).toContain(Permission.RESULTS_VIEW_MASTER);
      expect(permissions).toContain(Permission.RESULTS_EXPORT);
      expect(permissions).toContain(Permission.AUDIT_READ);
      expect(permissions).not.toContain(Permission.CALL_CREATE); // Read-only
      expect(permissions).not.toContain(Permission.CALL_UPDATE);
    });

    it('should return empty array for unknown role', () => {
      const permissions = service.getPermissionsForRole('unknown' as UserRole);

      expect(permissions).toEqual([]);
    });
  });

  describe('roleHasPermission', () => {
    it('should return true when role has permission', () => {
      expect(
        service.roleHasPermission(UserRole.APPLICANT, Permission.APPLICATION_CREATE)
      ).toBe(true);
    });

    it('should return false when role lacks permission', () => {
      expect(
        service.roleHasPermission(UserRole.APPLICANT, Permission.CALL_CREATE)
      ).toBe(false);
    });

    it('should handle COORDINATOR with management permissions', () => {
      expect(
        service.roleHasPermission(UserRole.COORDINATOR, Permission.ASSESSOR_ASSIGN)
      ).toBe(true);
    });
  });

  describe('userHasPermission', () => {
    it('should return true when user has explicit permission', () => {
      const user = createAuthUser({
        permissions: [Permission.CALL_CREATE],
      });

      expect(service.userHasPermission(user, Permission.CALL_CREATE)).toBe(true);
    });

    it('should return true when role grants permission', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      expect(service.userHasPermission(user, Permission.CALL_CREATE)).toBe(true);
    });

    it('should return false when neither explicit nor role grants permission', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      expect(service.userHasPermission(user, Permission.CALL_CREATE)).toBe(false);
    });

    it('should work with JWTPayload', () => {
      const payload = createJWTPayload({ role: UserRole.COORDINATOR });

      expect(service.userHasPermission(payload, Permission.CALL_CREATE)).toBe(true);
    });

    it('should prioritize explicit permissions', () => {
      const user = createAuthUser({
        role: UserRole.APPLICANT, // Normally can't delete calls
        permissions: [Permission.CALL_DELETE], // But has explicit permission
      });

      expect(service.userHasPermission(user, Permission.CALL_DELETE)).toBe(true);
    });
  });

  describe('userHasAllPermissions', () => {
    it('should return true when user has all permissions', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      expect(
        service.userHasAllPermissions(user, [
          Permission.CALL_CREATE,
          Permission.CALL_UPDATE,
        ])
      ).toBe(true);
    });

    it('should return false when user lacks any permission', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      expect(
        service.userHasAllPermissions(user, [
          Permission.APPLICATION_CREATE,
          Permission.CALL_CREATE,
        ])
      ).toBe(false);
    });

    it('should return true for empty permission array', () => {
      const user = createAuthUser();

      expect(service.userHasAllPermissions(user, [])).toBe(true);
    });
  });

  describe('userHasAnyPermission', () => {
    it('should return true when user has at least one permission', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      expect(
        service.userHasAnyPermission(user, [
          Permission.APPLICATION_CREATE,
          Permission.CALL_CREATE,
        ])
      ).toBe(true);
    });

    it('should return false when user has none of the permissions', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      expect(
        service.userHasAnyPermission(user, [
          Permission.CALL_CREATE,
          Permission.CALL_UPDATE,
        ])
      ).toBe(false);
    });

    it('should return false for empty permission array', () => {
      const user = createAuthUser();

      expect(service.userHasAnyPermission(user, [])).toBe(false);
    });
  });

  describe('getMissingPermissions', () => {
    it('should return missing permissions', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      const missing = service.getMissingPermissions(user, [
        Permission.APPLICATION_CREATE,
        Permission.CALL_CREATE,
      ]);

      expect(missing).toContain(Permission.CALL_CREATE);
      expect(missing).not.toContain(Permission.APPLICATION_CREATE);
    });

    it('should return empty array when user has all permissions', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const missing = service.getMissingPermissions(user, [
        Permission.CALL_CREATE,
        Permission.CALL_UPDATE,
      ]);

      expect(missing).toEqual([]);
    });
  });

  describe('isRoleHigherThan', () => {
    it('should correctly compare role hierarchy', () => {
      expect(service.isRoleHigherThan(UserRole.COORDINATOR, UserRole.ASSESSOR)).toBe(
        true
      );
      expect(service.isRoleHigherThan(UserRole.ASSESSOR, UserRole.APPLICANT)).toBe(
        true
      );
      expect(service.isRoleHigherThan(UserRole.SCHEME_OWNER, UserRole.COORDINATOR)).toBe(
        true
      );
    });

    it('should return false for equal roles', () => {
      expect(service.isRoleHigherThan(UserRole.ASSESSOR, UserRole.ASSESSOR)).toBe(
        false
      );
    });

    it('should return false for lower roles', () => {
      expect(service.isRoleHigherThan(UserRole.APPLICANT, UserRole.COORDINATOR)).toBe(
        false
      );
    });
  });

  describe('canManageRole', () => {
    it('should allow coordinators to manage applicants', () => {
      expect(service.canManageRole(UserRole.COORDINATOR, UserRole.APPLICANT)).toBe(
        true
      );
    });

    it('should allow coordinators to manage assessors', () => {
      expect(service.canManageRole(UserRole.COORDINATOR, UserRole.ASSESSOR)).toBe(
        true
      );
    });

    it('should not allow coordinators to manage other coordinators', () => {
      expect(service.canManageRole(UserRole.COORDINATOR, UserRole.COORDINATOR)).toBe(
        false
      );
    });

    it('should not allow coordinators to manage scheme owners', () => {
      expect(service.canManageRole(UserRole.COORDINATOR, UserRole.SCHEME_OWNER)).toBe(
        false
      );
    });

    it('should not allow non-coordinators to manage any role', () => {
      expect(service.canManageRole(UserRole.APPLICANT, UserRole.APPLICANT)).toBe(
        false
      );
      expect(service.canManageRole(UserRole.ASSESSOR, UserRole.APPLICANT)).toBe(
        false
      );
    });
  });

  describe('checkResourceAccess', () => {
    it('should grant access when user has permission and no resource ownership check', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.checkResourceAccess(
        user,
        Permission.APPLICATION_READ_ALL
      );

      expect(result.granted).toBe(true);
    });

    it('should deny access when user lacks permission', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      const result = service.checkResourceAccess(user, Permission.CALL_CREATE);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Insufficient permissions');
      expect(result.missingPermissions).toContain(Permission.CALL_CREATE);
    });

    it('should grant access for own resources', () => {
      const user = createAuthUser({ id: 'user-123' });
      const resource: ResourceOwnership = { ownerId: 'user-123' };

      const result = service.checkResourceAccess(
        user,
        Permission.APPLICATION_READ_OWN,
        resource
      );

      expect(result.granted).toBe(true);
    });

    it('should deny access for other users resources', () => {
      const user = createAuthUser({ id: 'user-123' });
      const resource: ResourceOwnership = { ownerId: 'different-user' };

      const result = service.checkResourceAccess(
        user,
        Permission.APPLICATION_READ_OWN,
        resource
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You can only access your own resources');
    });

    it('should allow assessors access to assigned resources', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });
      const resource: ResourceOwnership = {
        ownerId: 'applicant-456',
        assignedAssessorIds: ['assessor-123', 'assessor-789'],
      };

      const result = service.checkResourceAccess(
        user,
        Permission.APPLICATION_READ_OWN,
        resource
      );

      expect(result.granted).toBe(true);
    });

    it('should deny assessors access to unassigned resources', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });
      const resource: ResourceOwnership = {
        ownerId: 'applicant-456',
        assignedAssessorIds: ['other-assessor'],
      };

      const result = service.checkResourceAccess(
        user,
        Permission.APPLICATION_READ_OWN,
        resource
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You can only access resources assigned to you');
    });
  });

  describe('canAccessApplication', () => {
    it('should allow coordinators to access any application', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.canAccessApplication(user, 'any-owner-id');

      expect(result.granted).toBe(true);
    });

    it('should allow scheme owners to access any application', () => {
      const user = createAuthUser({ role: UserRole.SCHEME_OWNER });

      const result = service.canAccessApplication(user, 'any-owner-id');

      expect(result.granted).toBe(true);
    });

    it('should allow applicants to access their own applications', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canAccessApplication(user, 'user-123');

      expect(result.granted).toBe(true);
    });

    it('should deny applicants access to other applications', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canAccessApplication(user, 'other-user');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You can only access your own applications');
    });

    it('should allow assessors to access assigned applications', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canAccessApplication(
        user,
        'applicant-456',
        ['assessor-123', 'assessor-789']
      );

      expect(result.granted).toBe(true);
    });

    it('should deny assessors access to unassigned applications', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canAccessApplication(
        user,
        'applicant-456',
        ['other-assessor']
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You can only access applications assigned to you');
    });

    it('should work with JWTPayload', () => {
      const payload = createJWTPayload({
        sub: 'user-123',
        role: UserRole.APPLICANT,
      });

      const result = service.canAccessApplication(payload, 'user-123');

      expect(result.granted).toBe(true);
    });
  });

  describe('canAccessAssessment', () => {
    it('should allow coordinators to access any assessment', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.canAccessAssessment(user, 'any-assessor-id');

      expect(result.granted).toBe(true);
    });

    it('should allow scheme owners to view assessments', () => {
      const user = createAuthUser({ role: UserRole.SCHEME_OWNER });

      const result = service.canAccessAssessment(user, 'any-assessor-id');

      expect(result.granted).toBe(true);
    });

    it('should allow assessors to access their own assessments', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canAccessAssessment(user, 'assessor-123');

      expect(result.granted).toBe(true);
    });

    it('should deny assessors access to other assessors assessments', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canAccessAssessment(user, 'other-assessor');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe("You cannot view other assessors' assessments");
    });

    it('should deny applicants access to assessments', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      const result = service.canAccessAssessment(user, 'any-assessor');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Applicants cannot access assessment data');
    });
  });

  describe('canAccessMasterResults', () => {
    it('should allow coordinators to access master results', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.canAccessMasterResults(user);

      expect(result.granted).toBe(true);
    });

    it('should allow scheme owners to access master results', () => {
      const user = createAuthUser({ role: UserRole.SCHEME_OWNER });

      const result = service.canAccessMasterResults(user);

      expect(result.granted).toBe(true);
    });

    it('should deny assessors access to master results', () => {
      const user = createAuthUser({ role: UserRole.ASSESSOR });

      const result = service.canAccessMasterResults(user);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Master results are only accessible to Coordinators');
    });

    it('should deny applicants access to master results', () => {
      const user = createAuthUser({ role: UserRole.APPLICANT });

      const result = service.canAccessMasterResults(user);

      expect(result.granted).toBe(false);
    });
  });

  describe('canManageCall', () => {
    it('should allow coordinators to manage calls', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.canManageCall(user);

      expect(result.granted).toBe(true);
    });

    it('should deny non-coordinators', () => {
      const roles = [UserRole.APPLICANT, UserRole.ASSESSOR, UserRole.SCHEME_OWNER];

      roles.forEach((role) => {
        const user = createAuthUser({ role });
        const result = service.canManageCall(user);

        expect(result.granted).toBe(false);
        expect(result.reason).toBe('Only Coordinators can manage funding calls');
      });
    });
  });

  describe('canAssignAssessors', () => {
    it('should allow coordinators to assign assessors', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const result = service.canAssignAssessors(user);

      expect(result.granted).toBe(true);
    });

    it('should deny non-coordinators', () => {
      const user = createAuthUser({ role: UserRole.ASSESSOR });

      const result = service.canAssignAssessors(user);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Only Coordinators can assign assessors');
    });
  });

  describe('canSubmitApplication', () => {
    it('should allow owner to submit before deadline', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canSubmitApplication(user, 'user-123', true);

      expect(result.granted).toBe(true);
    });

    it('should deny non-owner submission', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canSubmitApplication(user, 'different-user', true);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You can only submit your own applications');
    });

    it('should deny submission after deadline', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canSubmitApplication(user, 'user-123', false);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('The submission deadline has passed');
    });

    it('should deny users without submit permission', () => {
      const user = createAuthUser({
        id: 'user-123',
        role: UserRole.ASSESSOR, // Assessors cannot submit applications
      });

      const result = service.canSubmitApplication(user, 'user-123', true);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('You do not have permission to submit applications');
    });
  });

  describe('canSubmitAssessment', () => {
    it('should allow assigned assessor to submit', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canSubmitAssessment(user, 'assessor-123');

      expect(result.granted).toBe(true);
    });

    it('should deny unassigned assessor', () => {
      const user = createAuthUser({ id: 'assessor-123', role: UserRole.ASSESSOR });

      const result = service.canSubmitAssessment(user, 'different-assessor');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe(
        'You can only submit assessments for your assigned applications'
      );
    });

    it('should deny users without assessment submit permission', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const result = service.canSubmitAssessment(user, 'user-123');

      expect(result.granted).toBe(false);
      expect(result.reason).toBe(
        'You do not have permission to submit assessments'
      );
    });
  });

  describe('getEffectivePermissions', () => {
    it('should combine role and explicit permissions', () => {
      const user = createAuthUser({
        role: UserRole.APPLICANT,
        permissions: [Permission.CALL_READ], // Explicit extra permission
      });

      const effective = service.getEffectivePermissions(user);

      // Should have role permissions
      expect(effective).toContain(Permission.APPLICATION_CREATE);
      // Should have explicit permission
      expect(effective).toContain(Permission.CALL_READ);
    });

    it('should deduplicate permissions', () => {
      const user = createAuthUser({
        role: UserRole.APPLICANT,
        permissions: [Permission.APPLICATION_CREATE], // Already in role
      });

      const effective = service.getEffectivePermissions(user);

      // Count occurrences
      const count = effective.filter(
        (p) => p === Permission.APPLICATION_CREATE
      ).length;
      expect(count).toBe(1);
    });

    it('should handle empty explicit permissions', () => {
      const user = createAuthUser({ permissions: [] });

      const effective = service.getEffectivePermissions(user);

      expect(effective.length).toBeGreaterThan(0); // Role permissions
    });
  });

  describe('createPermissionScope', () => {
    it('should return canAccessAll for coordinator', () => {
      const user = createAuthUser({ role: UserRole.COORDINATOR });

      const scope = service.createPermissionScope(user);

      expect(scope.canAccessAll).toBe(true);
      expect(scope.ownerId).toBeUndefined();
    });

    it('should return canAccessAll for scheme owner', () => {
      const user = createAuthUser({ role: UserRole.SCHEME_OWNER });

      const scope = service.createPermissionScope(user);

      expect(scope.canAccessAll).toBe(true);
    });

    it('should return ownerId for applicant', () => {
      const user = createAuthUser({ id: 'user-123', role: UserRole.APPLICANT });

      const scope = service.createPermissionScope(user);

      expect(scope.canAccessAll).toBe(false);
      expect(scope.ownerId).toBe('user-123');
    });

    it('should return assignedOnly for assessor', () => {
      const user = createAuthUser({ role: UserRole.ASSESSOR });

      const scope = service.createPermissionScope(user);

      expect(scope.canAccessAll).toBe(false);
      expect(scope.assignedOnly).toBe(true);
    });
  });

  describe('requirePermissions decorator factory', () => {
    it('should return a decorator function', () => {
      const decorator = requirePermissions(Permission.CALL_CREATE);

      expect(typeof decorator).toBe('function');
    });

    it('should accept multiple permissions', () => {
      const decorator = requirePermissions(
        Permission.CALL_CREATE,
        Permission.CALL_UPDATE
      );

      expect(typeof decorator).toBe('function');
    });
  });

  describe('requireRoles decorator factory', () => {
    it('should return a decorator function', () => {
      const decorator = requireRoles(UserRole.COORDINATOR);

      expect(typeof decorator).toBe('function');
    });

    it('should accept multiple roles', () => {
      const decorator = requireRoles(
        UserRole.COORDINATOR,
        UserRole.SCHEME_OWNER
      );

      expect(typeof decorator).toBe('function');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(rbacService).toBeInstanceOf(RBACService);
    });

    it('should have consistent behavior', () => {
      const permissions = rbacService.getPermissionsForRole(UserRole.APPLICANT);

      expect(permissions).toContain(Permission.APPLICATION_CREATE);
    });
  });

  describe('edge cases', () => {
    it('should handle user with undefined permissions', () => {
      const user = createAuthUser({ permissions: undefined as any });

      // Should not throw
      expect(() => service.getEffectivePermissions(user)).not.toThrow();
    });

    it('should handle JWTPayload sub field for user ID', () => {
      const payload = createJWTPayload({ sub: 'jwt-user-456' });

      const result = service.canAccessApplication(payload, 'jwt-user-456');

      expect(result.granted).toBe(true);
    });
  });
});
