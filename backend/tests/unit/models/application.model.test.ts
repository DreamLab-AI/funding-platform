/**
 * Application Model Unit Tests
 *
 * Tests application lifecycle, file attachments, confirmations, and query building
 */

import { ApplicationModel } from '../../../src/models/application.model';
import {
  Application,
  ApplicationCreateInput,
  ApplicationUpdateInput,
  ApplicationStatus,
  FileScanStatus,
  ConfirmationType,
  ApplicationFile,
  Confirmation,
} from '../../../src/types';
import * as database from '../../../src/config/database';

// Mock the database module
jest.mock('../../../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock UUID and helpers
jest.mock('../../../src/utils/helpers', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-12345'),
  generateReferenceNumber: jest.fn((callName: string, seq: number) => `2025-${callName.substring(0, 4).toUpperCase()}-${String(seq).padStart(6, '0')}`),
}));

// Also mock uuid directly
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

describe('ApplicationModel', () => {
  const mockQuery = database.query as jest.Mock;
  const mockTransaction = database.transaction as jest.Mock;

  const mockFile: ApplicationFile = {
    file_id: 'file-123',
    application_id: 'app-123',
    filename: 'document.pdf',
    original_filename: 'My Document.pdf',
    file_path: '/uploads/document.pdf',
    file_size: 1048576,
    mime_type: 'application/pdf',
    scan_status: FileScanStatus.CLEAN,
    uploaded_at: new Date(),
  };

  const mockConfirmation: Confirmation = {
    confirmation_id: 'conf-123',
    application_id: 'app-123',
    type: ConfirmationType.GUIDANCE_READ,
    confirmed_at: new Date(),
    ip_address: '192.168.1.1',
  };

  const mockApplication: Application = {
    application_id: 'app-123',
    call_id: 'call-123',
    applicant_id: 'user-123',
    reference_number: '2025-TEST-000001',
    applicant_name: 'John Doe',
    applicant_email: 'john@example.com',
    applicant_organisation: 'Test University',
    status: ApplicationStatus.DRAFT,
    files: [mockFile],
    confirmations: [mockConfirmation],
    submitted_at: undefined,
    withdrawn_at: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: ApplicationCreateInput = {
      call_id: 'call-123',
    };

    it('should create a new application with generated reference number', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // sequence count
          .mockResolvedValueOnce({ rows: [{ name: 'Test Call' }] }) // call name
          .mockResolvedValueOnce({ rows: [mockApplication] }), // insert
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      const result = await ApplicationModel.create(
        createInput,
        'user-123',
        'John Doe',
        'john@example.com',
        'Test Org'
      );

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result.status).toBe(ApplicationStatus.DRAFT);
      expect(result.files).toEqual([]);
      expect(result.confirmations).toEqual([]);
    });

    it('should handle missing organisation', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [{ name: 'Call' }] })
          .mockResolvedValueOnce({ rows: [{ ...mockApplication, applicant_organisation: null }] }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      await ApplicationModel.create(createInput, 'user-123', 'John', 'john@test.com');

      const insertCall = mockClient.query.mock.calls[2];
      expect(insertCall[1]).toContain(null);
    });
  });

  describe('findById', () => {
    it('should return application with files and confirmations', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockApplication] })
        .mockResolvedValueOnce({ rows: [mockFile] })
        .mockResolvedValueOnce({ rows: [mockConfirmation] });

      const result = await ApplicationModel.findById('app-123');

      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM applications WHERE application_id = $1',
        ['app-123']
      );
      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(1);
      expect(result?.confirmations).toHaveLength(1);
    });

    it('should return null when application not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await ApplicationModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByReference', () => {
    it('should find application by reference number', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockApplication] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ApplicationModel.findByReference('2025-TEST-000001');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM applications WHERE reference_number = $1',
        ['2025-TEST-000001']
      );
      expect(result).not.toBeNull();
    });

    it('should return null when reference not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await ApplicationModel.findByReference('INVALID-REF');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update applicant fields', async () => {
      const updateInput: ApplicationUpdateInput = {
        applicant_name: 'Jane Doe',
        applicant_organisation: 'New University',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // update
        .mockResolvedValueOnce({ rows: [{ ...mockApplication, ...updateInput }] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // files
        .mockResolvedValueOnce({ rows: [] }); // confirmations

      const result = await ApplicationModel.update('app-123', updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE applications SET'),
        expect.arrayContaining(['Jane Doe', 'New University'])
      );
      expect(result).not.toBeNull();
    });

    it('should return existing application when no fields to update', async () => {
      const findByIdSpy = jest.spyOn(ApplicationModel, 'findById').mockResolvedValue(mockApplication);

      const result = await ApplicationModel.update('app-123', {});

      expect(result).toEqual(mockApplication);
      findByIdSpy.mockRestore();
    });
  });

  describe('submit', () => {
    it('should update status to submitted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // update
        .mockResolvedValueOnce({ rows: [{ ...mockApplication, status: ApplicationStatus.SUBMITTED }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ApplicationModel.submit('app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $1, submitted_at = NOW()'),
        [ApplicationStatus.SUBMITTED, 'app-123']
      );
      expect(result?.status).toBe(ApplicationStatus.SUBMITTED);
    });
  });

  describe('withdraw', () => {
    it('should update status to withdrawn', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await ApplicationModel.withdraw('app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $1, withdrawn_at = NOW()'),
        [ApplicationStatus.WITHDRAWN, 'app-123']
      );
    });
  });

  describe('reopen', () => {
    it('should update status to reopened and clear submitted_at', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await ApplicationModel.reopen('app-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $1, submitted_at = NULL'),
        [ApplicationStatus.REOPENED, 'app-123']
      );
    });
  });

  describe('listByCall', () => {
    it('should list applications for a call with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({
          rows: [{
            ...mockApplication,
            file_count: 2,
            confirmation_count: 1,
            assignment_count: 2,
            completed_assessments: 1,
          }],
        });

      const result = await ApplicationModel.listByCall('call-123', { page: 1, limit: 20 });

      expect(result.total).toBe(100);
      expect(result.applications).toHaveLength(1);
      expect(result.applications[0].file_count).toBe(2);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await ApplicationModel.listByCall('call-123', { status: ApplicationStatus.SUBMITTED });

      expect(mockQuery.mock.calls[0][0]).toContain('a.status = $2');
    });

    it('should filter by search term', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await ApplicationModel.listByCall('call-123', { search: 'john' });

      expect(mockQuery.mock.calls[0][0]).toContain('a.reference_number ILIKE');
      expect(mockQuery.mock.calls[0][0]).toContain('a.applicant_name ILIKE');
      expect(mockQuery.mock.calls[0][0]).toContain('a.applicant_email ILIKE');
    });
  });

  describe('listByApplicant', () => {
    it('should list applications for an applicant', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [mockApplication] })
        .mockResolvedValueOnce({ rows: [mockFile] })
        .mockResolvedValueOnce({ rows: [mockConfirmation] });

      const result = await ApplicationModel.listByApplicant('user-123', { page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.applications).toHaveLength(1);
      expect(result.applications[0].files).toHaveLength(1);
    });
  });

  describe('File Methods', () => {
    describe('addFile', () => {
      it('should add file to application', async () => {
        mockQuery.mockResolvedValue({ rows: [mockFile] });

        const result = await ApplicationModel.addFile(
          'app-123',
          'document.pdf',
          'My Document.pdf',
          '/uploads/document.pdf',
          1048576,
          'application/pdf'
        );

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO application_files'),
          expect.arrayContaining([
            'app-123',
            'document.pdf',
            'My Document.pdf',
            '/uploads/document.pdf',
            1048576,
            'application/pdf',
            FileScanStatus.PENDING,
          ])
        );
        expect(result.file_id).toBe('file-123');
      });
    });

    describe('getFiles', () => {
      it('should return files for application', async () => {
        mockQuery.mockResolvedValue({ rows: [mockFile] });

        const result = await ApplicationModel.getFiles('app-123');

        expect(mockQuery).toHaveBeenCalledWith(
          'SELECT * FROM application_files WHERE application_id = $1 ORDER BY uploaded_at',
          ['app-123']
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getFile', () => {
      it('should return single file by ID', async () => {
        mockQuery.mockResolvedValue({ rows: [mockFile] });

        const result = await ApplicationModel.getFile('file-123');

        expect(result).toEqual(mockFile);
      });

      it('should return null when file not found', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await ApplicationModel.getFile('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('updateFileScanStatus', () => {
      it('should update file scan status', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await ApplicationModel.updateFileScanStatus('file-123', FileScanStatus.CLEAN);

        expect(mockQuery).toHaveBeenCalledWith(
          'UPDATE application_files SET scan_status = $1 WHERE file_id = $2',
          [FileScanStatus.CLEAN, 'file-123']
        );
      });

      it('should handle infected status', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await ApplicationModel.updateFileScanStatus('file-123', FileScanStatus.INFECTED);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.any(String),
          [FileScanStatus.INFECTED, 'file-123']
        );
      });
    });

    describe('deleteFile', () => {
      it('should delete file by ID', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await ApplicationModel.deleteFile('file-123');

        expect(mockQuery).toHaveBeenCalledWith(
          'DELETE FROM application_files WHERE file_id = $1',
          ['file-123']
        );
      });
    });
  });

  describe('Confirmation Methods', () => {
    describe('addConfirmation', () => {
      it('should add confirmation', async () => {
        mockQuery.mockResolvedValue({ rows: [mockConfirmation] });

        const result = await ApplicationModel.addConfirmation(
          'app-123',
          ConfirmationType.GUIDANCE_READ,
          '192.168.1.1'
        );

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO confirmations'),
          expect.arrayContaining([
            'app-123',
            ConfirmationType.GUIDANCE_READ,
            '192.168.1.1',
          ])
        );
        expect(result.type).toBe(ConfirmationType.GUIDANCE_READ);
      });

      it('should upsert on conflict', async () => {
        mockQuery.mockResolvedValue({ rows: [mockConfirmation] });

        await ApplicationModel.addConfirmation('app-123', ConfirmationType.GUIDANCE_READ, '192.168.1.1');

        expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT');
      });
    });

    describe('getConfirmations', () => {
      it('should return confirmations for application', async () => {
        mockQuery.mockResolvedValue({ rows: [mockConfirmation] });

        const result = await ApplicationModel.getConfirmations('app-123');

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe(ConfirmationType.GUIDANCE_READ);
      });
    });

    describe('removeConfirmation', () => {
      it('should remove confirmation by type', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await ApplicationModel.removeConfirmation('app-123', ConfirmationType.GUIDANCE_READ);

        expect(mockQuery).toHaveBeenCalledWith(
          'DELETE FROM confirmations WHERE application_id = $1 AND type = $2',
          ['app-123', ConfirmationType.GUIDANCE_READ]
        );
      });
    });

    describe('hasAllConfirmations', () => {
      it('should return true when all required confirmations present', async () => {
        mockQuery.mockResolvedValue({ rows: [{ count: '2' }] });

        const result = await ApplicationModel.hasAllConfirmations('app-123', [
          ConfirmationType.GUIDANCE_READ,
          ConfirmationType.DATA_SHARING_CONSENT,
        ]);

        expect(result).toBe(true);
      });

      it('should return false when confirmations missing', async () => {
        mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

        const result = await ApplicationModel.hasAllConfirmations('app-123', [
          ConfirmationType.GUIDANCE_READ,
          ConfirmationType.DATA_SHARING_CONSENT,
        ]);

        expect(result).toBe(false);
      });

      it('should return true when no confirmations required', async () => {
        const result = await ApplicationModel.hasAllConfirmations('app-123', []);

        expect(result).toBe(true);
        expect(mockQuery).not.toHaveBeenCalled();
      });
    });
  });

  describe('belongsToUser', () => {
    it('should return true when application belongs to user', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await ApplicationModel.belongsToUser('app-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when application does not belong to user', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await ApplicationModel.belongsToUser('app-123', 'other-user');

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete application and related records in transaction', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      mockTransaction.mockImplementation((callback) => callback(mockClient));

      await ApplicationModel.delete('app-123');

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        'DELETE FROM confirmations WHERE application_id = $1',
        ['app-123']
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM application_files WHERE application_id = $1',
        ['app-123']
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(
        3,
        'DELETE FROM applications WHERE application_id = $1',
        ['app-123']
      );
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      await expect(ApplicationModel.findById('app-123')).rejects.toThrow('Database error');
    });

    it('should handle transaction errors', async () => {
      const txError = new Error('Transaction failed');
      mockTransaction.mockRejectedValue(txError);

      await expect(ApplicationModel.delete('app-123')).rejects.toThrow('Transaction failed');
    });
  });
});
