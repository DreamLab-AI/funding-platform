import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { config } from '../config';
import {
  SubmissionReceiptData,
  AssessorAssignmentData,
  ReminderData,
} from '../types';
import { logger } from '../utils/logger';
import { formatDate } from '../utils/helpers';

// Initialize SendGrid if API key is available
if (config.email.sendgridApiKey) {
  sgMail.setApiKey(config.email.sendgridApiKey);
}

// Create SMTP transporter for fallback
const smtpTransporter = config.email.smtp.host
  ? nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.password,
      },
    })
  : null;

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using SendGrid or SMTP
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (config.email.sendgridApiKey) {
      // Use SendGrid
      await sgMail.send({
        to: options.to,
        from: {
          email: config.email.from,
          name: config.email.fromName,
        },
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info('Email sent via SendGrid', { to: options.to, subject: options.subject });
      return true;
    } else if (smtpTransporter) {
      // Use SMTP
      await smtpTransporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info('Email sent via SMTP', { to: options.to, subject: options.subject });
      return true;
    } else {
      logger.warn('No email provider configured', { to: options.to, subject: options.subject });
      return false;
    }
  } catch (error) {
    logger.error('Failed to send email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
    });
    return false;
  }
}

export class EmailService {
  /**
   * Send application submission receipt
   */
  static async sendSubmissionReceipt(
    email: string,
    data: SubmissionReceiptData
  ): Promise<boolean> {
    const subject = `Application Received - ${data.call_name}`;
    const submittedAt = formatDate(data.submitted_at, 'DD MMMM YYYY [at] HH:mm');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1d4ed8; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .reference { font-size: 18px; font-weight: bold; color: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Received</h1>
          </div>
          <div class="content">
            <p>Dear ${data.applicant_name},</p>
            <p>Thank you for submitting your application. We have received your submission successfully.</p>

            <div class="details">
              <p><strong>Funding Call:</strong> ${data.call_name}</p>
              <p><strong>Reference Number:</strong> <span class="reference">${data.application_reference}</span></p>
              <p><strong>Submitted:</strong> ${submittedAt} (UK Time)</p>
            </div>

            <p>Please keep this email for your records. You may be contacted if further information is required.</p>
            <p>Your application reference number is: <strong>${data.application_reference}</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Funding Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Application Received

Dear ${data.applicant_name},

Thank you for submitting your application. We have received your submission successfully.

Funding Call: ${data.call_name}
Reference Number: ${data.application_reference}
Submitted: ${submittedAt} (UK Time)

Please keep this email for your records. You may be contacted if further information is required.

Your application reference number is: ${data.application_reference}

This is an automated message. Please do not reply to this email.
    `.trim();

    return sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send assessor assignment notification
   */
  static async sendAssessorAssignment(
    email: string,
    data: AssessorAssignmentData
  ): Promise<boolean> {
    const subject = `New Assessment Assignment - ${data.call_name}`;
    const dueDate = data.due_at
      ? formatDate(data.due_at, 'DD MMMM YYYY')
      : 'Not specified';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Assessment Assignment</h1>
          </div>
          <div class="content">
            <p>Dear ${data.assessor_name},</p>
            <p>You have been assigned to assess applications for the following funding call:</p>

            <div class="details">
              <p><strong>Funding Call:</strong> ${data.call_name}</p>
              <p><strong>Applications Assigned:</strong> ${data.application_count}</p>
              <p><strong>Due Date:</strong> ${dueDate}</p>
            </div>

            <p>Please log in to the platform to review and assess the assigned applications.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.login_url}" class="button">Access Assessment Portal</a>
            </p>

            <p>If you have any questions or concerns about your assignment, please contact the programme coordinator.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Funding Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
New Assessment Assignment

Dear ${data.assessor_name},

You have been assigned to assess applications for the following funding call:

Funding Call: ${data.call_name}
Applications Assigned: ${data.application_count}
Due Date: ${dueDate}

Please log in to the platform to review and assess the assigned applications.

Access the Assessment Portal: ${data.login_url}

If you have any questions or concerns about your assignment, please contact the programme coordinator.

This is an automated message. Please do not reply to this email.
    `.trim();

    return sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send assessment reminder
   */
  static async sendReminder(email: string, data: ReminderData): Promise<boolean> {
    const subject = `Reminder: Assessments Due - ${data.call_name}`;
    const dueDate = data.due_at
      ? formatDate(data.due_at, 'DD MMMM YYYY')
      : 'as soon as possible';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .highlight { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Assessment Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${data.assessor_name},</p>

            <div class="highlight">
              <p><strong>You have ${data.outstanding_count} outstanding assessment(s)</strong> for ${data.call_name}.</p>
            </div>

            <div class="details">
              <p><strong>Funding Call:</strong> ${data.call_name}</p>
              <p><strong>Outstanding Assessments:</strong> ${data.outstanding_count}</p>
              <p><strong>Due:</strong> ${dueDate}</p>
            </div>

            <p>Please complete your assessments at your earliest convenience.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.login_url}" class="button">Complete Assessments</a>
            </p>

            <p>If you are unable to complete the assessments or have any concerns, please contact the programme coordinator immediately.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Funding Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Assessment Reminder

Dear ${data.assessor_name},

You have ${data.outstanding_count} outstanding assessment(s) for ${data.call_name}.

Funding Call: ${data.call_name}
Outstanding Assessments: ${data.outstanding_count}
Due: ${dueDate}

Please complete your assessments at your earliest convenience.

Access the Assessment Portal: ${data.login_url}

If you are unable to complete the assessments or have any concerns, please contact the programme coordinator immediately.

This is an automated message. Please do not reply to this email.
    `.trim();

    return sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send bulk reminders to multiple assessors
   */
  static async sendBulkReminders(
    reminders: Array<{ email: string; data: ReminderData }>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const { email, data } of reminders) {
      const success = await this.sendReminder(email, data);
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }

  /**
   * Verify email configuration is valid
   */
  static async verifyConfiguration(): Promise<boolean> {
    if (config.email.sendgridApiKey) {
      return true; // SendGrid doesn't have a verify method, assume valid if key exists
    }

    if (smtpTransporter) {
      try {
        await smtpTransporter.verify();
        return true;
      } catch (error) {
        logger.error('SMTP verification failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    }

    return false;
  }
}

// Proxy object that delegates to static methods
export const emailService = {
  sendSubmissionReceipt: EmailService.sendSubmissionReceipt,
  sendAssessorAssignment: EmailService.sendAssessorAssignment,
  sendAssignmentNotification: EmailService.sendAssessorAssignment, // Alias
  sendReminder: EmailService.sendReminder,
  sendReminderEmail: EmailService.sendReminder, // Alias
  sendBulkReminders: EmailService.sendBulkReminders,
  verifyConfiguration: EmailService.verifyConfiguration,
};

export default EmailService;
