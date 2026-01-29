/**
 * User Model Unit Tests
 *
 * Tests CRUD operations, password hashing, role management, and query building
 */

import { UserModel } from '../../../src/models/user.model';
import { UserRole, User, UserCreateInput, UserUpdateInput } from '../../../src/types';
import * as database from '../../../src/config/database';
import bcrypt from 'bcryptjs';

// Mock the database module
jest.mock('../../../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock UUID
jest.mock('../../../src/utils/helpers', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Also mock uuid directly
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('UserModel', () => {
  const mockQuery = database.query as jest.Mock;
  const mockHash = bcrypt.hash as jest.Mock;
  const mockCompare = bcrypt.compare as jest.Mock;

  const mockUser: User = {
    user_id: 'user-123',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.APPLICANT,
    organisation: 'Test Org',
    expertise_tags: ['tag1', 'tag2'],
    is_active: true,
    email_verified: true,
    mfa_enabled: false,
    last_login_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: UserCreateInput = {
      email: 'new@example.com',
      password: 'password123',
      first_name: 'Jane',
      last_name: 'Smith',
      role: UserRole.ASSESSOR,
      organisation: 'Test Corp',
      expertise_tags: ['research', 'science'],
    };

    it('should create a new user with hashed password', async () => {
      mockHash.mockResolvedValue('hashed_password_new');
      mockQuery.mockResolvedValue({
        rows: [{ ...mockUser, user_id: 'mock-uuid-12345', email: 'new@example.com' }],
      });

      const result = await UserModel.create(createInput);

      expect(mockHash).toHaveBeenCalledWith('password123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          'new@example.com',
          'hashed_password_new',
          'Jane',
          'Smith',
          UserRole.ASSESSOR,
          'Test Corp',
          ['research', 'science'],
        ])
      );
      expect(result.email).toBe('new@example.com');
    });

    it('should lowercase the email address', async () => {
      mockHash.mockResolvedValue('hashed_password');
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.create({
        ...createInput,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test@example.com'])
      );
    });

    it('should handle missing optional fields', async () => {
      mockHash.mockResolvedValue('hashed_password');
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.create({
        email: 'minimal@example.com',
        password: 'pass123',
        first_name: 'Min',
        last_name: 'User',
        role: UserRole.APPLICANT,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null, null]) // organisation and expertise_tags
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await UserModel.findById('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE user_id = $1',
        ['user-123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await UserModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await UserModel.findByEmail('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should lowercase the email for search', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.findByEmail('TEST@EXAMPLE.COM');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
    });

    it('should return null when email not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await UserModel.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      const updateInput: UserUpdateInput = {
        first_name: 'Updated',
        last_name: 'Name',
      };
      mockQuery.mockResolvedValue({
        rows: [{ ...mockUser, first_name: 'Updated', last_name: 'Name' }],
      });

      const result = await UserModel.update('user-123', updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['Updated', 'Name', 'user-123'])
      );
      expect(result?.first_name).toBe('Updated');
    });

    it('should lowercase email when updating', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.update('user-123', { email: 'UPPER@CASE.COM' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['upper@case.com'])
      );
    });

    it('should return existing user when no fields to update', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });
      const findByIdSpy = jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);

      const result = await UserModel.update('user-123', {});

      expect(result).toEqual(mockUser);
      findByIdSpy.mockRestore();
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await UserModel.update('nonexistent', { first_name: 'Test' });

      expect(result).toBeNull();
    });

    it('should update organisation field', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.update('user-123', { organisation: 'New Org' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('organisation'),
        expect.arrayContaining(['New Org'])
      );
    });

    it('should update expertise_tags field', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.update('user-123', { expertise_tags: ['new', 'tags'] });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('expertise_tags'),
        expect.arrayContaining([['new', 'tags']])
      );
    });

    it('should update is_active field', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.update('user-123', { is_active: false });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([false])
      );
    });
  });

  describe('updatePassword', () => {
    it('should hash and update password', async () => {
      mockHash.mockResolvedValue('new_hashed_password');
      mockQuery.mockResolvedValue({ rows: [] });

      await UserModel.updatePassword('user-123', 'newPassword123');

      expect(mockHash).toHaveBeenCalledWith('newPassword123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        ['new_hashed_password', 'user-123']
      );
    });
  });

  describe('verifyPassword', () => {
    it('should return true when password matches', async () => {
      mockCompare.mockResolvedValue(true);

      const result = await UserModel.verifyPassword(mockUser, 'correctPassword');

      expect(mockCompare).toHaveBeenCalledWith('correctPassword', 'hashed_password');
      expect(result).toBe(true);
    });

    it('should return false when password does not match', async () => {
      mockCompare.mockResolvedValue(false);

      const result = await UserModel.verifyPassword(mockUser, 'wrongPassword');

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await UserModel.updateLastLogin('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
        ['user-123']
      );
    });
  });

  describe('findByRole', () => {
    it('should return active users by role', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await UserModel.findByRole(UserRole.ASSESSOR);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1'),
        [UserRole.ASSESSOR]
      );
      expect(mockQuery.mock.calls[0][0]).toContain('is_active = true');
      expect(result).toHaveLength(1);
    });

    it('should include inactive users when activeOnly is false', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await UserModel.findByRole(UserRole.ASSESSOR, false);

      expect(mockQuery.mock.calls[0][0]).not.toContain('is_active = true');
    });
  });

  describe('findAssessorsByExpertise', () => {
    it('should find assessors by expertise tags', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await UserModel.findAssessorsByExpertise(['research', 'science']);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('expertise_tags && $2'),
        [UserRole.ASSESSOR, ['research', 'science']]
      );
      expect(result).toHaveLength(1);
    });

    it('should include inactive assessors when activeOnly is false', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await UserModel.findAssessorsByExpertise(['tag1'], false);

      expect(mockQuery.mock.calls[0][0]).not.toContain('is_active = true');
    });
  });

  describe('list', () => {
    it('should list users with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [mockUser] });

      const result = await UserModel.list({ page: 2, limit: 10 });

      expect(result.total).toBe(50);
      expect(result.users).toHaveLength(1);
      expect(mockQuery.mock.calls[1][1]).toContain(10); // limit
      expect(mockQuery.mock.calls[1][1]).toContain(10); // offset (page 2, limit 10)
    });

    it('should filter by role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await UserModel.list({ role: UserRole.COORDINATOR });

      expect(mockQuery.mock.calls[0][0]).toContain('role = $1');
      expect(mockQuery.mock.calls[0][1]).toContain(UserRole.COORDINATOR);
    });

    it('should filter by search term', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await UserModel.list({ search: 'john' });

      expect(mockQuery.mock.calls[0][0]).toContain('email ILIKE');
      expect(mockQuery.mock.calls[0][0]).toContain('first_name ILIKE');
      expect(mockQuery.mock.calls[0][0]).toContain('last_name ILIKE');
      expect(mockQuery.mock.calls[0][1]).toContain('%john%');
    });

    it('should include inactive users when activeOnly is false', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await UserModel.list({ activeOnly: false });

      expect(mockQuery.mock.calls[0][0]).not.toContain('is_active = true');
    });

    it('should use default pagination values', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await UserModel.list();

      // Default limit is 20, offset is 0
      expect(mockQuery.mock.calls[1][1]).toContain(20);
      expect(mockQuery.mock.calls[1][1]).toContain(0);
    });
  });

  describe('delete', () => {
    it('should soft delete user by setting is_active to false', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await UserModel.delete('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE user_id = $1',
        ['user-123']
      );
    });
  });

  describe('emailExists', () => {
    it('should return true when email exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await UserModel.emailExists('existing@example.com');

      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await UserModel.emailExists('new@example.com');

      expect(result).toBe(false);
    });

    it('should exclude specified user ID from check', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      await UserModel.emailExists('test@example.com', 'user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND user_id != $2'),
        ['test@example.com', 'user-123']
      );
    });
  });

  describe('verifyEmail', () => {
    it('should set email_verified to true', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await UserModel.verifyEmail('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET email_verified = true, updated_at = NOW() WHERE user_id = $1',
        ['user-123']
      );
    });
  });

  describe('toPublic', () => {
    it('should strip sensitive data from user', () => {
      const publicUser = UserModel.toPublic(mockUser);

      expect(publicUser).not.toHaveProperty('password_hash');
      expect(publicUser).not.toHaveProperty('email_verified');
      expect(publicUser).not.toHaveProperty('mfa_enabled');
      expect(publicUser).not.toHaveProperty('last_login_at');
      expect(publicUser).not.toHaveProperty('updated_at');

      expect(publicUser.user_id).toBe(mockUser.user_id);
      expect(publicUser.email).toBe(mockUser.email);
      expect(publicUser.first_name).toBe(mockUser.first_name);
      expect(publicUser.last_name).toBe(mockUser.last_name);
      expect(publicUser.role).toBe(mockUser.role);
      expect(publicUser.organisation).toBe(mockUser.organisation);
      expect(publicUser.expertise_tags).toEqual(mockUser.expertise_tags);
      expect(publicUser.is_active).toBe(mockUser.is_active);
      expect(publicUser.created_at).toBe(mockUser.created_at);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(UserModel.findById('user-123')).rejects.toThrow('Database connection failed');
    });

    it('should propagate bcrypt hash errors', async () => {
      const hashError = new Error('Hashing failed');
      mockHash.mockRejectedValue(hashError);

      await expect(
        UserModel.create({
          email: 'test@example.com',
          password: 'test',
          first_name: 'Test',
          last_name: 'User',
          role: UserRole.APPLICANT,
        })
      ).rejects.toThrow('Hashing failed');
    });
  });
});
