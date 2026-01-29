/**
 * Email Service Mock
 * Mock utilities for email providers (SendGrid, Nodemailer)
 */

export interface MockEmailMessage {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    type: string;
    disposition?: string;
  }>;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface MockEmailResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

/**
 * Create mock SendGrid client
 */
export function createMockSendGrid() {
  const sentEmails: MockEmailMessage[] = [];

  return {
    setApiKey: jest.fn(),

    send: jest.fn().mockImplementation(async (msg: MockEmailMessage): Promise<MockEmailResponse[]> => {
      sentEmails.push(msg);
      return [{
        statusCode: 202,
        body: {},
        headers: {
          'x-message-id': `mock-message-id-${Date.now()}`,
        },
      }];
    }),

    sendMultiple: jest.fn().mockImplementation(async (msgs: MockEmailMessage[]): Promise<MockEmailResponse[]> => {
      msgs.forEach(msg => sentEmails.push(msg));
      return msgs.map(() => ({
        statusCode: 202,
        body: {},
        headers: {
          'x-message-id': `mock-message-id-${Date.now()}`,
        },
      }));
    }),

    getSentEmails: () => [...sentEmails],
    clearSentEmails: () => { sentEmails.length = 0; },
    getLastEmail: () => sentEmails[sentEmails.length - 1] || null,
    getEmailsTo: (email: string) => sentEmails.filter(e =>
      Array.isArray(e.to) ? e.to.includes(email) : e.to === email
    ),
  };
}

/**
 * Create mock Nodemailer transporter
 */
export function createMockNodemailer() {
  const sentEmails: MockEmailMessage[] = [];

  const transporter = {
    sendMail: jest.fn().mockImplementation(async (options: MockEmailMessage) => {
      sentEmails.push(options);
      return {
        messageId: `mock-message-id-${Date.now()}`,
        envelope: {
          from: options.from,
          to: Array.isArray(options.to) ? options.to : [options.to],
        },
        accepted: Array.isArray(options.to) ? options.to : [options.to],
        rejected: [],
        pending: [],
        response: '250 OK',
      };
    }),

    verify: jest.fn().mockResolvedValue(true),

    close: jest.fn(),

    getSentEmails: () => [...sentEmails],
    clearSentEmails: () => { sentEmails.length = 0; },
    getLastEmail: () => sentEmails[sentEmails.length - 1] || null,
  };

  return {
    createTransport: jest.fn().mockReturnValue(transporter),
    transporter,
  };
}

/**
 * Create mock email service
 */
export function createMockEmailService() {
  const sentEmails: MockEmailMessage[] = [];
  const failedEmails: Array<{ email: MockEmailMessage; error: Error }> = [];

  return {
    send: jest.fn().mockImplementation(async (message: MockEmailMessage) => {
      sentEmails.push(message);
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }),

    sendTemplate: jest.fn().mockImplementation(async (
      to: string,
      templateId: string,
      data: Record<string, any>
    ) => {
      sentEmails.push({
        to,
        from: 'noreply@test.com',
        subject: `Template: ${templateId}`,
        templateId,
        dynamicTemplateData: data,
      });
      return {
        success: true,
        messageId: `mock-template-${Date.now()}`,
      };
    }),

    sendBulk: jest.fn().mockImplementation(async (messages: MockEmailMessage[]) => {
      messages.forEach(msg => sentEmails.push(msg));
      return {
        success: true,
        sent: messages.length,
        failed: 0,
      };
    }),

    // Test utilities
    getSentEmails: () => [...sentEmails],
    clearSentEmails: () => { sentEmails.length = 0; },
    getLastEmail: () => sentEmails[sentEmails.length - 1] || null,
    getEmailsTo: (email: string) => sentEmails.filter(e =>
      Array.isArray(e.to) ? e.to.includes(email) : e.to === email
    ),
    getEmailsBySubject: (subject: string) => sentEmails.filter(e =>
      e.subject.includes(subject)
    ),
    getFailedEmails: () => [...failedEmails],

    // Simulation helpers
    simulateFailure: () => {
      return jest.fn().mockRejectedValue(new Error('Email delivery failed'));
    },
    simulateRateLimit: () => {
      return jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
    },
  };
}

/**
 * Mock email templates
 */
export const mockEmailTemplates = {
  APPLICATION_SUBMITTED: 'd-application-submitted',
  APPLICATION_APPROVED: 'd-application-approved',
  APPLICATION_REJECTED: 'd-application-rejected',
  ASSESSMENT_ASSIGNED: 'd-assessment-assigned',
  ASSESSMENT_REMINDER: 'd-assessment-reminder',
  PASSWORD_RESET: 'd-password-reset',
  WELCOME: 'd-welcome',
  DEADLINE_REMINDER: 'd-deadline-reminder',
  RESULTS_PUBLISHED: 'd-results-published',
};

/**
 * Create test email message
 */
export function createTestEmailMessage(overrides: Partial<MockEmailMessage> = {}): MockEmailMessage {
  return {
    to: 'test@example.com',
    from: 'noreply@fundingplatform.com',
    subject: 'Test Email',
    text: 'This is a test email',
    html: '<p>This is a test email</p>',
    ...overrides,
  };
}

/**
 * Assert email was sent
 */
export function assertEmailSent(
  mockService: ReturnType<typeof createMockEmailService>,
  criteria: Partial<MockEmailMessage>
): void {
  const emails = mockService.getSentEmails();
  const found = emails.some(email =>
    Object.entries(criteria).every(([key, value]) =>
      email[key as keyof MockEmailMessage] === value
    )
  );

  if (!found) {
    throw new Error(
      `Expected email matching criteria was not sent.\nCriteria: ${JSON.stringify(criteria)}\nSent emails: ${JSON.stringify(emails, null, 2)}`
    );
  }
}

export default {
  createMockSendGrid,
  createMockNodemailer,
  createMockEmailService,
  mockEmailTemplates,
  createTestEmailMessage,
  assertEmailSent,
};
