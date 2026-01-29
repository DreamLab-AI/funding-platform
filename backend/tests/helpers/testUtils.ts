/**
 * Test Utilities
 * Common helper functions for testing
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a mock JWT token for testing
 */
export function generateMockToken(payload: {
  userId: string;
  role: 'applicant' | 'assessor' | 'coordinator' | 'scheme_owner';
  email?: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    sub: payload.userId,
    role: payload.role,
    email: payload.email || `${payload.role}@test.com`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${body}.${signature}`;
}

/**
 * Create a mock request object
 */
export function createMockRequest(overrides: Partial<any> = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    method: 'GET',
    path: '/',
    ...overrides,
  };
}

/**
 * Create a mock response object
 */
export function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res.body = data;
    return res;
  });
  res.send = jest.fn((data: any) => {
    res.body = data;
    return res;
  });
  res.setHeader = jest.fn((key: string, value: string) => {
    res.headers[key] = value;
    return res;
  });
  res.end = jest.fn();
  return res;
}

/**
 * Create a mock next function
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random email address
 */
export function randomEmail(): string {
  return `test-${uuidv4().slice(0, 8)}@test.com`;
}

/**
 * Generate a random string
 */
export function randomString(length: number = 10): string {
  return uuidv4().replace(/-/g, '').slice(0, length);
}

/**
 * Create a date in Europe/London timezone
 */
export function createLondonDate(dateStr: string): Date {
  const date = new Date(dateStr);
  return date;
}

/**
 * Get current time in Europe/London timezone
 */
export function getLondonNow(): Date {
  return new Date();
}

/**
 * Create a future date (days from now)
 */
export function futureDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Create a past date (days ago)
 */
export function pastDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Mock file buffer for upload tests
 */
export function createMockFileBuffer(
  content: string = 'test content',
  mimeType: string = 'application/pdf'
): { buffer: Buffer; mimetype: string; originalname: string; size: number } {
  const buffer = Buffer.from(content);
  return {
    buffer,
    mimetype: mimeType,
    originalname: `test-file-${randomString(6)}.pdf`,
    size: buffer.length,
  };
}

/**
 * Assert that an object has all required properties
 */
export function assertHasProperties(obj: any, properties: string[]): void {
  properties.forEach(prop => {
    expect(obj).toHaveProperty(prop);
  });
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create mock audit log entry
 */
export function expectAuditLog(
  auditService: any,
  action: string,
  targetType: string
): void {
  expect(auditService.log).toHaveBeenCalledWith(
    expect.objectContaining({
      action,
      targetType,
    })
  );
}
