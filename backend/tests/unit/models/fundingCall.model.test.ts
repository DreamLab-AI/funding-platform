/**
 * FundingCall Model Unit Tests
 *
 * Tests call creation, status transitions, criteria management, and assessor pool
 */

import { FundingCallModel } from '../../../src/models/fundingCall.model';
import {
  CallStatus,
  FundingCall,
  FundingCallCreateInput,
  FundingCallUpdateInput,
  Criterion,
  ConfirmationType,
} from '../../../src/types';
import * as database from '../../../src/config/database';

// Mock the database module
jest.mock('../../../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock UUID - must match the actual import path used by the model
jest.mock('../../../src/utils/helpers', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Also mock uuid directly as it may be used
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('FundingCallModel', () => {
  const mockQuery = database.query as jest.Mock;
  const mockTransaction = database.transaction as jest.Mock;

  const mockCriteria: Criterion[] = [
    {
      criterion_id: 'crit-1',
      name: 'Innovation',
      description: 'Level of innovation',
      max_points: 10,
      weight: 0.3,
      comments_required: true,
      order: 0,
    },
    {
      criterion_id: 'crit-2',
      name: 'Impact',
      description: 'Potential impact',
      max_points: 10,
      weight: 0.7,
      comments_required: false,
      order: 1,
    },
  ];

  const mockCall: FundingCall = {
    call_id: 'call-123',
    name: 'Test Funding Call',
    description: 'A test funding call',
    open_at: new Date('2025-01-01'),
    close_at: new Date('2025-12-31'),
    status: CallStatus.DRAFT,
    submission_requirements: {
      allowed_file_types: ['.pdf', '.doc'],
      max_file_size: 10485760,
      required_confirmations: [ConfirmationType.GUIDANCE_READ],
      guidance_text: 'Please read the guidance',
    },
    criteria: mockCriteria,
    required_assessors_per_application: 2,
    variance_threshold: 15,
    retention_years: 7,
    created_by: 'user-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: FundingCallCreateInput = {
      name: 'New Funding Call',
      description: 'Description of the call',
      open_at: new Date('2025-02-01'),
      close_at: new Date('2025-06-30'),
      submission_requirements: {
        allowed_file_types: ['.pdf'],
        max_file_size: 5242880,
        required_confirmations: [ConfirmationType.GUIDANCE_READ, ConfirmationType.DATA_SHARING_CONSENT],
      },
      criteria: [
        { name: 'Quality', description: 'Quality of proposal', max_points: 10, weight: 1, comments_required: true, order: 0 },
      ],
      required_assessors_per_application: 3,
      variance_threshold: 20,
      retention_years: 5,
    };

    it('should create a new funding call with criteria IDs', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...mockCall, submission_requirements: JSON.stringify(mockCall.submission_requirements), criteria: JSON.stringify(mockCall.criteria) }],
        }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await FundingCallModel.create(createInput, 'user-123');

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO funding_calls'),
        expect.arrayContaining([
          'New Funding Call',
          'Description of the call',
        ])
      );
      expect(result.status).toBe(CallStatus.DRAFT);
    });

    it('should parse JSON fields from database response', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            ...mockCall,
            submission_requirements: JSON.stringify(mockCall.submission_requirements),
            criteria: JSON.stringify(mockCall.criteria),
          }],
        }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await FundingCallModel.create(createInput, 'user-123');

      expect(typeof result.submission_requirements).toBe('object');
      expect(Array.isArray(result.criteria)).toBe(true);
    });

    it('should assign order to criteria if not provided', async () => {
      const inputWithoutOrder: FundingCallCreateInput = {
        ...createInput,
        criteria: [
          { name: 'First', description: '', max_points: 5, weight: 0.5, comments_required: false },
          { name: 'Second', description: '', max_points: 5, weight: 0.5, comments_required: false },
        ],
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...mockCall, submission_requirements: '{}', criteria: '[]' }],
        }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      await FundingCallModel.create(inputWithoutOrder, 'user-123');

      const queryArgs = mockClient.query.mock.calls[0][1];
      const criteriaArg = JSON.parse(queryArgs[7]);
      expect(criteriaArg[0].order).toBe(0);
      expect(criteriaArg[1].order).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return funding call when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          ...mockCall,
          submission_requirements: JSON.stringify(mockCall.submission_requirements),
          criteria: JSON.stringify(mockCall.criteria),
        }],
      });

      const result = await FundingCallModel.findById('call-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM funding_calls WHERE call_id = $1',
        ['call-123']
      );
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Funding Call');
    });

    it('should return null when call not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await FundingCallModel.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should parse JSON fields correctly', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          ...mockCall,
          submission_requirements: JSON.stringify(mockCall.submission_requirements),
          criteria: JSON.stringify(mockCall.criteria),
        }],
      });

      const result = await FundingCallModel.findById('call-123');

      expect(typeof result?.submission_requirements).toBe('object');
      expect(Array.isArray(result?.criteria)).toBe(true);
      expect(result?.criteria[0].criterion_id).toBe('crit-1');
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      const updateInput: FundingCallUpdateInput = {
        name: 'Updated Call Name',
        description: 'Updated description',
      };

      mockQuery.mockResolvedValue({
        rows: [{
          ...mockCall,
          name: 'Updated Call Name',
          submission_requirements: JSON.stringify(mockCall.submission_requirements),
          criteria: JSON.stringify(mockCall.criteria),
        }],
      });

      const result = await FundingCallModel.update('call-123', updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE funding_calls SET'),
        expect.arrayContaining(['Updated Call Name', 'Updated description'])
      );
      expect(result?.name).toBe('Updated Call Name');
    });

    it('should stringify JSON fields when updating', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          ...mockCall,
          submission_requirements: JSON.stringify(mockCall.submission_requirements),
          criteria: JSON.stringify(mockCall.criteria),
        }],
      });

      await FundingCallModel.update('call-123', {
        submission_requirements: { allowed_file_types: ['.pdf'], max_file_size: 1000, required_confirmations: [] },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('submission_requirements'),
        expect.arrayContaining([expect.any(String)])
      );
    });

    it('should return null when call not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await FundingCallModel.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should return existing call when no fields to update', async () => {
      const findByIdSpy = jest.spyOn(FundingCallModel, 'findById').mockResolvedValue(mockCall);

      const result = await FundingCallModel.update('call-123', {});

      expect(result).toEqual(mockCall);
      findByIdSpy.mockRestore();
    });

    it('should update all optional fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          ...mockCall,
          submission_requirements: JSON.stringify(mockCall.submission_requirements),
          criteria: JSON.stringify(mockCall.criteria),
        }],
      });

      await FundingCallModel.update('call-123', {
        open_at: new Date(),
        close_at: new Date(),
        status: CallStatus.OPEN,
        required_assessors_per_application: 5,
        variance_threshold: 25,
        retention_years: 10,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('open_at'),
        expect.any(Array)
      );
    });
  });

  describe('updateStatus', () => {
    it('should update call status', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await FundingCallModel.updateStatus('call-123', CallStatus.OPEN);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE funding_calls SET status = $1, updated_at = NOW() WHERE call_id = $2',
        [CallStatus.OPEN, 'call-123']
      );
    });
  });

  describe('list', () => {
    it('should list calls with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] })
        .mockResolvedValueOnce({ rows: [{ ...mockCall, application_count: 5, assessor_count: 3 }] });

      const result = await FundingCallModel.list({ page: 1, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.calls).toHaveLength(1);
    });

    it('should filter by single status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await FundingCallModel.list({ status: CallStatus.OPEN });

      expect(mockQuery.mock.calls[0][0]).toContain('fc.status = $1');
    });

    it('should filter by multiple statuses', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }] })
        .mockResolvedValueOnce({ rows: [] });

      await FundingCallModel.list({ status: [CallStatus.OPEN, CallStatus.CLOSED] });

      expect(mockQuery.mock.calls[0][0]).toContain('fc.status = ANY($1)');
    });

    it('should filter by search term', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await FundingCallModel.list({ search: 'innovation' });

      expect(mockQuery.mock.calls[0][0]).toContain('fc.name ILIKE');
      expect(mockQuery.mock.calls[0][0]).toContain('fc.description ILIKE');
    });
  });

  describe('listOpen', () => {
    it('should list open calls that have not closed', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...mockCall, status: CallStatus.OPEN }] });

      const result = await FundingCallModel.listOpen();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('fc.status = $1 AND fc.close_at > NOW()'),
        [CallStatus.OPEN]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('clone', () => {
    it('should clone a funding call with new IDs', async () => {
      const findByIdSpy = jest.spyOn(FundingCallModel, 'findById').mockResolvedValue(mockCall);

      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            ...mockCall,
            call_id: 'mock-uuid-12345',
            name: 'Cloned Call',
            submission_requirements: JSON.stringify(mockCall.submission_requirements),
            criteria: JSON.stringify(mockCall.criteria),
          }],
        }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await FundingCallModel.clone('call-123', 'Cloned Call', 'user-456');

      expect(findByIdSpy).toHaveBeenCalledWith('call-123');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO funding_calls'),
        expect.arrayContaining(['Cloned Call'])
      );
      expect(result.status).toBe(CallStatus.DRAFT);

      findByIdSpy.mockRestore();
    });

    it('should throw error when source call not found', async () => {
      const findByIdSpy = jest.spyOn(FundingCallModel, 'findById').mockResolvedValue(null);

      await expect(FundingCallModel.clone('nonexistent', 'New Name', 'user-123')).rejects.toThrow(
        'Source call not found'
      );

      findByIdSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('should delete funding call', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await FundingCallModel.delete('call-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM funding_calls WHERE call_id = $1',
        ['call-123']
      );
    });
  });

  describe('Assessor Pool Methods', () => {
    describe('addAssessorToPool', () => {
      it('should add assessor to pool', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            pool_id: 'mock-uuid-12345',
            call_id: 'call-123',
            user_id: 'user-456',
            is_active: true,
          }],
        });

        const result = await FundingCallModel.addAssessorToPool('call-123', 'user-456', ['research']);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO assessor_pool'),
          expect.arrayContaining(['call-123', 'user-456', ['research']])
        );
        expect(result.is_active).toBe(true);
      });

      it('should handle upsert on conflict', async () => {
        mockQuery.mockResolvedValue({ rows: [{ pool_id: 'pool-1', is_active: true }] });

        await FundingCallModel.addAssessorToPool('call-123', 'user-456');

        expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT');
      });
    });

    describe('removeAssessorFromPool', () => {
      it('should set assessor as inactive in pool', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await FundingCallModel.removeAssessorFromPool('call-123', 'user-456');

        expect(mockQuery).toHaveBeenCalledWith(
          'UPDATE assessor_pool SET is_active = false WHERE call_id = $1 AND user_id = $2',
          ['call-123', 'user-456']
        );
      });
    });

    describe('getAssessorPool', () => {
      it('should return active assessors in pool', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            { user_id: 'user-1', first_name: 'John', last_name: 'Doe' },
            { user_id: 'user-2', first_name: 'Jane', last_name: 'Smith' },
          ],
        });

        const result = await FundingCallModel.getAssessorPool('call-123');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ap.is_active = true'),
          ['call-123']
        );
        expect(result).toHaveLength(2);
      });
    });

    describe('isInAssessorPool', () => {
      it('should return true when user is in pool', async () => {
        mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

        const result = await FundingCallModel.isInAssessorPool('call-123', 'user-456');

        expect(result).toBe(true);
      });

      it('should return false when user is not in pool', async () => {
        mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

        const result = await FundingCallModel.isInAssessorPool('call-123', 'user-789');

        expect(result).toBe(false);
      });
    });
  });

  describe('getCriterion', () => {
    it('should find criterion by ID', () => {
      const result = FundingCallModel.getCriterion(mockCall, 'crit-1');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Innovation');
    });

    it('should return undefined when criterion not found', () => {
      const result = FundingCallModel.getCriterion(mockCall, 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('isValidStatusTransition', () => {
    it('should allow DRAFT to OPEN transition', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.DRAFT, CallStatus.OPEN)).toBe(true);
    });

    it('should allow OPEN to CLOSED transition', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.OPEN, CallStatus.CLOSED)).toBe(true);
    });

    it('should allow CLOSED to IN_ASSESSMENT transition', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.CLOSED, CallStatus.IN_ASSESSMENT)).toBe(true);
    });

    it('should allow IN_ASSESSMENT to COMPLETED transition', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.IN_ASSESSMENT, CallStatus.COMPLETED)).toBe(true);
    });

    it('should allow COMPLETED to ARCHIVED transition', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.COMPLETED, CallStatus.ARCHIVED)).toBe(true);
    });

    it('should reject invalid transition from DRAFT to CLOSED', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.DRAFT, CallStatus.CLOSED)).toBe(false);
    });

    it('should reject transition from ARCHIVED', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.ARCHIVED, CallStatus.COMPLETED)).toBe(false);
    });

    it('should reject backwards transitions', () => {
      expect(FundingCallModel.isValidStatusTransition(CallStatus.OPEN, CallStatus.DRAFT)).toBe(false);
      expect(FundingCallModel.isValidStatusTransition(CallStatus.COMPLETED, CallStatus.IN_ASSESSMENT)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(FundingCallModel.findById('call-123')).rejects.toThrow('Connection failed');
    });

    it('should handle transaction errors', async () => {
      const txError = new Error('Transaction failed');
      mockTransaction.mockRejectedValue(txError);

      await expect(
        FundingCallModel.create(
          {
            name: 'Test',
            description: '',
            open_at: new Date(),
            close_at: new Date(),
            submission_requirements: { allowed_file_types: [], max_file_size: 0, required_confirmations: [] },
            criteria: [],
            required_assessors_per_application: 1,
          },
          'user-123'
        )
      ).rejects.toThrow('Transaction failed');
    });
  });
});
