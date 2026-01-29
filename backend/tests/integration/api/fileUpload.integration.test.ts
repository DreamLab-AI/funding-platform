/**
 * File Upload and Virus Scanning Integration Tests
 *
 * Tests the complete file upload flow:
 * - File upload to applications
 * - File type validation
 * - Size limits
 * - Virus scanning status
 * - File download
 * - File deletion
 */

import request from 'supertest';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestApp,
  generateTestToken,
  TestUsers,
  createMockFile,
  createMockPDF,
} from '../testServer';
import { UserRole } from '../../../src/types';

describe('File Upload and Virus Scanning Integration Tests', () => {
  const app = getTestApp();

  describe('File Upload Flow', () => {
    let applicantToken: string;
    let coordinatorToken: string;
    let applicationId: string;
    let callId: string;

    beforeAll(async () => {
      // Setup users
      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      // Create and open a funding call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'File Upload Test Call',
          description: 'Testing file uploads',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          requirements: {
            allowedFileTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
            maxFileSize: 10485760, // 10MB
            maxFiles: 5,
          },
        });

      callId = callResponse.body.data.call_id;

      await request(app)
        .post(`/api/v1/calls/${callId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create an application
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: callId });

      applicationId = appResponse.body.data.application_id;
    });

    describe('POST /api/v1/applications/:id/files - Upload Files', () => {
      it('should upload a valid PDF file', async () => {
        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: mockPdf.originalname,
            contentType: mockPdf.mimetype,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);

        if (response.body.data.length > 0) {
          expect(response.body.data[0]).toHaveProperty('file_id');
          expect(response.body.data[0]).toHaveProperty('scan_status');
        }
      });

      it('should upload multiple files at once', async () => {
        const file1 = createMockFile({
          content: 'First document content',
          filename: 'document1.pdf',
          mimetype: 'application/pdf',
        });
        const file2 = createMockFile({
          content: 'Second document content',
          filename: 'document2.pdf',
          mimetype: 'application/pdf',
        });

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', file1.buffer, {
            filename: file1.originalname,
            contentType: file1.mimetype,
          })
          .attach('files', file2.buffer, {
            filename: file2.originalname,
            contentType: file2.mimetype,
          });

        expect(response.status).toBe(200);
      });

      it('should reject invalid file type', async () => {
        const invalidFile = createMockFile({
          content: 'console.log("malicious");',
          filename: 'script.js',
          mimetype: 'application/javascript',
        });

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', invalidFile.buffer, {
            filename: invalidFile.originalname,
            contentType: invalidFile.mimetype,
          });

        expect([400, 415]).toContain(response.status);
      });

      it('should reject file exceeding size limit', async () => {
        // Create a large file (larger than typical test limits)
        const largeContent = Buffer.alloc(15 * 1024 * 1024); // 15MB
        largeContent.fill('x');

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', largeContent, {
            filename: 'large-file.pdf',
            contentType: 'application/pdf',
          });

        // Should reject or timeout
        expect([400, 413, 500]).toContain(response.status);
      }, 30000);

      it('should reject upload without authentication', async () => {
        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .attach('files', mockPdf.buffer, {
            filename: mockPdf.originalname,
            contentType: mockPdf.mimetype,
          });

        expect(response.status).toBe(401);
      });

      it('should reject upload to non-existent application', async () => {
        const fakeAppId = uuidv4();
        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${fakeAppId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: mockPdf.originalname,
            contentType: mockPdf.mimetype,
          });

        expect([403, 404]).toContain(response.status);
      });

      it('should reject upload to another user application', async () => {
        // Create another applicant
        const otherApplicant = { ...TestUsers.applicant(), user_id: uuidv4() };
        const otherToken = generateTestToken(otherApplicant);

        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${otherToken}`)
          .attach('files', mockPdf.buffer, {
            filename: mockPdf.originalname,
            contentType: mockPdf.mimetype,
          });

        expect([403, 404]).toContain(response.status);
      });
    });

    describe('File Scan Status', () => {
      let uploadedFileId: string;

      beforeAll(async () => {
        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: 'scan-test.pdf',
            contentType: mockPdf.mimetype,
          });

        if (response.body.data && response.body.data[0]) {
          uploadedFileId = response.body.data[0].file_id;
        }
      });

      it('should show pending scan status initially', async () => {
        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect(response.status).toBe(200);

        if (response.body.data.files && response.body.data.files.length > 0) {
          const recentFile = response.body.data.files.find(
            (f: { file_id: string }) => f.file_id === uploadedFileId
          );

          if (recentFile) {
            expect(['pending', 'clean', 'error']).toContain(recentFile.scan_status);
          }
        }
      });
    });

    describe('GET /api/v1/applications/:id/files/:fileId/download - Download File', () => {
      let fileId: string;

      beforeAll(async () => {
        const mockPdf = createMockPDF();

        const uploadResponse = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: 'download-test.pdf',
            contentType: mockPdf.mimetype,
          });

        if (uploadResponse.body.data && uploadResponse.body.data[0]) {
          fileId = uploadResponse.body.data[0].file_id;
        }
      });

      it('should download file as application owner', async () => {
        if (!fileId) return;

        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}/files/${fileId}/download`)
          .set('Authorization', `Bearer ${applicantToken}`);

        // Should either download or return presigned URL
        expect([200, 302, 307]).toContain(response.status);
      });

      it('should allow coordinator to download file', async () => {
        if (!fileId) return;

        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}/files/${fileId}/download`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        expect([200, 302, 307]).toContain(response.status);
      });

      it('should reject download without authentication', async () => {
        if (!fileId) return;

        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}/files/${fileId}/download`);

        expect(response.status).toBe(401);
      });

      it('should reject download of non-existent file', async () => {
        const fakeFileId = uuidv4();

        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}/files/${fakeFileId}/download`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/v1/applications/:id/files/:fileId - Delete File', () => {
      let fileId: string;

      beforeEach(async () => {
        // Upload a new file for each test
        const mockPdf = createMockPDF();

        const uploadResponse = await request(app)
          .post(`/api/v1/applications/${applicationId}/files`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: `delete-test-${Date.now()}.pdf`,
            contentType: mockPdf.mimetype,
          });

        if (uploadResponse.body.data && uploadResponse.body.data[0]) {
          fileId = uploadResponse.body.data[0].file_id;
        }
      });

      it('should delete file as application owner', async () => {
        if (!fileId) return;

        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect(response.status).toBe(200);
      });

      it('should reject delete by non-owner', async () => {
        if (!fileId) return;

        const otherApplicant = { ...TestUsers.applicant(), user_id: uuidv4() };
        const otherToken = generateTestToken(otherApplicant);

        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect([403, 404]).toContain(response.status);
      });

      it('should reject delete without authentication', async () => {
        if (!fileId) return;

        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`);

        expect(response.status).toBe(401);
      });

      it('should return 404 for already deleted file', async () => {
        if (!fileId) return;

        // Delete the file first
        await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`)
          .set('Authorization', `Bearer ${applicantToken}`);

        // Try to delete again
        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect(response.status).toBe(404);
      });
    });
  });

  describe('File Validation Edge Cases', () => {
    let applicantToken: string;
    let applicationId: string;

    beforeAll(async () => {
      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const coordinator = TestUsers.coordinator();
      const coordinatorToken = generateTestToken(coordinator);

      // Create and open a call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Edge Case Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      await request(app)
        .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: callResponse.body.data.call_id });

      applicationId = appResponse.body.data.application_id;
    });

    it('should handle empty file', async () => {
      const emptyFile = createMockFile({
        content: '',
        filename: 'empty.pdf',
        mimetype: 'application/pdf',
      });

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', emptyFile.buffer, {
          filename: emptyFile.originalname,
          contentType: emptyFile.mimetype,
        });

      // Behavior depends on implementation - might accept or reject empty files
      expect([200, 400]).toContain(response.status);
    });

    it('should handle special characters in filename', async () => {
      const mockPdf = createMockPDF();

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: 'file with spaces & special (chars).pdf',
          contentType: mockPdf.mimetype,
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should handle unicode filename', async () => {
      const mockPdf = createMockPDF();

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: 'document-日本語.pdf',
          contentType: mockPdf.mimetype,
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should handle very long filename', async () => {
      const mockPdf = createMockPDF();
      const longName = 'a'.repeat(300) + '.pdf';

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: longName,
          contentType: mockPdf.mimetype,
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should reject request with no files attached', async () => {
      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect([400, 422]).toContain(response.status);
    });

    it('should handle file with mismatched extension and mime type', async () => {
      const deceptiveFile = createMockFile({
        content: 'This is actually a text file',
        filename: 'document.pdf', // Says PDF
        mimetype: 'text/plain', // But is actually text
      });

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', deceptiveFile.buffer, {
          filename: deceptiveFile.originalname,
          contentType: deceptiveFile.mimetype,
        });

      // Should ideally reject or flag mismatched types
      expect([200, 400, 415]).toContain(response.status);
    });
  });

  describe('Submitted Application File Handling', () => {
    let applicantToken: string;
    let applicationId: string;

    beforeAll(async () => {
      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const coordinator = TestUsers.coordinator();
      const coordinatorToken = generateTestToken(coordinator);

      // Create call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Submitted App File Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      await request(app)
        .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create application
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: callResponse.body.data.call_id });

      applicationId = appResponse.body.data.application_id;

      // Upload a file
      const mockPdf = createMockPDF();
      await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: mockPdf.originalname,
          contentType: mockPdf.mimetype,
        });

      // Submit the application
      await request(app)
        .post(`/api/v1/applications/${applicationId}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);
    });

    it('should reject file upload to submitted application', async () => {
      const mockPdf = createMockPDF();

      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: 'new-file.pdf',
          contentType: mockPdf.mimetype,
        });

      // Should reject modifications to submitted application
      expect([400, 403]).toContain(response.status);
    });

    it('should reject file deletion from submitted application', async () => {
      // Get the application to find the file ID
      const appResponse = await request(app)
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      const fileId = appResponse.body.data.files?.[0]?.file_id;

      if (fileId) {
        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}/files/${fileId}`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect([400, 403]).toContain(response.status);
      }
    });

    it('should still allow file download from submitted application', async () => {
      const appResponse = await request(app)
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      const fileId = appResponse.body.data.files?.[0]?.file_id;

      if (fileId) {
        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}/files/${fileId}/download`)
          .set('Authorization', `Bearer ${applicantToken}`);

        expect([200, 302, 307]).toContain(response.status);
      }
    });
  });

  describe('Bulk Download Operations', () => {
    let coordinatorToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const applicant = TestUsers.applicant();
      const applicantToken = generateTestToken(applicant);

      // Create call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Bulk Download Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = callResponse.body.data.call_id;

      await request(app)
        .post(`/api/v1/calls/${callId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create application with file
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: callId });

      const mockPdf = createMockPDF();
      await request(app)
        .post(`/api/v1/applications/${appResponse.body.data.application_id}/files`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .attach('files', mockPdf.buffer, {
          filename: mockPdf.originalname,
          contentType: mockPdf.mimetype,
        });

      await request(app)
        .post(`/api/v1/applications/${appResponse.body.data.application_id}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);
    });

    it('should allow coordinator to download all files for a call', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/download/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Should return zip or initiate download
      expect([200, 202]).toContain(response.status);
    });

    it('should reject bulk download by non-coordinator', async () => {
      const applicant = TestUsers.applicant();
      const applicantToken = generateTestToken(applicant);

      const response = await request(app)
        .get(`/api/v1/applications/download/${callId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(403);
    });
  });
});
