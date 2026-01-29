/**
 * Mock Index
 * Central export for all test mocks
 */

// Database mocks
export {
  createMockPool,
  createMockPoolClient,
  createQueryResult,
  createMockDbConnection,
  createMockTransaction,
  setupQueryResponses,
  MockDatabaseError,
  DB_ERROR_CODES,
  createMockDatabaseOperations,
} from './database.mock';

// Email mocks
export {
  createMockSendGrid,
  createMockNodemailer,
  createMockEmailService,
  mockEmailTemplates,
  createTestEmailMessage,
  assertEmailSent,
} from './email.mock';

// File and S3 mocks
export {
  createMockFile,
  createMockMulter,
  createMockS3Client,
  createMockPresigner,
  createMockFileSystem,
  mockFileTypes,
} from './file.mock';

// AI provider mocks
export {
  createMockOpenAI,
  createMockAnthropic,
  createMockOllama,
  createMockLMStudio,
  createMockAIService,
  createMockStreamingResponse,
  mockAIResponses,
} from './ai.mock';

// Re-export types
export type { MockQueryResult, MockPoolClient } from './database.mock';
export type { MockEmailMessage, MockEmailResponse } from './email.mock';
export type { MockFile, MockS3Object } from './file.mock';
export type {
  MockChatMessage,
  MockChatCompletion,
  MockEmbedding,
  MockEmbeddingResponse,
} from './ai.mock';
