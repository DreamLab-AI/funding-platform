import { Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model';
import {
  AuthRequest,
  AuthenticatedUser,
  UserRole,
  AuditAction,
} from '../types';
import {
  loginSchema,
  userCreateSchema,
  refreshTokenSchema,
} from '../utils/validation';
import { createTokenPair } from '../middleware/auth.middleware';
import { createAuditLog, auditLogin, auditLogout } from '../middleware/audit.middleware';
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from '../utils/errors';
import { asyncHandler } from '../middleware/error.middleware';

/**
 * Register a new user
 */
export const register = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const data = userCreateSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create user
    const user = await UserModel.create(data);

    // Create audit log
    await createAuditLog(
      req,
      AuditAction.USER_CREATED,
      'user',
      user.user_id,
      { email: user.email, role: user.role }
    );

    // Generate tokens
    const authUser: AuthenticatedUser = {
      user_id: user.user_id,
      id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const tokens = createTokenPair(authUser);

    res.status(201).json({
      success: true,
      data: {
        user: UserModel.toPublic(user),
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
      },
    });
  }
);

/**
 * Login user
 */
export const login = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await UserModel.findByEmail(data.email);
    if (!user) {
      await auditLogin(req, false, undefined, data.email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const validPassword = await UserModel.verifyPassword(user, data.password);
    if (!validPassword) {
      await auditLogin(req, false, user.user_id, data.email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      await auditLogin(req, false, user.user_id, data.email);
      throw new AuthenticationError('Account is deactivated');
    }

    // Update last login
    await UserModel.updateLastLogin(user.user_id);

    // Create audit log
    await auditLogin(req, true, user.user_id, data.email);

    // Generate tokens
    const authUser: AuthenticatedUser = {
      user_id: user.user_id,
      id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const tokens = createTokenPair(authUser);

    res.json({
      success: true,
      data: {
        user: UserModel.toPublic(user),
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
      },
    });
  }
);

/**
 * Logout user
 */
export const logout = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    await auditLogout(req);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }
);

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const user = await UserModel.findById(req.user.user_id);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    res.json({
      success: true,
      data: UserModel.toPublic(user),
    });
  }
);

/**
 * Update current user profile
 */
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const allowedFields = ['first_name', 'last_name', 'organisation'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await UserModel.update(req.user.user_id, updates);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    await createAuditLog(
      req,
      AuditAction.USER_UPDATED,
      'user',
      user.user_id,
      { fields: Object.keys(updates) }
    );

    res.json({
      success: true,
      data: UserModel.toPublic(user),
    });
  }
);

/**
 * Change password
 */
export const changePassword = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw new ValidationError('Current password and new password are required');
    }

    const user = await UserModel.findById(req.user.user_id);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Verify current password
    const validPassword = await UserModel.verifyPassword(user, current_password);
    if (!validPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Update password
    await UserModel.updatePassword(user.user_id, new_password);

    await createAuditLog(
      req,
      AuditAction.PASSWORD_CHANGED,
      'user',
      user.user_id
    );

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  }
);

/**
 * Refresh access token
 */
export const refreshAccessToken = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // This is handled by the refreshToken middleware
    // But we can also handle it here for explicit token refresh
    const { refresh_token } = refreshTokenSchema.parse(req.body);

    // The actual refresh logic is in auth.middleware.ts
    // This endpoint would call that middleware
    res.json({
      success: true,
      data: { message: 'Use the auth middleware for token refresh' },
    });
  }
);

// Named export for index.ts re-export
export const authController = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  refreshAccessToken,
};

export default authController;
