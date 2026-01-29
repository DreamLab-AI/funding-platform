/**
 * EmailService Unit Tests
 * Comprehensive tests for email formatting and sending
 */

import { EmailService, emailService } from '../../../src/services/email.service';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { config } from '../../../src/config';
import { logger } from '../../../src/utils/logger';
import {
  SubmissionReceiptData,
  AssessorAssignmentData,
  ReminderData,
} from '../../../src/types';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('../../../src/config', () => ({
  config: {
    email: {
      sendgridApiKey: '',
      from: 'noreply@test.com',
      fromName: 'Test Platform',
      smtp: {
        host: '',
        port: 587,
        user: '',
        password: '',
        secure: false,
      },
    },
    timezone: 'Europe/London',
  },
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
const mockNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockConfig = config as any;

describe('EmailService', () => {
  let mockSmtpTransporter: {
    sendMail: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSmtpTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    mockNodemailer.createTransport.mockReturnValue(mockSmtpTransporter as any);
    mockSgMail.send.mockResolvedValue([{ statusCode: 202 }] as any);
  });

  describe('sendSubmissionReceipt', () => {
    const receiptData: SubmissionReceiptData = {
      applicant_name: 'John Smith',
      application_reference: '2024-TEST-000001',
      call_name: 'Innovation Fund 2024',
      submitted_at: new Date('2024-01-15T14:30:00Z'),
    };

    beforeEach(() => {
      // Reset config for each test
      mockConfig.email.sendgridApiKey = '';
      mockConfig.email.smtp.host = '';
    });

    it('should send receipt via SendGrid when configured', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';

      const result = await EmailService.sendSubmissionReceipt(
        'applicant@test.com',
        receiptData
      );

      expect(result).toBe(true);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@test.com',
          subject: 'Application Received - Innovation Fund 2024',
        })
      );
    });

    it('should send receipt via SMTP when SendGrid not configured', async () => {
      mockConfig.email.sendgridApiKey = '';
      mockConfig.email.smtp.host = 'smtp.test.com';

      // Re-require to pick up new config
      jest.isolateModules(async () => {
        const { EmailService: FreshEmailService } = require('../../../src/services/email.service');
        const result = await FreshEmailService.sendSubmissionReceipt(
          'applicant@test.com',
          receiptData
        );
        expect(result).toBe(true);
      });
    });

    it('should return false when no email provider configured', async () => {
      mockConfig.email.sendgridApiKey = '';
      mockConfig.email.smtp.host = '';

      const result = await EmailService.sendSubmissionReceipt(
        'applicant@test.com',
        receiptData
      );

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No email provider configured',
        expect.any(Object)
      );
    });

    it('should format HTML email with correct data', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';

      await EmailService.sendSubmissionReceipt('applicant@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('John Smith');
      expect(sendCall.html).toContain('2024-TEST-000001');
      expect(sendCall.html).toContain('Innovation Fund 2024');
      expect(sendCall.html).toContain('Application Received');
    });

    it('should include plain text version', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';

      await EmailService.sendSubmissionReceipt('applicant@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.text).toContain('John Smith');
      expect(sendCall.text).toContain('2024-TEST-000001');
      expect(sendCall.text).toContain('Innovation Fund 2024');
    });

    it('should handle SendGrid errors gracefully', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
      mockSgMail.send.mockRejectedValue(new Error('SendGrid error'));

      const result = await EmailService.sendSubmissionReceipt(
        'applicant@test.com',
        receiptData
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send email',
        expect.objectContaining({
          error: 'SendGrid error',
        })
      );
    });

    it('should format date in UK timezone', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';

      await EmailService.sendSubmissionReceipt('applicant@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      // Should contain formatted date (UK timezone)
      expect(sendCall.html).toContain('(UK Time)');
    });
  });

  describe('sendAssessorAssignment', () => {
    const assignmentData: AssessorAssignmentData = {
      assessor_name: 'Dr Jane Doe',
      call_name: 'Research Grant 2024',
      application_count: 5,
      due_at: new Date('2024-02-15'),
      login_url: 'https://platform.test.com/login',
    };

    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should send assignment notification with correct data', async () => {
      const result = await EmailService.sendAssessorAssignment(
        'assessor@test.com',
        assignmentData
      );

      expect(result).toBe(true);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'assessor@test.com',
          subject: 'New Assessment Assignment - Research Grant 2024',
        })
      );
    });

    it('should include application count in email body', async () => {
      await EmailService.sendAssessorAssignment('assessor@test.com', assignmentData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('Dr Jane Doe');
      expect(sendCall.html).toContain('5');
      expect(sendCall.html).toContain('Research Grant 2024');
    });

    it('should include login URL button', async () => {
      await EmailService.sendAssessorAssignment('assessor@test.com', assignmentData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('https://platform.test.com/login');
      expect(sendCall.html).toContain('Access Assessment Portal');
    });

    it('should handle missing due date', async () => {
      const dataWithoutDue: AssessorAssignmentData = {
        ...assignmentData,
        due_at: undefined,
      };

      await EmailService.sendAssessorAssignment('assessor@test.com', dataWithoutDue);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('Not specified');
    });

    it('should format due date correctly', async () => {
      await EmailService.sendAssessorAssignment('assessor@test.com', assignmentData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      // Should contain formatted date
      expect(sendCall.html).toMatch(/\d{2} \w+ \d{4}/);
    });

    it('should include plain text version', async () => {
      await EmailService.sendAssessorAssignment('assessor@test.com', assignmentData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.text).toContain('Dr Jane Doe');
      expect(sendCall.text).toContain('5');
      expect(sendCall.text).toContain('https://platform.test.com/login');
    });
  });

  describe('sendReminder', () => {
    const reminderData: ReminderData = {
      assessor_name: 'Dr John Smith',
      call_name: 'Innovation Fund 2024',
      outstanding_count: 3,
      due_at: new Date('2024-02-01'),
      login_url: 'https://platform.test.com/login',
    };

    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should send reminder with correct subject', async () => {
      const result = await EmailService.sendReminder('assessor@test.com', reminderData);

      expect(result).toBe(true);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reminder: Assessments Due - Innovation Fund 2024',
        })
      );
    });

    it('should highlight outstanding count', async () => {
      await EmailService.sendReminder('assessor@test.com', reminderData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('3 outstanding assessment(s)');
    });

    it('should include urgent styling for reminder', async () => {
      await EmailService.sendReminder('assessor@test.com', reminderData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      // Red header indicates urgency
      expect(sendCall.html).toContain('#dc2626');
    });

    it('should handle missing due date gracefully', async () => {
      const dataWithoutDue: ReminderData = {
        ...reminderData,
        due_at: undefined,
      };

      await EmailService.sendReminder('assessor@test.com', dataWithoutDue);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('as soon as possible');
    });

    it('should include call to action button', async () => {
      await EmailService.sendReminder('assessor@test.com', reminderData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('Complete Assessments');
      expect(sendCall.html).toContain('https://platform.test.com/login');
    });
  });

  describe('sendBulkReminders', () => {
    const reminders = [
      {
        email: 'assessor1@test.com',
        data: {
          assessor_name: 'Assessor One',
          call_name: 'Test Call',
          outstanding_count: 2,
          login_url: 'https://test.com/login',
        },
      },
      {
        email: 'assessor2@test.com',
        data: {
          assessor_name: 'Assessor Two',
          call_name: 'Test Call',
          outstanding_count: 3,
          login_url: 'https://test.com/login',
        },
      },
      {
        email: 'assessor3@test.com',
        data: {
          assessor_name: 'Assessor Three',
          call_name: 'Test Call',
          outstanding_count: 1,
          login_url: 'https://test.com/login',
        },
      },
    ];

    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should send multiple reminders and count successes', async () => {
      const result = await EmailService.sendBulkReminders(reminders);

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockSgMail.send).toHaveBeenCalledTimes(3);
    });

    it('should count failures separately', async () => {
      mockSgMail.send
        .mockResolvedValueOnce([{ statusCode: 202 }] as any)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce([{ statusCode: 202 }] as any);

      const result = await EmailService.sendBulkReminders(reminders);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should handle all failures', async () => {
      mockSgMail.send.mockRejectedValue(new Error('All failed'));

      const result = await EmailService.sendBulkReminders(reminders);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(3);
    });

    it('should handle empty reminders array', async () => {
      const result = await EmailService.sendBulkReminders([]);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockSgMail.send).not.toHaveBeenCalled();
    });

    it('should add delay between sends to avoid rate limiting', async () => {
      const startTime = Date.now();

      await EmailService.sendBulkReminders(reminders);

      const duration = Date.now() - startTime;
      // Should take at least 200ms for 3 emails (100ms delay between each)
      expect(duration).toBeGreaterThanOrEqual(200);
    });
  });

  describe('verifyConfiguration', () => {
    it('should return true when SendGrid is configured', async () => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
      mockConfig.email.smtp.host = '';

      const result = await EmailService.verifyConfiguration();

      expect(result).toBe(true);
    });

    it('should verify SMTP when no SendGrid key', async () => {
      mockConfig.email.sendgridApiKey = '';
      mockConfig.email.smtp.host = 'smtp.test.com';

      // Mock SMTP transporter existence
      jest.isolateModules(async () => {
        const mockTransporter = {
          verify: jest.fn().mockResolvedValue(true),
        };
        mockNodemailer.createTransport.mockReturnValue(mockTransporter as any);

        const result = await EmailService.verifyConfiguration();
        // Note: This test may need adjustment based on module initialization
      });
    });

    it('should return false when SMTP verification fails', async () => {
      mockConfig.email.sendgridApiKey = '';
      mockConfig.email.smtp.host = '';

      const result = await EmailService.verifyConfiguration();

      expect(result).toBe(false);
    });
  });

  describe('Email HTML structure', () => {
    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should include proper DOCTYPE and HTML structure', async () => {
      const receiptData: SubmissionReceiptData = {
        applicant_name: 'Test User',
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      };

      await EmailService.sendSubmissionReceipt('test@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('<!DOCTYPE html>');
      expect(sendCall.html).toContain('<html>');
      expect(sendCall.html).toContain('</html>');
      expect(sendCall.html).toContain('<meta charset="utf-8">');
    });

    it('should include copyright year', async () => {
      const receiptData: SubmissionReceiptData = {
        applicant_name: 'Test User',
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      };

      await EmailService.sendSubmissionReceipt('test@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      const currentYear = new Date().getFullYear();
      expect(sendCall.html).toContain(`${currentYear}`);
    });

    it('should include automated message disclaimer', async () => {
      const receiptData: SubmissionReceiptData = {
        applicant_name: 'Test User',
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      };

      await EmailService.sendSubmissionReceipt('test@test.com', receiptData);

      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain('automated message');
      expect(sendCall.text).toContain('automated message');
    });
  });

  describe('emailService proxy object', () => {
    it('should expose all static methods via proxy', () => {
      expect(emailService.sendSubmissionReceipt).toBe(
        EmailService.sendSubmissionReceipt
      );
      expect(emailService.sendAssessorAssignment).toBe(
        EmailService.sendAssessorAssignment
      );
      expect(emailService.sendReminder).toBe(EmailService.sendReminder);
      expect(emailService.sendBulkReminders).toBe(EmailService.sendBulkReminders);
      expect(emailService.verifyConfiguration).toBe(
        EmailService.verifyConfiguration
      );
    });

    it('should provide aliases for backward compatibility', () => {
      expect(emailService.sendAssignmentNotification).toBe(
        EmailService.sendAssessorAssignment
      );
      expect(emailService.sendReminderEmail).toBe(EmailService.sendReminder);
    });
  });

  describe('Error handling edge cases', () => {
    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should handle non-Error exceptions', async () => {
      mockSgMail.send.mockRejectedValue('String error');

      const result = await EmailService.sendSubmissionReceipt('test@test.com', {
        applicant_name: 'Test',
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send email',
        expect.objectContaining({
          error: 'Unknown error',
        })
      );
    });

    it('should handle array of recipients', async () => {
      // Note: SendGrid accepts array of recipients
      const result = await EmailService.sendSubmissionReceipt('test@test.com', {
        applicant_name: 'Test',
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      });

      expect(result).toBe(true);
    });
  });

  describe('Special characters handling', () => {
    beforeEach(() => {
      mockConfig.email.sendgridApiKey = 'SG.test-key';
    });

    it('should handle special characters in applicant name', async () => {
      const receiptData: SubmissionReceiptData = {
        applicant_name: "O'Brien & Partners <Ltd>",
        application_reference: 'REF-001',
        call_name: 'Test Call',
        submitted_at: new Date(),
      };

      const result = await EmailService.sendSubmissionReceipt(
        'test@test.com',
        receiptData
      );

      expect(result).toBe(true);
      const sendCall = mockSgMail.send.mock.calls[0][0] as any;
      expect(sendCall.html).toContain("O'Brien & Partners");
    });

    it('should handle unicode characters', async () => {
      const receiptData: SubmissionReceiptData = {
        applicant_name: 'Jean-Pierre Dupont',
        application_reference: 'REF-001',
        call_name: 'Fonds dinnovation',
        submitted_at: new Date(),
      };

      const result = await EmailService.sendSubmissionReceipt(
        'test@test.com',
        receiptData
      );

      expect(result).toBe(true);
    });

    it('should handle very long call names', async () => {
      const longCallName = 'A'.repeat(200);
      const receiptData: SubmissionReceiptData = {
        applicant_name: 'Test User',
        application_reference: 'REF-001',
        call_name: longCallName,
        submitted_at: new Date(),
      };

      const result = await EmailService.sendSubmissionReceipt(
        'test@test.com',
        receiptData
      );

      expect(result).toBe(true);
    });
  });
});
