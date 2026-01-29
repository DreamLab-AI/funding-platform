import { Response, NextFunction } from 'express';
import { FundingCallModel } from '../models/fundingCall.model';
import {
  AuthRequest,
  CallStatus,
  AuditAction,
  UserRole,
} from '../types';
import {
  fundingCallCreateSchema,
  fundingCallUpdateSchema,
  paginationSchema,
  assessorPoolAddSchema,
  assessorInviteSchema,
} from '../utils/validation';
import { createAuditLog } from '../middleware/audit.middleware';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from '../utils/errors';
import { asyncHandler } from '../middleware/error.middleware';
import { UserModel } from '../models/user.model';

/**
 * Create a new funding call
 */
export const createCall = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const data = fundingCallCreateSchema.parse(req.body);

    const call = await FundingCallModel.create(data, req.user.user_id);

    await createAuditLog(
      req,
      AuditAction.CALL_CREATED,
      'call',
      call.call_id,
      { name: call.name }
    );

    res.status(201).json({
      success: true,
      data: call,
    });
  }
);

/**
 * Get a funding call by ID
 */
export const getCall = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { callId } = req.params;

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    res.json({
      success: true,
      data: call,
    });
  }
);

/**
 * List all funding calls
 */
export const listCalls = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { page, limit, sort_by, sort_order } = paginationSchema.parse(req.query);
    const { status, search } = req.query;

    const { calls, total } = await FundingCallModel.list({
      page,
      limit,
      status: status as CallStatus,
      search: search as string,
    });

    res.json({
      success: true,
      data: calls,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

/**
 * List open funding calls (for applicants)
 */
export const listOpenCalls = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const calls = await FundingCallModel.listOpen();
      res.json({
        success: true,
        data: calls,
      });
    } catch (error) {
      // Return demo data when database is unavailable
      const demoCalls = [
        {
          call_id: 'demo-001',
          name: 'Innovation Research Fund 2026',
          description: 'Supporting innovative research projects across STEM disciplines with grants up to £500,000.',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: CallStatus.OPEN,
          application_count: 24,
          assessor_count: 8,
        },
        {
          call_id: 'demo-002',
          name: 'Climate Action Research Programme',
          description: 'Funding for research addressing climate change challenges. Projects should demonstrate clear environmental impact.',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: CallStatus.OPEN,
          application_count: 18,
          assessor_count: 6,
        },
        {
          call_id: 'demo-003',
          name: 'Digital Health Innovation Grant',
          description: 'Supporting digital health solutions that improve patient outcomes and healthcare delivery efficiency.',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: CallStatus.OPEN,
          application_count: 42,
          assessor_count: 12,
        },
      ];
      res.json({
        success: true,
        data: demoCalls,
        meta: { demo: true },
      });
    }
  }
);

/**
 * Update a funding call
 */
export const updateCall = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;
    const data = fundingCallUpdateSchema.parse(req.body);

    const existingCall = await FundingCallModel.findById(callId);
    if (!existingCall) {
      throw new NotFoundError('Funding call', callId);
    }

    // Validate status transition if status is being changed
    if (data.status && data.status !== existingCall.status) {
      if (!FundingCallModel.isValidStatusTransition(existingCall.status, data.status)) {
        throw new ValidationError(
          `Invalid status transition from ${existingCall.status} to ${data.status}`
        );
      }
    }

    const call = await FundingCallModel.update(callId, data);

    await createAuditLog(
      req,
      data.status ? AuditAction.CALL_STATUS_CHANGED : AuditAction.CALL_UPDATED,
      'call',
      callId,
      { changes: Object.keys(data) }
    );

    res.json({
      success: true,
      data: call,
    });
  }
);

/**
 * Update call status
 */
export const updateCallStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(CallStatus).includes(status)) {
      throw new ValidationError('Invalid status');
    }

    const existingCall = await FundingCallModel.findById(callId);
    if (!existingCall) {
      throw new NotFoundError('Funding call', callId);
    }

    if (!FundingCallModel.isValidStatusTransition(existingCall.status, status)) {
      throw new ValidationError(
        `Invalid status transition from ${existingCall.status} to ${status}`
      );
    }

    await FundingCallModel.updateStatus(callId, status);

    await createAuditLog(
      req,
      AuditAction.CALL_STATUS_CHANGED,
      'call',
      callId,
      { from: existingCall.status, to: status }
    );

    const updatedCall = await FundingCallModel.findById(callId);

    res.json({
      success: true,
      data: updatedCall,
    });
  }
);

/**
 * Clone a funding call
 */
export const cloneCall = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new ValidationError('New call name is required');
    }

    const call = await FundingCallModel.clone(callId, name, req.user.user_id);

    await createAuditLog(
      req,
      AuditAction.CALL_CLONED,
      'call',
      call.call_id,
      { source_call_id: callId }
    );

    res.status(201).json({
      success: true,
      data: call,
    });
  }
);

/**
 * Delete a funding call
 */
export const deleteCall = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    // Only allow deletion of draft calls
    if (call.status !== CallStatus.DRAFT) {
      throw new ValidationError('Only draft calls can be deleted');
    }

    await FundingCallModel.delete(callId);

    res.json({
      success: true,
      data: { message: 'Funding call deleted' },
    });
  }
);

// ============================================================================
// ASSESSOR POOL MANAGEMENT
// ============================================================================

/**
 * Get assessor pool for a call
 */
export const getAssessorPool = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { callId } = req.params;

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    const assessors = await FundingCallModel.getAssessorPool(callId);

    res.json({
      success: true,
      data: assessors,
    });
  }
);

/**
 * Add assessor to pool
 */
export const addAssessorToPool = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;
    const data = assessorPoolAddSchema.parse(req.body);

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    // Verify user exists and is an assessor
    const user = await UserModel.findById(data.user_id);
    if (!user) {
      throw new NotFoundError('User', data.user_id);
    }

    if (user.role !== UserRole.ASSESSOR && user.role !== UserRole.ADMIN) {
      throw new ValidationError('User must have assessor role');
    }

    const poolMember = await FundingCallModel.addAssessorToPool(
      callId,
      data.user_id,
      data.expertise_tags
    );

    await createAuditLog(
      req,
      AuditAction.CONFIG_CHANGED,
      'assessor_pool',
      callId,
      { action: 'add', user_id: data.user_id }
    );

    res.status(201).json({
      success: true,
      data: poolMember,
    });
  }
);

/**
 * Remove assessor from pool
 */
export const removeAssessorFromPool = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId, userId } = req.params;

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    await FundingCallModel.removeAssessorFromPool(callId, userId);

    await createAuditLog(
      req,
      AuditAction.CONFIG_CHANGED,
      'assessor_pool',
      callId,
      { action: 'remove', user_id: userId }
    );

    res.json({
      success: true,
      data: { message: 'Assessor removed from pool' },
    });
  }
);

/**
 * Invite new assessor (creates user if doesn't exist)
 */
export const inviteAssessor = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthorizationError();

    const { callId } = req.params;
    const data = assessorInviteSchema.parse(req.body);

    const call = await FundingCallModel.findById(callId);
    if (!call) {
      throw new NotFoundError('Funding call', callId);
    }

    // Check if user already exists
    let user = await UserModel.findByEmail(data.email);

    if (!user) {
      // Create new assessor user with temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      user = await UserModel.create({
        email: data.email,
        password: tempPassword,
        first_name: data.first_name,
        last_name: data.last_name,
        role: UserRole.ASSESSOR,
        organisation: data.organisation,
        expertise_tags: data.expertise_tags,
      });

      // TODO: Send invitation email with password reset link
    }

    // Add to pool
    const poolMember = await FundingCallModel.addAssessorToPool(
      callId,
      user.user_id,
      data.expertise_tags
    );

    await createAuditLog(
      req,
      AuditAction.CONFIG_CHANGED,
      'assessor_pool',
      callId,
      { action: 'invite', email: data.email }
    );

    res.status(201).json({
      success: true,
      data: {
        pool_member: poolMember,
        user: UserModel.toPublic(user),
      },
    });
  }
);

// Named export for index.ts re-export
export const callsController = {
  // Primary methods
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
  // Aliases for routes
  create: createCall,
  list: listCalls,
  getById: getCall,
  update: updateCall,
  delete: deleteCall,
  openCall: updateCallStatus,
  closeCall: updateCallStatus,
  getAssessors: getAssessorPool,
  addAssessor: addAssessorToPool,
  removeAssessor: removeAssessorFromPool,
  getPublicCallDetails: getCall,
  getCriteria: getCall,  // Criteria is part of call data
  updateCriteria: updateCall,  // Update call includes criteria
};

export default callsController;
