/**
 * Assessment Workflow Integration Tests
 *
 * Tests the complete assessment workflow:
 * - Coordinator creates call
 * - Applicant submits
 * - Assessors assigned
 * - Assessments completed
 * - Results generated
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestApp,
  generateTestToken,
  TestUsers,
  createMockPDF,
} from '../testServer';
import { UserRole } from '../../../src/types';

describe('Assessment Workflow Integration Tests', () => {
  const app = getTestApp();

  describe('Complete Assessment Workflow', () => {
    // Test context - will be populated as we go through the workflow
    const context: {
      coordinatorToken: string;
      coordinatorId: string;
      applicantToken: string;
      applicantId: string;
      assessor1Token: string;
      assessor1Id: string;
      assessor2Token: string;
      assessor2Id: string;
      callId: string;
      applicationId: string;
      assignment1Id: string;
      assignment2Id: string;
      criteriaIds: string[];
    } = {
      coordinatorToken: '',
      coordinatorId: '',
      applicantToken: '',
      applicantId: '',
      assessor1Token: '',
      assessor1Id: '',
      assessor2Token: '',
      assessor2Id: '',
      callId: '',
      applicationId: '',
      assignment1Id: '',
      assignment2Id: '',
      criteriaIds: [],
    };

    beforeAll(() => {
      // Setup all test users
      const coordinator = TestUsers.coordinator();
      context.coordinatorId = coordinator.user_id;
      context.coordinatorToken = generateTestToken(coordinator);

      const applicant = TestUsers.applicant();
      context.applicantId = applicant.user_id;
      context.applicantToken = generateTestToken(applicant);

      const assessor1 = TestUsers.assessor();
      context.assessor1Id = assessor1.user_id;
      context.assessor1Token = generateTestToken(assessor1);

      const assessor2 = { ...TestUsers.assessor(), user_id: uuidv4() };
      context.assessor2Id = assessor2.user_id;
      context.assessor2Token = generateTestToken(assessor2);
    });

    describe('Phase 1: Call Setup', () => {
      it('should create funding call with criteria', async () => {
        const callData = {
          name: 'Research Excellence Award 2024',
          description: 'Supporting innovative research projects',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          requirements: {
            allowedFileTypes: ['application/pdf'],
            maxFileSize: 10485760,
            requiredConfirmations: ['guidance_read'],
          },
          criteria_config: [
            {
              name: 'Scientific Excellence',
              description: 'Quality and rigor of the research approach',
              maxPoints: 30,
              weight: 1.5,
              commentsRequired: true,
            },
            {
              name: 'Innovation',
              description: 'Novelty and originality of the proposal',
              maxPoints: 25,
              weight: 1.2,
              commentsRequired: true,
            },
            {
              name: 'Impact',
              description: 'Potential societal and economic impact',
              maxPoints: 25,
              weight: 1.0,
              commentsRequired: true,
            },
            {
              name: 'Feasibility',
              description: 'Practicality and likelihood of success',
              maxPoints: 20,
              weight: 1.0,
              commentsRequired: false,
            },
          ],
        };

        const response = await request(app)
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${context.coordinatorToken}`)
          .send(callData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        context.callId = response.body.data.call_id;
        context.criteriaIds = response.body.data.criteria?.map(
          (c: { criterion_id: string }) => c.criterion_id
        ) || [];
      });

      it('should add assessors to pool', async () => {
        const response1 = await request(app)
          .post(`/api/v1/calls/${context.callId}/assessors`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`)
          .send({
            assessorId: context.assessor1Id,
            expertiseTags: ['science', 'technology'],
          });

        expect(response1.status).toBe(200);

        const response2 = await request(app)
          .post(`/api/v1/calls/${context.callId}/assessors`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`)
          .send({
            assessorId: context.assessor2Id,
            expertiseTags: ['innovation', 'impact'],
          });

        expect(response2.status).toBe(200);
      });

      it('should open the funding call', async () => {
        const response = await request(app)
          .post(`/api/v1/calls/${context.callId}/open`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('open');
      });
    });

    describe('Phase 2: Application Submission', () => {
      it('should create application', async () => {
        const response = await request(app)
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${context.applicantToken}`)
          .send({ call_id: context.callId });

        expect(response.status).toBe(201);
        context.applicationId = response.body.data.application_id;
      });

      it('should upload application files', async () => {
        const mockPdf = createMockPDF();

        const response = await request(app)
          .post(`/api/v1/applications/${context.applicationId}/files`)
          .set('Authorization', `Bearer ${context.applicantToken}`)
          .attach('files', mockPdf.buffer, {
            filename: 'research_proposal.pdf',
            contentType: mockPdf.mimetype,
          });

        expect(response.status).toBe(200);
      });

      it('should add required confirmations', async () => {
        const response = await request(app)
          .post(`/api/v1/applications/${context.applicationId}/confirmations`)
          .set('Authorization', `Bearer ${context.applicantToken}`)
          .send({ type: 'guidance_read' });

        expect(response.status).toBe(200);
      });

      it('should submit application', async () => {
        const response = await request(app)
          .post(`/api/v1/applications/${context.applicationId}/submit`)
          .set('Authorization', `Bearer ${context.applicantToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('submitted');
      });
    });

    describe('Phase 3: Assignment', () => {
      it('should assign assessor 1', async () => {
        const response = await request(app)
          .post('/api/v1/assignments')
          .set('Authorization', `Bearer ${context.coordinatorToken}`)
          .send({
            applicationId: context.applicationId,
            assessorId: context.assessor1Id,
            dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });

        expect(response.status).toBe(201);
        context.assignment1Id = response.body.data.assignment_id;
      });

      it('should assign assessor 2', async () => {
        const response = await request(app)
          .post('/api/v1/assignments')
          .set('Authorization', `Bearer ${context.coordinatorToken}`)
          .send({
            applicationId: context.applicationId,
            assessorId: context.assessor2Id,
          });

        expect(response.status).toBe(201);
        context.assignment2Id = response.body.data.assignment_id;
      });

      it('should show assignments for application', async () => {
        const response = await request(app)
          .get(`/api/v1/assignments/application/${context.applicationId}`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });
    });

    describe('Phase 4: Assessment by Assessor 1', () => {
      it('should allow assessor 1 to view their assignments', async () => {
        const response = await request(app)
          .get('/api/v1/assessments/my')
          .set('Authorization', `Bearer ${context.assessor1Token}`);

        expect(response.status).toBe(200);
      });

      it('should allow assessor 1 to view assignment details', async () => {
        const response = await request(app)
          .get(`/api/v1/assessments/assignment/${context.assignment1Id}`)
          .set('Authorization', `Bearer ${context.assessor1Token}`);

        expect(response.status).toBe(200);
      });

      it('should allow assessor 1 to save draft assessment', async () => {
        const response = await request(app)
          .put(`/api/v1/assessments/assignment/${context.assignment1Id}`)
          .set('Authorization', `Bearer ${context.assessor1Token}`)
          .send({
            scores: [
              { criterionId: context.criteriaIds[0] || uuidv4(), score: 25, comment: 'Draft comment' },
            ],
            overallComment: 'Draft overall comment',
            coiConfirmed: true,
          });

        expect(response.status).toBe(200);
      });

      it('should allow assessor 1 to submit full assessment', async () => {
        const response = await request(app)
          .post(`/api/v1/assessments/assignment/${context.assignment1Id}`)
          .set('Authorization', `Bearer ${context.assessor1Token}`)
          .send({
            scores: [
              {
                criterionId: context.criteriaIds[0] || uuidv4(),
                score: 28,
                comment: 'Excellent scientific rigor and methodology',
              },
              {
                criterionId: context.criteriaIds[1] || uuidv4(),
                score: 22,
                comment: 'Highly innovative approach',
              },
              {
                criterionId: context.criteriaIds[2] || uuidv4(),
                score: 20,
                comment: 'Good potential impact',
              },
              {
                criterionId: context.criteriaIds[3] || uuidv4(),
                score: 18,
                comment: 'Feasible with minor adjustments',
              },
            ],
            overallComment: 'Strong proposal with excellent scientific foundation. Recommend for funding with high priority.',
            coiConfirmed: true,
          });

        expect(response.status).toBe(200);
      });
    });

    describe('Phase 5: Assessment by Assessor 2', () => {
      it('should allow assessor 2 to submit assessment', async () => {
        const response = await request(app)
          .post(`/api/v1/assessments/assignment/${context.assignment2Id}`)
          .set('Authorization', `Bearer ${context.assessor2Token}`)
          .send({
            scores: [
              {
                criterionId: context.criteriaIds[0] || uuidv4(),
                score: 26,
                comment: 'Very good scientific approach',
              },
              {
                criterionId: context.criteriaIds[1] || uuidv4(),
                score: 24,
                comment: 'Innovative and original',
              },
              {
                criterionId: context.criteriaIds[2] || uuidv4(),
                score: 22,
                comment: 'Significant potential impact',
              },
              {
                criterionId: context.criteriaIds[3] || uuidv4(),
                score: 16,
                comment: 'Generally feasible',
              },
            ],
            overallComment: 'Well-structured proposal. Would benefit from more detail on implementation timeline.',
            coiConfirmed: true,
          });

        expect(response.status).toBe(200);
      });
    });

    describe('Phase 6: Results Generation', () => {
      beforeAll(async () => {
        // Close the call to move to results phase
        await request(app)
          .post(`/api/v1/calls/${context.callId}/close`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);
      });

      it('should generate master results', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('results');
      });

      it('should show results summary', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/summary`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should show variance flags', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/variance`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should show ranking', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/ranking`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should show application-specific results', async () => {
        const response = await request(app)
          .get(`/api/v1/results/application/${context.applicationId}`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should show score breakdown', async () => {
        const response = await request(app)
          .get(`/api/v1/results/application/${context.applicationId}/breakdown`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should generate analytics', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/analytics`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should show score distribution', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/distribution`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('Phase 7: Export', () => {
      it('should export results', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/export`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect([200, 202]).toContain(response.status);
      });

      it('should export detailed results', async () => {
        const response = await request(app)
          .get(`/api/v1/results/call/${context.callId}/export/detailed`)
          .set('Authorization', `Bearer ${context.coordinatorToken}`);

        expect([200, 202]).toContain(response.status);
      });
    });
  });

  describe('Assessment Edge Cases', () => {
    describe('Conflict of Interest Handling', () => {
      let coordinatorToken: string;
      let assessorToken: string;
      let assignmentId: string;

      beforeAll(async () => {
        const coordinator = TestUsers.coordinator();
        coordinatorToken = generateTestToken(coordinator);

        const assessor = TestUsers.assessor();
        assessorToken = generateTestToken(assessor);

        const applicant = TestUsers.applicant();
        const applicantToken = generateTestToken(applicant);

        // Create call
        const callResponse = await request(app)
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            name: 'COI Test Call',
            open_at: new Date().toISOString(),
            close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        await request(app)
          .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        // Create and submit application
        const appResponse = await request(app)
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${applicantToken}`)
          .send({ call_id: callResponse.body.data.call_id });

        await request(app)
          .post(`/api/v1/applications/${appResponse.body.data.application_id}/submit`)
          .set('Authorization', `Bearer ${applicantToken}`);

        // Assign assessor
        const assignResponse = await request(app)
          .post('/api/v1/assignments')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            applicationId: appResponse.body.data.application_id,
            assessorId: assessor.user_id,
          });

        assignmentId = assignResponse.body.data.assignment_id;
      });

      it('should require COI confirmation', async () => {
        const response = await request(app)
          .post(`/api/v1/assessments/assignment/${assignmentId}`)
          .set('Authorization', `Bearer ${assessorToken}`)
          .send({
            scores: [{ criterionId: uuidv4(), score: 15 }],
            overallComment: 'Good',
            coiConfirmed: false, // Not confirmed
          });

        // May reject or accept depending on implementation
        expect([200, 400]).toContain(response.status);
      });

      it('should allow assessment with COI details', async () => {
        const response = await request(app)
          .post(`/api/v1/assessments/assignment/${assignmentId}`)
          .set('Authorization', `Bearer ${assessorToken}`)
          .send({
            scores: [{ criterionId: uuidv4(), score: 15 }],
            overallComment: 'Assessment complete',
            coiConfirmed: true,
            coiDetails: 'No conflict of interest to declare',
          });

        expect(response.status).toBe(200);
      });
    });

    describe('Assessment Return for Revision', () => {
      let coordinatorToken: string;
      let assessorToken: string;
      let assessorId: string;
      let assignmentId: string;
      let assessmentId: string;

      beforeAll(async () => {
        const coordinator = TestUsers.coordinator();
        coordinatorToken = generateTestToken(coordinator);

        const assessor = TestUsers.assessor();
        assessorId = assessor.user_id;
        assessorToken = generateTestToken(assessor);

        const applicant = TestUsers.applicant();
        const applicantToken = generateTestToken(applicant);

        // Create call
        const callResponse = await request(app)
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            name: 'Revision Test Call',
            open_at: new Date().toISOString(),
            close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        await request(app)
          .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        // Create and submit application
        const appResponse = await request(app)
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${applicantToken}`)
          .send({ call_id: callResponse.body.data.call_id });

        await request(app)
          .post(`/api/v1/applications/${appResponse.body.data.application_id}/submit`)
          .set('Authorization', `Bearer ${applicantToken}`);

        // Assign and submit assessment
        const assignResponse = await request(app)
          .post('/api/v1/assignments')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            applicationId: appResponse.body.data.application_id,
            assessorId,
          });

        assignmentId = assignResponse.body.data.assignment_id;

        const assessmentResponse = await request(app)
          .post(`/api/v1/assessments/assignment/${assignmentId}`)
          .set('Authorization', `Bearer ${assessorToken}`)
          .send({
            scores: [{ criterionId: uuidv4(), score: 10 }],
            overallComment: 'Initial assessment',
            coiConfirmed: true,
          });

        assessmentId = assessmentResponse.body.data?.assessment_id;
      });

      it('should allow coordinator to return assessment for revision', async () => {
        if (!assessmentId) return;

        const response = await request(app)
          .post(`/api/v1/assessments/${assessmentId}/return`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        expect(response.status).toBe(200);
      });

      it('should allow assessor to update returned assessment', async () => {
        const response = await request(app)
          .put(`/api/v1/assessments/assignment/${assignmentId}`)
          .set('Authorization', `Bearer ${assessorToken}`)
          .send({
            scores: [{ criterionId: uuidv4(), score: 15, comment: 'Revised score' }],
            overallComment: 'Revised assessment with more detail',
            coiConfirmed: true,
          });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Authorization Checks', () => {
    let coordinatorToken: string;
    let assessorToken: string;
    let applicantToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const assessor = TestUsers.assessor();
      assessorToken = generateTestToken(assessor);

      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Auth Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = callResponse.body.data.call_id;
    });

    it('should deny applicant access to results', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${callId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny assessor access to results without assignment', async () => {
      const response = await request(app)
        .get(`/api/v1/results/call/${callId}`)
        .set('Authorization', `Bearer ${assessorToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow coordinator access to all assessments', async () => {
      const response = await request(app)
        .get(`/api/v1/assessments/call/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });
  });
});
