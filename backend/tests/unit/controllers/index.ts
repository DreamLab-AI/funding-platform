/**
 * Controller Unit Tests Index
 *
 * This module exports all controller test suites for the funding platform.
 *
 * Test Coverage:
 * - auth.controller.test.ts: Authentication, registration, login, password management
 * - applications.controller.test.ts: Application CRUD, submission, file management
 * - assessments.controller.test.ts: Assessment creation, scoring, submission
 * - calls.controller.test.ts: Funding call management, assessor pool
 * - results.controller.test.ts: Results aggregation, analytics, export
 *
 * Run all controller tests:
 *   npm test -- tests/unit/controllers/
 *
 * Run specific controller test:
 *   npm test -- tests/unit/controllers/auth.controller.test.ts
 *
 * Run with coverage:
 *   npm run test:coverage -- tests/unit/controllers/
 */

export * from './auth.controller.test';
export * from './applications.controller.test';
export * from './assessments.controller.test';
export * from './calls.controller.test';
export * from './results.controller.test';
