/**
 * Complete User Flow Integration Tests
 *
 * Tests the complete user journey:
 * 1. User registration -> Login -> Create application -> Submit -> Assessment workflow
 * 2. End-to-end flow from applicant submission to assessment completion
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestApp,
  generateTestToken,
  TestUsers,
  AuthenticatedRequest,
  expectSuccess,
  expectError,
  clearTestData,
} from '../testServer';
import { UserRole } from '../../../src/types';

describe('Complete User Flow Integration Tests', () => {
  const app = getTestApp();

  // NOTE: We use beforeAll instead of beforeEach because these tests are
  // sequential flows that depend on state from previous tests
  beforeAll(() => {
    clearTestData();
  });

  describe('Flow 1: User Registration -> Login -> Create Application -> Submit', () => {
    let applicantEmail: string;
    let applicantPassword: string;
    let applicantToken: string;
    let applicantUserId: string;
    let coordinatorToken: string;
    let coordinatorUserId: string;
    let fundingCallId: string;
    let applicationId: string;

    beforeAll(async () => {
      // Setup coordinator for creating funding call
      const coordinator = TestUsers.coordinator();
      coordinatorUserId = coordinator.user_id;
      coordinatorToken = generateTestToken(coordinator);
    });

    it('Step 1: Register new applicant', async () => {
      applicantEmail = `applicant-flow-${Date.now()}@test.com`;
      applicantPassword = 'SecureApplicantPass123!';

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: applicantEmail,
          password: applicantPassword,
          name: 'Flow Test Applicant',
          role: 'applicant',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('applicant');

      applicantToken = response.body.data.accessToken;
      applicantUserId = response.body.data.user.user_id;
    });

    it('Step 2: Coordinator creates funding call', async () => {
      const callData = {
        name: 'Test Research Fund 2024',
        description: 'A test funding call for integration testing',
        open_at: new Date().toISOString(),
        close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        requirements: {
          allowedFileTypes: ['application/pdf', 'application/msword'],
          maxFileSize: 10485760,
          requiredConfirmations: ['guidance_read', 'data_sharing_consent'],
        },
        criteria_config: [
          {
            name: 'Scientific Merit',
            description: 'Quality of research methodology',
            maxPoints: 25,
            weight: 1,
            commentsRequired: true,
          },
          {
            name: 'Impact',
            description: 'Potential societal impact',
            maxPoints: 25,
            weight: 1,
            commentsRequired: true,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(callData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      fundingCallId = response.body.data.call_id;
    });

    it('Step 3: Coordinator opens the funding call', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${fundingCallId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Step 4: Applicant views open calls', async () => {
      const response = await request(app)
        .get('/api/v1/calls/open');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      const ourCall = response.body.data.find(
        (call: { call_id: string }) => call.call_id === fundingCallId
      );
      expect(ourCall).toBeDefined();
    });

    it('Step 5: Applicant creates application', async () => {
      const response = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          call_id: fundingCallId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('application_id');
      expect(response.body.data).toHaveProperty('reference_number');
      expect(response.body.data.status).toBe('draft');

      applicationId = response.body.data.application_id;
    });

    it('Step 6: Applicant adds confirmations', async () => {
      const confirmations = ['guidance_read', 'data_sharing_consent'];

      for (const type of confirmations) {
        const response = await request(app)
          .post(`/api/v1/applications/${applicationId}/confirmations`)
          .set('Authorization', `Bearer ${applicantToken}`)
          .send({ type });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('Step 7: Applicant views their confirmations', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/${applicationId}/confirmations`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('Step 8: Applicant submits application', async () => {
      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.data.submitted_at).toBeDefined();
    });

    it('Step 9: Applicant can view their submitted application', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('submitted');
    });

    it('Step 10: Applicant lists their applications', async () => {
      const response = await request(app)
        .get('/api/v1/applications/my')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('Step 11: Coordinator views applications for the call', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/call/${fundingCallId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const ourApp = response.body.data.applications.find(
        (a: { application_id: string }) => a.application_id === applicationId
      );
      expect(ourApp).toBeDefined();
      expect(ourApp.status).toBe('submitted');
    });
  });

  describe('Flow 2: Assessment Workflow', () => {
    let coordinatorToken: string;
    let assessor1Token: string;
    let assessor1UserId: string;
    let assessor2Token: string;
    let assessor2UserId: string;
    let fundingCallId: string;
    let applicationId: string;
    let assignment1Id: string;
    let assignment2Id: string;

    beforeAll(async () => {
      // Setup users
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const assessor1 = TestUsers.assessor();
      assessor1UserId = assessor1.user_id;
      assessor1Token = generateTestToken(assessor1);

      const assessor2 = { ...TestUsers.assessor(), user_id: uuidv4() };
      assessor2UserId = assessor2.user_id;
      assessor2Token = generateTestToken(assessor2);

      // Create a funding call and submitted application
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Assessment Test Call',
          description: 'Test call for assessment workflow',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          criteria_config: [
            { name: 'Quality', maxPoints: 20, commentsRequired: true },
            { name: 'Innovation', maxPoints: 20, commentsRequired: true },
          ],
        });

      fundingCallId = callResponse.body.data.call_id;

      // Open the call
      await request(app)
        .post(`/api/v1/calls/${fundingCallId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
    });

    it('Step 1: Coordinator adds assessors to pool', async () => {
      const response1 = await request(app)
        .post(`/api/v1/calls/${fundingCallId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ assessorId: assessor1UserId });

      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .post(`/api/v1/calls/${fundingCallId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ assessorId: assessor2UserId });

      expect(response2.status).toBe(200);
    });

    it('Step 2: Coordinator views assessor pool', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${fundingCallId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('Step 3: Create application for assessment', async () => {
      // Create applicant and application
      const applicant = TestUsers.applicant();
      const applicantToken = generateTestToken(applicant);

      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: fundingCallId });

      applicationId = appResponse.body.data.application_id;

      // Submit application
      await request(app)
        .post(`/api/v1/applications/${applicationId}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);
    });

    it('Step 4: Coordinator assigns assessors to application', async () => {
      const response1 = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          applicationId: applicationId,
          assessorId: assessor1UserId,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response1.status).toBe(201);
      assignment1Id = response1.body.data.assignment_id;

      const response2 = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          applicationId: applicationId,
          assessorId: assessor2UserId,
        });

      expect(response2.status).toBe(201);
      assignment2Id = response2.body.data.assignment_id;
    });

    it('Step 5: Assessor 1 views their assignments', async () => {
      const response = await request(app)
        .get('/api/v1/assessments/my')
        .set('Authorization', `Bearer ${assessor1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('Step 6: Assessor 1 starts assessment', async () => {
      const response = await request(app)
        .get(`/api/v1/assessments/assignment/${assignment1Id}`)
        .set('Authorization', `Bearer ${assessor1Token}`);

      expect(response.status).toBe(200);
    });

    it('Step 7: Assessor 1 submits assessment scores', async () => {
      const response = await request(app)
        .post(`/api/v1/assessments/assignment/${assignment1Id}`)
        .set('Authorization', `Bearer ${assessor1Token}`)
        .send({
          scores: [
            { criterionId: uuidv4(), score: 18, comment: 'Excellent quality work' },
            { criterionId: uuidv4(), score: 15, comment: 'Good innovation' },
          ],
          overallComment: 'Strong application overall',
          coiConfirmed: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('Step 8: Assessor 2 submits assessment', async () => {
      const response = await request(app)
        .post(`/api/v1/assessments/assignment/${assignment2Id}`)
        .set('Authorization', `Bearer ${assessor2Token}`)
        .send({
          scores: [
            { criterionId: uuidv4(), score: 17, comment: 'Very good quality' },
            { criterionId: uuidv4(), score: 16, comment: 'Innovative approach' },
          ],
          overallComment: 'Recommend for funding',
          coiConfirmed: true,
        });

      expect(response.status).toBe(200);
    });

    it('Step 9: Coordinator closes the call', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${fundingCallId}/close`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 10: Coordinator views assessment results', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${fundingCallId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('results');
    });

    it('Step 11: Coordinator views call summary', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${fundingCallId}/summary`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 12: Coordinator views ranking', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${fundingCallId}/ranking`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 13: Coordinator exports results', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${fundingCallId}/export`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Flow 3: Bulk Assignment Workflow', () => {
    let coordinatorToken: string;
    let fundingCallId: string;
    const assessorIds: string[] = [];
    const applicationIds: string[] = [];

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      // Create call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Bulk Assignment Test',
          description: 'Test for bulk assignment',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          criteria_config: [{ name: 'Overall', maxPoints: 100 }],
        });

      fundingCallId = callResponse.body.data.call_id;

      // Open call
      await request(app)
        .post(`/api/v1/calls/${fundingCallId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create multiple assessors
      for (let i = 0; i < 3; i++) {
        const assessor = { ...TestUsers.assessor(), user_id: uuidv4() };
        assessorIds.push(assessor.user_id);
      }

      // Create multiple applications
      for (let i = 0; i < 5; i++) {
        const applicant = TestUsers.applicant();
        const applicantToken = generateTestToken(applicant);

        const appResponse = await request(app)
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${applicantToken}`)
          .send({ call_id: fundingCallId });

        applicationIds.push(appResponse.body.data.application_id);

        // Submit
        await request(app)
          .post(`/api/v1/applications/${appResponse.body.data.application_id}/submit`)
          .set('Authorization', `Bearer ${applicantToken}`);
      }
    });

    it('should perform bulk assignment with round-robin strategy', async () => {
      const response = await request(app)
        .post('/api/v1/assignments/bulk')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          applicationIds: applicationIds,
          assessorIds: assessorIds,
          strategy: 'round-robin',
          assessorsPerApplication: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should view assignment progress', async () => {
      const response = await request(app)
        .get(`/api/v1/assignments/progress/${fundingCallId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('should view progress by assessor', async () => {
      const response = await request(app)
        .get(`/api/v1/assignments/progress/${fundingCallId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Flow 4: Application Withdrawal and Reopening', () => {
    let applicantToken: string;
    let coordinatorToken: string;
    let applicationId: string;
    let fundingCallId: string;

    beforeAll(async () => {
      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      // Create and open call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Withdrawal Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      fundingCallId = callResponse.body.data.call_id;

      await request(app)
        .post(`/api/v1/calls/${fundingCallId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
    });

    it('should create application', async () => {
      const response = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: fundingCallId });

      applicationId = response.body.data.application_id;
      expect(response.status).toBe(201);
    });

    it('should submit application', async () => {
      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('submitted');
    });

    it('should withdraw application', async () => {
      const response = await request(app)
        .delete(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
    });

    it('should verify application is withdrawn', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('withdrawn');
    });

    it('coordinator should be able to reopen application', async () => {
      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/reopen`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('reopened');
    });
  });
});
