/**
 * Calls Controller Unit Tests
 * Tests for funding call management including CRUD, status transitions, and assessor pool
 */

import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from '../../helpers/testUtils';
import { UserRole, CallStatus, AuthenticatedUser } from '../../../src/types';

// Helper to flush promises - asyncHandler returns void
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock dependencies
jest.mock('../../../src/models/fundingCall.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/middleware/audit.middleware');
jest.mock('../../../src/utils/validation', () => {
  const original = jest.requireActual('../../../src/utils/validation');
  return {
    ...original,
    fundingCallCreateSchema: {
      parse: jest.fn((data) => data),
    },
    fundingCallUpdateSchema: {
      parse: jest.fn((data) => data),
    },
    paginationSchema: {
      parse: jest.fn((data) => ({
        page: Number(data.page) || 1,
        limit: Number(data.limit) || 20,
        sort_order: data.sort_order || 'asc',
        sort_by: data.sort_by
      })),
    },
    assessorPoolAddSchema: {
      parse: jest.fn((data) => data),
    },
    assessorInviteSchema: {
      parse: jest.fn((data) => data),
    },
  };
});

import { FundingCallModel } from '../../../src/models/fundingCall.model';
import { UserModel } from '../../../src/models/user.model';
import { createAuditLog } from '../../../src/middleware/audit.middleware';
import {
  createCall,
  getCall,
  listCalls,
  listOpenCalls,
  updateCall,
  updateCallStatus,
  cloneCall,
  deleteCall,
  getAssessorPool,
  addAssessorToPool,
  removeAssessorFromPool,
  inviteAssessor,
} from '../../../src/controllers/calls.controller';

describe('Calls Controller', () => {
  let mockReq: any;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  const mockUserId = uuidv4();
  const mockCallId = uuidv4();

  const mockAuthUser: AuthenticatedUser = {
    user_id: mockUserId,
    id: mockUserId,
    email: 'coordinator@example.com',
    role: UserRole.COORDINATOR,
    first_name: 'Test',
    last_name: 'Coordinator',
  };

  const mockCall = {
    call_id: mockCallId,
    name: 'Test Funding Call',
    description: 'A test funding call',
    open_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: CallStatus.DRAFT,
    submission_requirements: {
      allowed_file_types: ['.pdf'],
      max_file_size: 10485760,
      required_confirmations: [],
    },
    criteria: [
      { criterion_id: 'c1', name: 'Innovation', max_points: 10, order: 1, comments_required: false },
    ],
    required_assessors_per_application: 2,
    retention_years: 7,
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = mockAuthUser;

    (createAuditLog as jest.Mock).mockResolvedValue(undefined);
    (UserModel.toPublic as jest.Mock).mockImplementation((user) => ({
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    }));
  });

  // =========================================================================
  // CREATE CALL TESTS
  // =========================================================================

  describe('createCall', () => {
    const createData = {
      name: 'New Funding Call',
      description: 'Description',
      open_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      submission_requirements: {
        allowed_file_types: ['.pdf'],
        max_file_size: 10485760,
        required_confirmations: [],
      },
      criteria: [{ name: 'Quality', max_points: 10, order: 1 }],
      required_assessors_per_application: 2,
    };

    it('should create funding call successfully (201)', async () => {
      mockReq.body = createData;
      (FundingCallModel.create as jest.Mock).mockResolvedValue(mockCall);

      createCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.create).toHaveBeenCalledWith(createData, mockUserId);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCall,
      });
    });

    it('should throw 403 AuthorizationError when user not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.body = createData;

      createCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('should create audit log on successful creation', async () => {
      mockReq.body = createData;
      (FundingCallModel.create as jest.Mock).mockResolvedValue(mockCall);

      createCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(createAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'call',
        mockCall.call_id,
        expect.objectContaining({ name: mockCall.name })
      );
    });
  });

  // =========================================================================
  // GET CALL TESTS
  // =========================================================================

  describe('getCall', () => {
    it('should return funding call by ID (200)', async () => {
      mockReq.params = { callId: mockCallId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);

      getCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.findById).toHaveBeenCalledWith(mockCallId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCall,
      });
    });

    it('should throw 404 NotFoundError when call not found', async () => {
      mockReq.params = { callId: mockCallId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      getCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // LIST CALLS TESTS
  // =========================================================================

  describe('listCalls', () => {
    it('should list funding calls with pagination (200)', async () => {
      mockReq.query = { page: '1', limit: '20' };
      const calls = [mockCall];
      (FundingCallModel.list as jest.Mock).mockResolvedValue({ calls, total: 1 });

      listCalls(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: calls,
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should filter by status', async () => {
      mockReq.query = { status: CallStatus.OPEN };
      (FundingCallModel.list as jest.Mock).mockResolvedValue({ calls: [], total: 0 });

      listCalls(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: CallStatus.OPEN })
      );
    });

    it('should filter by search term', async () => {
      mockReq.query = { search: 'innovation' };
      (FundingCallModel.list as jest.Mock).mockResolvedValue({ calls: [], total: 0 });

      listCalls(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'innovation' })
      );
    });
  });

  // =========================================================================
  // LIST OPEN CALLS TESTS
  // =========================================================================

  describe('listOpenCalls', () => {
    it('should list only open funding calls (200)', async () => {
      const openCalls = [{ ...mockCall, status: CallStatus.OPEN }];
      (FundingCallModel.listOpen as jest.Mock).mockResolvedValue(openCalls);

      await listOpenCalls(mockReq, mockRes, mockNext);

      expect(FundingCallModel.listOpen).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: openCalls,
      });
    });
  });

  // =========================================================================
  // UPDATE CALL TESTS
  // =========================================================================

  describe('updateCall', () => {
    const updateData = {
      name: 'Updated Call Name',
      description: 'Updated description',
    };

    it('should update funding call successfully (200)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = updateData;
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.update as jest.Mock).mockResolvedValue({ ...mockCall, ...updateData });

      updateCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.update).toHaveBeenCalledWith(mockCallId, updateData);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining(updateData),
      });
    });

    it('should throw 404 when call not found', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = updateData;
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      updateCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });

    it('should throw 403 when user not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { callId: mockCallId };
      mockReq.body = updateData;

      updateCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });

    it('should validate status transitions', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: CallStatus.COMPLETED }; // Invalid transition from DRAFT
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.isValidStatusTransition as jest.Mock).mockReturnValue(false);

      updateCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('Invalid status transition'),
        })
      );
    });

    it('should allow valid status transitions', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: CallStatus.OPEN };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
      (FundingCallModel.update as jest.Mock).mockResolvedValue({ ...mockCall, status: CallStatus.OPEN });

      updateCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ status: CallStatus.OPEN }),
      });
    });
  });

  // =========================================================================
  // UPDATE CALL STATUS TESTS
  // =========================================================================

  describe('updateCallStatus', () => {
    it('should update call status successfully (200)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: CallStatus.OPEN };
      (FundingCallModel.findById as jest.Mock)
        .mockResolvedValueOnce(mockCall)
        .mockResolvedValueOnce({ ...mockCall, status: CallStatus.OPEN });
      (FundingCallModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
      (FundingCallModel.updateStatus as jest.Mock).mockResolvedValue(undefined);

      updateCallStatus(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.updateStatus).toHaveBeenCalledWith(mockCallId, CallStatus.OPEN);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ status: CallStatus.OPEN }),
      });
    });

    it('should throw 400 ValidationError for invalid status', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: 'invalid_status' };

      updateCallStatus(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Invalid status',
        })
      );
    });

    it('should throw 400 ValidationError for invalid transition', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: CallStatus.ARCHIVED };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.isValidStatusTransition as jest.Mock).mockReturnValue(false);

      updateCallStatus(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('Invalid status transition'),
        })
      );
    });

    it('should create audit log with status change details', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { status: CallStatus.OPEN };
      (FundingCallModel.findById as jest.Mock)
        .mockResolvedValueOnce(mockCall)
        .mockResolvedValueOnce({ ...mockCall, status: CallStatus.OPEN });
      (FundingCallModel.isValidStatusTransition as jest.Mock).mockReturnValue(true);
      (FundingCallModel.updateStatus as jest.Mock).mockResolvedValue(undefined);

      updateCallStatus(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(createAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'call',
        mockCallId,
        expect.objectContaining({ from: CallStatus.DRAFT, to: CallStatus.OPEN })
      );
    });
  });

  // =========================================================================
  // CLONE CALL TESTS
  // =========================================================================

  describe('cloneCall', () => {
    it('should clone funding call successfully (201)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { name: 'Cloned Call' };
      const clonedCall = { ...mockCall, call_id: uuidv4(), name: 'Cloned Call' };
      (FundingCallModel.clone as jest.Mock).mockResolvedValue(clonedCall);

      cloneCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.clone).toHaveBeenCalledWith(mockCallId, 'Cloned Call', mockUserId);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: clonedCall,
      });
    });

    it('should throw 400 ValidationError when name is missing', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = {};

      cloneCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'New call name is required',
        })
      );
    });

    it('should create audit log with source call ID', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = { name: 'Cloned Call' };
      const clonedCall = { ...mockCall, call_id: 'cloned-id', name: 'Cloned Call' };
      (FundingCallModel.clone as jest.Mock).mockResolvedValue(clonedCall);

      cloneCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(createAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'call',
        clonedCall.call_id,
        expect.objectContaining({ source_call_id: mockCallId })
      );
    });
  });

  // =========================================================================
  // DELETE CALL TESTS
  // =========================================================================

  describe('deleteCall', () => {
    it('should delete draft call successfully (200)', async () => {
      mockReq.params = { callId: mockCallId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.delete as jest.Mock).mockResolvedValue(undefined);

      deleteCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.delete).toHaveBeenCalledWith(mockCallId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Funding call deleted' },
      });
    });

    it('should throw 404 when call not found', async () => {
      mockReq.params = { callId: mockCallId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      deleteCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });

    it('should throw 400 when trying to delete non-draft call', async () => {
      mockReq.params = { callId: mockCallId };
      const openCall = { ...mockCall, status: CallStatus.OPEN };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(openCall);

      deleteCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Only draft calls can be deleted',
        })
      );
    });
  });

  // =========================================================================
  // ASSESSOR POOL TESTS
  // =========================================================================

  describe('getAssessorPool', () => {
    it('should return assessor pool for call (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const assessors = [
        { user_id: uuidv4(), email: 'assessor1@example.com' },
        { user_id: uuidv4(), email: 'assessor2@example.com' },
      ];
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.getAssessorPool as jest.Mock).mockResolvedValue(assessors);

      getAssessorPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assessors,
      });
    });

    it('should throw 404 when call not found', async () => {
      mockReq.params = { callId: mockCallId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      getAssessorPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  describe('addAssessorToPool', () => {
    const assessorId = uuidv4();
    const addData = { user_id: assessorId, expertise_tags: ['AI', 'ML'] };

    it('should add assessor to pool successfully (201)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = addData;
      const assessorUser = {
        user_id: assessorId,
        email: 'assessor@example.com',
        role: UserRole.ASSESSOR,
      };
      const poolMember = { ...addData, call_id: mockCallId };

      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (UserModel.findById as jest.Mock).mockResolvedValue(assessorUser);
      (FundingCallModel.addAssessorToPool as jest.Mock).mockResolvedValue(poolMember);

      addAssessorToPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: poolMember,
      });
    });

    it('should throw 404 when user not found', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = addData;
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (UserModel.findById as jest.Mock).mockResolvedValue(null);

      addAssessorToPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });

    it('should throw 400 when user is not an assessor', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = addData;
      const applicantUser = { user_id: assessorId, role: UserRole.APPLICANT };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (UserModel.findById as jest.Mock).mockResolvedValue(applicantUser);

      addAssessorToPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'User must have assessor role',
        })
      );
    });
  });

  describe('removeAssessorFromPool', () => {
    const assessorId = uuidv4();

    it('should remove assessor from pool successfully (200)', async () => {
      mockReq.params = { callId: mockCallId, userId: assessorId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (FundingCallModel.removeAssessorFromPool as jest.Mock).mockResolvedValue(undefined);

      removeAssessorFromPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(FundingCallModel.removeAssessorFromPool).toHaveBeenCalledWith(mockCallId, assessorId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Assessor removed from pool' },
      });
    });

    it('should throw 404 when call not found', async () => {
      mockReq.params = { callId: mockCallId, userId: assessorId };
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      removeAssessorFromPool(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  describe('inviteAssessor', () => {
    const inviteData = {
      email: 'newassessor@example.com',
      first_name: 'New',
      last_name: 'Assessor',
      organisation: 'Test Org',
      expertise_tags: ['Research'],
    };

    it('should create new user and add to pool (201)', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = inviteData;
      const newUser = { user_id: uuidv4(), ...inviteData, role: UserRole.ASSESSOR };
      const poolMember = { user_id: newUser.user_id, call_id: mockCallId };

      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      (UserModel.create as jest.Mock).mockResolvedValue(newUser);
      (FundingCallModel.addAssessorToPool as jest.Mock).mockResolvedValue(poolMember);

      inviteAssessor(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(UserModel.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should add existing user to pool without creating new user', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = inviteData;
      const existingUser = { user_id: uuidv4(), ...inviteData, role: UserRole.ASSESSOR };
      const poolMember = { user_id: existingUser.user_id, call_id: mockCallId };

      (FundingCallModel.findById as jest.Mock).mockResolvedValue(mockCall);
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(existingUser);
      (FundingCallModel.addAssessorToPool as jest.Mock).mockResolvedValue(poolMember);

      inviteAssessor(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(UserModel.create).not.toHaveBeenCalled();
      expect(FundingCallModel.addAssessorToPool).toHaveBeenCalledWith(
        mockCallId,
        existingUser.user_id,
        inviteData.expertise_tags
      );
    });

    it('should throw 404 when call not found', async () => {
      mockReq.params = { callId: mockCallId };
      mockReq.body = inviteData;
      (FundingCallModel.findById as jest.Mock).mockResolvedValue(null);

      inviteAssessor(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // ERROR HANDLING TESTS
  // =========================================================================

  describe('Error Handling', () => {
    it('should pass database errors to error handler (500)', async () => {
      mockReq.query = {};
      const dbError = new Error('Database connection failed');
      (FundingCallModel.list as jest.Mock).mockRejectedValue(dbError);

      listCalls(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
