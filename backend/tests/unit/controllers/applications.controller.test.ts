/**
 * Applications Controller Unit Tests
 * Tests for CRUD operations, submission, withdrawal, and file management
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from '../../helpers/testUtils';
import { UserRole } from '../../../src/types';

// Helper to flush promises - asyncHandler returns void
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock database pool
const mockQuery = jest.fn();
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: (...args: any[]) => mockQuery(...args),
  },
}));

// Mock file service
const mockFileService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getFile: jest.fn(),
  createArchive: jest.fn(),
};
jest.mock('../../../src/services/file.service', () => ({
  fileService: mockFileService,
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

import { applicationsController } from '../../../src/controllers/applications.controller';

describe('Applications Controller', () => {
  let mockReq: any;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  const mockUserId = uuidv4();
  const mockCallId = uuidv4();
  const mockApplicationId = uuidv4();

  const mockApplication = {
    id: mockApplicationId,
    call_id: mockCallId,
    applicant_id: mockUserId,
    status: 'draft',
    content: { title: 'Test Application' },
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.user = { id: mockUserId, role: UserRole.APPLICANT };
  });

  // =========================================================================
  // CREATE APPLICATION TESTS
  // =========================================================================

  describe('create', () => {
    it('should create application successfully (201)', async () => {
      mockReq.body = { callId: mockCallId, content: { title: 'New Application' } };
      mockQuery.mockResolvedValue({ rows: [mockApplication] });

      applicationsController.create(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO applications'),
        expect.arrayContaining([expect.any(String), mockCallId, mockUserId])
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockApplication,
      });
    });

    it('should handle database error (500)', async () => {
      mockReq.body = { callId: mockCallId, content: {} };
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      applicationsController.create(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  // =========================================================================
  // GET MY APPLICATIONS TESTS
  // =========================================================================

  describe('getMyApplications', () => {
    it('should return user applications successfully (200)', async () => {
      const applications = [mockApplication, { ...mockApplication, id: uuidv4() }];
      mockQuery.mockResolvedValue({ rows: applications });

      applicationsController.getMyApplications(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.applicant_id = $1'),
        [mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: applications,
      });
    });

    it('should return empty array when no applications found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.getMyApplications(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });
  });

  // =========================================================================
  // GET BY ID TESTS
  // =========================================================================

  describe('getById', () => {
    it('should return application for owner (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery.mockResolvedValue({ rows: [mockApplication] });

      applicationsController.getById(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.id = $1'),
        [mockApplicationId, mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockApplication,
      });
    });

    it('should throw 404 when application not found', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.getById(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found',
        })
      );
    });

    it('should allow coordinator to access any application', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.user = { id: 'coordinator-id', role: UserRole.COORDINATOR };
      mockQuery.mockResolvedValue({ rows: [mockApplication] });

      applicationsController.getById(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockApplication,
      });
    });
  });

  // =========================================================================
  // UPDATE APPLICATION TESTS
  // =========================================================================

  describe('update', () => {
    it('should update draft application successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.body = { content: { title: 'Updated Title' } };
      const updatedApp = { ...mockApplication, content: mockReq.body.content };
      mockQuery.mockResolvedValue({ rows: [updatedApp] });

      applicationsController.update(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $2 AND applicant_id = $3 AND status = 'draft'"),
        expect.any(Array)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedApp,
      });
    });

    it('should throw 404 when application not found or not editable', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.body = { content: {} };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.update(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found or not editable',
        })
      );
    });

    it('should not allow updating submitted application (404)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.body = { content: {} };
      mockQuery.mockResolvedValue({ rows: [] }); // No rows returned for submitted app

      applicationsController.update(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        })
      );
    });
  });

  // =========================================================================
  // WITHDRAW APPLICATION TESTS
  // =========================================================================

  describe('withdraw', () => {
    it('should withdraw application successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      const withdrawnApp = { ...mockApplication, status: 'withdrawn' };
      mockQuery.mockResolvedValue({ rows: [withdrawnApp] });

      applicationsController.withdraw(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'withdrawn'"),
        [mockApplicationId, mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: withdrawnApp,
      });
    });

    it('should throw 404 when application cannot be withdrawn', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.withdraw(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found or cannot be withdrawn',
        })
      );
    });
  });

  // =========================================================================
  // SUBMIT APPLICATION TESTS
  // =========================================================================

  describe('submit', () => {
    it('should submit application successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      const submittedApp = { ...mockApplication, status: 'submitted', submitted_at: new Date() };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ required: null }] }) // confirmations check
        .mockResolvedValueOnce({ rows: [submittedApp] }); // update

      applicationsController.submit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: submittedApp,
      });
    });

    it('should throw 400 when application not found or already submitted', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ required: null }] })
        .mockResolvedValueOnce({ rows: [] });

      applicationsController.submit(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Application not found or already submitted',
        })
      );
    });
  });

  // =========================================================================
  // FILE UPLOAD TESTS
  // =========================================================================

  describe('uploadFiles', () => {
    it('should upload files successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.files = [
        { originalname: 'file1.pdf', buffer: Buffer.from('test') },
        { originalname: 'file2.pdf', buffer: Buffer.from('test2') },
      ];
      mockFileService.uploadFile.mockResolvedValue({ id: 'file-id', filename: 'file.pdf' });

      applicationsController.uploadFiles(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockFileService.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
      });
    });

    it('should throw 400 when no files provided', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.files = [];

      applicationsController.uploadFiles(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'No files provided',
        })
      );
    });

    it('should throw 400 when files is undefined', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.files = undefined;

      applicationsController.uploadFiles(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'No files provided',
        })
      );
    });
  });

  // =========================================================================
  // FILE DELETE TESTS
  // =========================================================================

  describe('deleteFile', () => {
    it('should delete file successfully (200)', async () => {
      mockReq.params = { fileId: 'file-id' };
      mockFileService.deleteFile.mockResolvedValue(undefined);

      applicationsController.deleteFile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-id');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted',
      });
    });

    it('should handle file service error', async () => {
      mockReq.params = { fileId: 'file-id' };
      const error = new Error('File not found');
      mockFileService.deleteFile.mockRejectedValue(error);

      applicationsController.deleteFile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // =========================================================================
  // FILE DOWNLOAD TESTS
  // =========================================================================

  describe('downloadFile', () => {
    it('should download file successfully (200)', async () => {
      mockReq.params = { fileId: 'file-id' };
      const fileBuffer = Buffer.from('file content');
      mockFileService.getFile.mockResolvedValue(fileBuffer);

      applicationsController.downloadFile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment')
      );
      expect(mockRes.send).toHaveBeenCalledWith(fileBuffer);
    });
  });

  // =========================================================================
  // CONFIRMATIONS TESTS
  // =========================================================================

  describe('addConfirmation', () => {
    it('should add confirmation successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockReq.body = { type: 'guidance_read', confirmed: true };
      const confirmation = { id: 'conf-id', type: 'guidance_read', confirmed: true };
      mockQuery.mockResolvedValue({ rows: [confirmation] });

      applicationsController.addConfirmation(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: confirmation,
      });
    });
  });

  describe('getConfirmations', () => {
    it('should return confirmations successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      const confirmations = [
        { type: 'guidance_read', confirmed: true },
        { type: 'edi_completed', confirmed: false },
      ];
      mockQuery.mockResolvedValue({ rows: confirmations });

      applicationsController.getConfirmations(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: confirmations,
      });
    });
  });

  // =========================================================================
  // LIST APPLICATIONS TESTS
  // =========================================================================

  describe('list', () => {
    it('should list applications with pagination (200)', async () => {
      mockReq.query = { page: '1', limit: '20' };
      const applications = [mockApplication];
      mockQuery.mockResolvedValue({ rows: applications });

      applicationsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.any(Array)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: applications,
      });
    });

    it('should filter by status', async () => {
      mockReq.query = { status: 'submitted', page: '1', limit: '20' };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('a.status = $'),
        expect.arrayContaining(['submitted'])
      );
    });

    it('should filter by callId', async () => {
      mockReq.query = { callId: mockCallId, page: '1', limit: '20' };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.list(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('a.call_id = $'),
        expect.arrayContaining([mockCallId])
      );
    });
  });

  // =========================================================================
  // LIST BY CALL TESTS
  // =========================================================================

  describe('listByCall', () => {
    it('should list applications for a specific call (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const applications = [mockApplication];
      mockQuery.mockResolvedValue({ rows: applications });

      applicationsController.listByCall(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.call_id = $1'),
        [mockCallId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: applications,
      });
    });
  });

  // =========================================================================
  // REOPEN APPLICATION TESTS
  // =========================================================================

  describe('reopen', () => {
    it('should reopen submitted application successfully (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      const reopenedApp = { ...mockApplication, status: 'draft' };
      mockQuery.mockResolvedValue({ rows: [reopenedApp] });

      applicationsController.reopen(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'draft'"),
        [mockApplicationId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: reopenedApp,
      });
    });

    it('should throw 404 when application cannot be reopened', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery.mockResolvedValue({ rows: [] });

      applicationsController.reopen(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found or cannot be reopened',
        })
      );
    });
  });

  // =========================================================================
  // GET ASSIGNED APPLICATIONS TESTS
  // =========================================================================

  describe('getAssignedApplications', () => {
    it('should return assigned applications for assessor (200)', async () => {
      const assignedApps = [
        { ...mockApplication, assignment_id: 'assign-1', due_at: new Date() },
      ];
      mockQuery.mockResolvedValue({ rows: assignedApps });

      applicationsController.getAssignedApplications(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ass.assessor_id = $1'),
        [mockUserId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: assignedApps,
      });
    });
  });

  // =========================================================================
  // GET MATERIALS TESTS
  // =========================================================================

  describe('getMaterials', () => {
    it('should return application materials (200)', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ content: { title: 'Test' } }] })
        .mockResolvedValueOnce({ rows: [{ filename: 'doc.pdf' }] });

      applicationsController.getMaterials(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          content: { title: 'Test' },
          files: [{ filename: 'doc.pdf' }],
        },
      });
    });

    it('should throw 404 when application not found', async () => {
      mockReq.params = { id: mockApplicationId };
      mockQuery.mockResolvedValueOnce({ rows: [] });

      applicationsController.getMaterials(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Application not found',
        })
      );
    });
  });

  // =========================================================================
  // EXPORT TESTS
  // =========================================================================

  describe('exportMetadata', () => {
    it('should export application metadata (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const metadata = [
        { reference_number: 'REF001', status: 'submitted', email: 'test@example.com' },
      ];
      mockQuery.mockResolvedValue({ rows: metadata });

      applicationsController.exportMetadata(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: metadata,
      });
    });
  });

  describe('downloadAllFiles', () => {
    it('should create and send archive (200)', async () => {
      mockReq.params = { callId: mockCallId };
      const files = [{ file_path: '/path/to/file.pdf', filename: 'file.pdf' }];
      mockQuery.mockResolvedValue({ rows: files });
      const archiveBuffer = Buffer.from('archive content');
      mockFileService.createArchive.mockResolvedValue(archiveBuffer);

      applicationsController.downloadAllFiles(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(mockRes.send).toHaveBeenCalledWith(archiveBuffer);
    });
  });
});
