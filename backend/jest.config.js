/** @type {import('jest').Config} */

// Base configuration shared across all projects
const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }],
    // Transform ESM modules in node_modules
    '^.+\\.jsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Handle ESM modules like @noble/secp256k1, @noble/hashes
  transformIgnorePatterns: [
    '/node_modules/(?!(@noble)/)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};

module.exports = {
  // Root configuration
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**/*',
    '!src/server.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',

  // Global settings
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  errorOnDeprecated: true,
  maxWorkers: '50%',

  // Project configurations for different test types
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      // Note: testTimeout in projects is not supported in Jest 29
      // Use jest.setTimeout() in test files for longer timeouts
    },
    {
      ...baseConfig,
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.ts'],
    },
    {
      ...baseConfig,
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      // Note: testTimeout in projects is not supported in Jest 29
      // Use jest.setTimeout() in test files for longer timeouts
    }
  ],

  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],

  // Snapshot configuration
  snapshotSerializers: [],
};
