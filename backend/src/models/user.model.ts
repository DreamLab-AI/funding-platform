import { query, transaction, DatabaseClient } from '../config/database';
import {
  User,
  UserCreateInput,
  UserUpdateInput,
  UserPublic,
  UserRole,
} from '../types';
import { generateUUID } from '../utils/helpers';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export class UserModel {
  /**
   * Create a new user
   */
  static async create(input: UserCreateInput): Promise<User> {
    const user_id = generateUUID();
    const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const result = await query<User>(
      `INSERT INTO users (
        user_id, email, password_hash, first_name, last_name, role,
        organisation, expertise_tags, is_active, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
      RETURNING *`,
      [
        user_id,
        input.email.toLowerCase(),
        password_hash,
        input.first_name,
        input.last_name,
        input.role,
        input.organisation || null,
        input.expertise_tags || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(user_id: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE user_id = $1',
      [user_id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Update user
   */
  static async update(user_id: string, input: UserUpdateInput): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(input.email.toLowerCase());
    }
    if (input.first_name !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(input.first_name);
    }
    if (input.last_name !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(input.last_name);
    }
    if (input.organisation !== undefined) {
      fields.push(`organisation = $${paramIndex++}`);
      values.push(input.organisation);
    }
    if (input.expertise_tags !== undefined) {
      fields.push(`expertise_tags = $${paramIndex++}`);
      values.push(input.expertise_tags);
    }
    if (input.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }

    if (fields.length === 0) return this.findById(user_id);

    fields.push(`updated_at = NOW()`);
    values.push(user_id);

    const result = await query<User>(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update password
   */
  static async updatePassword(user_id: string, newPassword: string): Promise<void> {
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
      [password_hash, user_id]
    );
  }

  /**
   * Verify password
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(user_id: string): Promise<void> {
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
      [user_id]
    );
  }

  /**
   * Find users by role
   */
  static async findByRole(role: UserRole, activeOnly: boolean = true): Promise<UserPublic[]> {
    const result = await query<UserPublic>(
      `SELECT user_id, email, first_name, last_name, role, organisation,
              expertise_tags, is_active, created_at
       FROM users
       WHERE role = $1 ${activeOnly ? 'AND is_active = true' : ''}
       ORDER BY last_name, first_name`,
      [role]
    );
    return result.rows;
  }

  /**
   * Find assessors by expertise tags
   */
  static async findAssessorsByExpertise(
    tags: string[],
    activeOnly: boolean = true
  ): Promise<UserPublic[]> {
    const result = await query<UserPublic>(
      `SELECT user_id, email, first_name, last_name, role, organisation,
              expertise_tags, is_active, created_at
       FROM users
       WHERE role = $1
         ${activeOnly ? 'AND is_active = true' : ''}
         AND expertise_tags && $2
       ORDER BY last_name, first_name`,
      [UserRole.ASSESSOR, tags]
    );
    return result.rows;
  }

  /**
   * List all users with pagination
   */
  static async list(
    options: {
      page?: number;
      limit?: number;
      role?: UserRole;
      search?: string;
      activeOnly?: boolean;
    } = {}
  ): Promise<{ users: UserPublic[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(options.role);
    }
    if (options.activeOnly !== false) {
      conditions.push(`is_active = true`);
    }
    if (options.search) {
      conditions.push(
        `(email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`
      );
      values.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await query<UserPublic>(
      `SELECT user_id, email, first_name, last_name, role, organisation,
              expertise_tags, is_active, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { users: result.rows, total };
  }

  /**
   * Delete user (soft delete by setting is_active = false)
   */
  static async delete(user_id: string): Promise<void> {
    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE user_id = $1',
      [user_id]
    );
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE email = $1 ${excludeUserId ? 'AND user_id != $2' : ''}`,
      excludeUserId ? [email.toLowerCase(), excludeUserId] : [email.toLowerCase()]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Verify email
   */
  static async verifyEmail(user_id: string): Promise<void> {
    await query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE user_id = $1',
      [user_id]
    );
  }

  /**
   * Convert User to UserPublic (strips sensitive data)
   */
  static toPublic(user: User): UserPublic {
    return {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      organisation: user.organisation,
      expertise_tags: user.expertise_tags,
      is_active: user.is_active,
      created_at: user.created_at,
    };
  }
}

export default UserModel;
