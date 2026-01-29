/**
 * Test Database Setup and Utilities
 *
 * Provides isolated database operations for integration testing
 * using a test-specific database schema or in-memory mocking.
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
  database: process.env.TEST_DB_NAME || 'funding_platform_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Test pool - only created when needed
let testPool: Pool | null = null;

/**
 * Get or create the test database pool
 */
export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool(TEST_DB_CONFIG);
  }
  return testPool;
}

/**
 * Close the test database pool
 */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Execute a query on the test database
 */
export async function testQuery<T>(
  text: string,
  values?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getTestPool();
  try {
    const result = await pool.query(text, values);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
  } catch (error) {
    console.error('Test database query error:', error);
    throw error;
  }
}

/**
 * Initialize test database schema
 * Creates all necessary tables for testing
 */
export async function initTestDatabase(): Promise<void> {
  const pool = getTestPool();
  const client = await pool.connect();

  try {
    // Create tables in correct order (respecting foreign keys)
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'applicant',
        organisation VARCHAR(255),
        expertise_tags TEXT[],
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        mfa_enabled BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Funding calls table
      CREATE TABLE IF NOT EXISTS funding_calls (
        call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        open_at TIMESTAMP WITH TIME ZONE NOT NULL,
        close_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        submission_requirements JSONB NOT NULL DEFAULT '{}',
        criteria JSONB NOT NULL DEFAULT '[]',
        required_assessors_per_application INTEGER DEFAULT 2,
        variance_threshold DECIMAL(5, 2),
        retention_years INTEGER DEFAULT 7,
        created_by UUID REFERENCES users(user_id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Assessor pool table
      CREATE TABLE IF NOT EXISTS assessor_pool (
        pool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES funding_calls(call_id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        expertise_tags TEXT[],
        is_active BOOLEAN DEFAULT true,
        invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        accepted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(call_id, user_id)
      );

      -- Applications table
      CREATE TABLE IF NOT EXISTS applications (
        application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES funding_calls(call_id) ON DELETE CASCADE,
        applicant_id UUID REFERENCES users(user_id),
        reference_number VARCHAR(50) UNIQUE NOT NULL,
        applicant_name VARCHAR(255) NOT NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_organisation VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        submitted_at TIMESTAMP WITH TIME ZONE,
        withdrawn_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Application files table
      CREATE TABLE IF NOT EXISTS application_files (
        file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES applications(application_id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        scan_status VARCHAR(50) DEFAULT 'pending',
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Confirmations table
      CREATE TABLE IF NOT EXISTS confirmations (
        confirmation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES applications(application_id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address VARCHAR(45),
        UNIQUE(application_id, type)
      );

      -- Assignments table
      CREATE TABLE IF NOT EXISTS assignments (
        assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES applications(application_id) ON DELETE CASCADE,
        assessor_id UUID REFERENCES users(user_id),
        assigned_by UUID REFERENCES users(user_id),
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        due_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(application_id, assessor_id)
      );

      -- Assessments table
      CREATE TABLE IF NOT EXISTS assessments (
        assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id UUID REFERENCES assignments(assignment_id) ON DELETE CASCADE UNIQUE,
        scores JSONB NOT NULL DEFAULT '[]',
        overall_score DECIMAL(5, 2) DEFAULT 0,
        overall_comment TEXT,
        coi_confirmed BOOLEAN DEFAULT false,
        coi_details TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        submitted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Audit logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID,
        actor_role VARCHAR(50),
        actor_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(100),
        target_id VARCHAR(255),
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Nostr identities table
      CREATE TABLE IF NOT EXISTS nostr_identities (
        identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
        pubkey VARCHAR(64) UNIQUE NOT NULL,
        did VARCHAR(100) UNIQUE NOT NULL,
        nip05 VARCHAR(255),
        nip05_verified BOOLEAN DEFAULT false,
        did_document JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Nostr challenges table
      CREATE TABLE IF NOT EXISTS nostr_challenges (
        challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        challenge VARCHAR(64) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(user_id),
        relay VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- GDPR data requests table
      CREATE TABLE IF NOT EXISTS gdpr_requests (
        request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        request_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        completed_at TIMESTAMP WITH TIME ZONE,
        data_export_path VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_applications_call ON applications(call_id);
      CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
      CREATE INDEX IF NOT EXISTS idx_assignments_assessor ON assignments(assessor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
  } finally {
    client.release();
  }
}

/**
 * Clean all test data from tables
 * Preserves table structure but removes all rows
 */
export async function cleanTestData(): Promise<void> {
  const pool = getTestPool();
  const client = await pool.connect();

  try {
    // Delete in reverse order of dependencies
    await client.query('TRUNCATE gdpr_requests CASCADE');
    await client.query('TRUNCATE nostr_challenges CASCADE');
    await client.query('TRUNCATE nostr_identities CASCADE');
    await client.query('TRUNCATE audit_logs CASCADE');
    await client.query('TRUNCATE assessments CASCADE');
    await client.query('TRUNCATE assignments CASCADE');
    await client.query('TRUNCATE confirmations CASCADE');
    await client.query('TRUNCATE application_files CASCADE');
    await client.query('TRUNCATE applications CASCADE');
    await client.query('TRUNCATE assessor_pool CASCADE');
    await client.query('TRUNCATE funding_calls CASCADE');
    await client.query('TRUNCATE users CASCADE');
  } finally {
    client.release();
  }
}

/**
 * Drop all test tables
 */
export async function dropTestTables(): Promise<void> {
  const pool = getTestPool();
  const client = await pool.connect();

  try {
    await client.query(`
      DROP TABLE IF EXISTS gdpr_requests CASCADE;
      DROP TABLE IF EXISTS nostr_challenges CASCADE;
      DROP TABLE IF EXISTS nostr_identities CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS assessments CASCADE;
      DROP TABLE IF EXISTS assignments CASCADE;
      DROP TABLE IF EXISTS confirmations CASCADE;
      DROP TABLE IF EXISTS application_files CASCADE;
      DROP TABLE IF EXISTS applications CASCADE;
      DROP TABLE IF EXISTS assessor_pool CASCADE;
      DROP TABLE IF EXISTS funding_calls CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
  } finally {
    client.release();
  }
}

/**
 * Seed test data factories
 */
export const TestDataFactory = {
  /**
   * Create a test user
   */
  async createUser(overrides: Partial<{
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role: string;
    organisation: string;
    expertise_tags: string[];
    is_active: boolean;
    email_verified: boolean;
  }> = {}): Promise<{ user_id: string; email: string; role: string }> {
    const userId = uuidv4();
    const email = overrides.email || `test-${userId.slice(0, 8)}@test.com`;
    const role = overrides.role || 'applicant';

    await testQuery(`
      INSERT INTO users (user_id, email, password_hash, first_name, last_name, role, organisation, expertise_tags, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      userId,
      email,
      overrides.password_hash || '$2a$12$test.hash.for.testing.purposes.only',
      overrides.first_name || 'Test',
      overrides.last_name || 'User',
      role,
      overrides.organisation || null,
      overrides.expertise_tags || null,
      overrides.is_active !== false,
      overrides.email_verified || false,
    ]);

    return { user_id: userId, email, role };
  },

  /**
   * Create a test funding call
   */
  async createFundingCall(createdBy: string, overrides: Partial<{
    name: string;
    description: string;
    open_at: Date;
    close_at: Date;
    status: string;
    submission_requirements: object;
    criteria: object[];
    required_assessors_per_application: number;
  }> = {}): Promise<{ call_id: string; name: string; status: string }> {
    const callId = uuidv4();
    const name = overrides.name || `Test Call ${callId.slice(0, 8)}`;
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await testQuery(`
      INSERT INTO funding_calls (call_id, name, description, open_at, close_at, status,
        submission_requirements, criteria, required_assessors_per_application, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      callId,
      name,
      overrides.description || 'Test funding call description',
      overrides.open_at || now,
      overrides.close_at || futureDate,
      overrides.status || 'draft',
      JSON.stringify(overrides.submission_requirements || {
        allowed_file_types: ['application/pdf'],
        max_file_size: 10485760,
        required_confirmations: ['guidance_read'],
      }),
      JSON.stringify(overrides.criteria || [
        { criterion_id: uuidv4(), name: 'Quality', max_points: 10, weight: 1, comments_required: true, order: 0 },
        { criterion_id: uuidv4(), name: 'Impact', max_points: 10, weight: 1, comments_required: true, order: 1 },
      ]),
      overrides.required_assessors_per_application || 2,
      createdBy,
    ]);

    return { call_id: callId, name, status: overrides.status || 'draft' };
  },

  /**
   * Create a test application
   */
  async createApplication(callId: string, applicantId: string, overrides: Partial<{
    reference_number: string;
    applicant_name: string;
    applicant_email: string;
    applicant_organisation: string;
    status: string;
  }> = {}): Promise<{ application_id: string; reference_number: string; status: string }> {
    const applicationId = uuidv4();
    const refNumber = overrides.reference_number || `APP-${Date.now()}-${applicationId.slice(0, 4).toUpperCase()}`;

    await testQuery(`
      INSERT INTO applications (application_id, call_id, applicant_id, reference_number,
        applicant_name, applicant_email, applicant_organisation, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      applicationId,
      callId,
      applicantId,
      refNumber,
      overrides.applicant_name || 'Test Applicant',
      overrides.applicant_email || 'applicant@test.com',
      overrides.applicant_organisation || 'Test Organisation',
      overrides.status || 'draft',
    ]);

    return { application_id: applicationId, reference_number: refNumber, status: overrides.status || 'draft' };
  },

  /**
   * Create a test assignment
   */
  async createAssignment(applicationId: string, assessorId: string, assignedBy: string, overrides: Partial<{
    due_at: Date;
    status: string;
  }> = {}): Promise<{ assignment_id: string; status: string }> {
    const assignmentId = uuidv4();

    await testQuery(`
      INSERT INTO assignments (assignment_id, application_id, assessor_id, assigned_by, due_at, status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      assignmentId,
      applicationId,
      assessorId,
      assignedBy,
      overrides.due_at || null,
      overrides.status || 'pending',
    ]);

    return { assignment_id: assignmentId, status: overrides.status || 'pending' };
  },

  /**
   * Create a test assessment
   */
  async createAssessment(assignmentId: string, overrides: Partial<{
    scores: object[];
    overall_score: number;
    overall_comment: string;
    coi_confirmed: boolean;
    status: string;
  }> = {}): Promise<{ assessment_id: string; status: string }> {
    const assessmentId = uuidv4();

    await testQuery(`
      INSERT INTO assessments (assessment_id, assignment_id, scores, overall_score, overall_comment, coi_confirmed, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      assessmentId,
      assignmentId,
      JSON.stringify(overrides.scores || []),
      overrides.overall_score || 0,
      overrides.overall_comment || null,
      overrides.coi_confirmed || false,
      overrides.status || 'draft',
    ]);

    return { assessment_id: assessmentId, status: overrides.status || 'draft' };
  },
};

export default {
  getTestPool,
  closeTestPool,
  testQuery,
  initTestDatabase,
  cleanTestData,
  dropTestTables,
  TestDataFactory,
};
