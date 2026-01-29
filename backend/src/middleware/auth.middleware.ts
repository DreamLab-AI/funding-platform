import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JwtPayload, UserRole, AuthenticatedUser } from '../types';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { UserModel } from '../models/user.model';
import { logger } from '../utils/logger';

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }
}

/**
 * Generate access token
 */
export function generateAccessToken(user: AuthenticatedUser): string {
  const payload: JwtPayload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user: AuthenticatedUser): string {
  const payload: JwtPayload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Authentication middleware - validates JWT token
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }

    req.user = {
      user_id: payload.user_id,
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
      first_name: '',
      last_name: '',
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware - attaches user if token present, but doesn't require it
 */
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const payload = verifyToken(token);

      if (payload.type === 'access') {
        req.user = {
          user_id: payload.user_id,
          id: payload.user_id,
          email: payload.email,
          role: payload.role,
          first_name: '',
          last_name: '',
        };
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors in optional auth
    logger.debug('Optional auth token invalid', { error });
    next();
  }
}

/**
 * Refresh token middleware - validates refresh token and returns new access token
 */
export async function refreshToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new AuthenticationError('No refresh token provided');
    }

    const payload = verifyToken(refresh_token);

    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.user_id);
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    const authenticatedUser: AuthenticatedUser = {
      user_id: user.user_id,
      id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const newAccessToken = generateAccessToken(authenticatedUser);
    const newRefreshToken = generateRefreshToken(authenticatedUser);

    res.json({
      success: true,
      data: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: parseTokenExpiry(config.jwt.expiresIn),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Parse token expiry string to seconds
 */
function parseTokenExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 1800; // Default 30 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 1800;
  }
}

/**
 * Create token pair for authenticated user
 */
export function createTokenPair(user: AuthenticatedUser) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: parseTokenExpiry(config.jwt.expiresIn),
  };
}

// Named export for routes using { authMiddleware }
export const authMiddleware = {
  authenticate,
  optionalAuth,
  refreshToken,
  generateAccessToken,
  generateRefreshToken,
  createTokenPair,
};

export default authMiddleware;
