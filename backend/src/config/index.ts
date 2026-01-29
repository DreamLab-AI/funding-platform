import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  env: string;
  port: number;
  apiVersion: string;
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3BucketName: string;
    s3BucketUrl: string;
  };
  email: {
    sendgridApiKey: string;
    from: string;
    fromName: string;
    smtp: {
      host: string;
      port: number;
      user: string;
      password: string;
      secure: boolean;
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  upload: {
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  timezone: string;
  cors: {
    origin: string | string[];
  };
  session: {
    secret: string;
  };
  logging: {
    level: string;
    format: string;
  };
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
};

const getEnvVarAsInt = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
};

const getEnvVarAsBool = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value.toLowerCase() === 'true';
};

export const config: Config = {
  env: getEnvVar('NODE_ENV', 'development'),
  port: getEnvVarAsInt('PORT', 3000),
  apiVersion: getEnvVar('API_VERSION', 'v1'),

  database: {
    url: getEnvVar('DATABASE_URL', ''),
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvVarAsInt('DB_PORT', 5432),
    name: getEnvVar('DB_NAME', 'funding_platform'),
    user: getEnvVar('DB_USER', 'postgres'),
    password: getEnvVar('DB_PASSWORD', 'password'),
    ssl: getEnvVarAsBool('DB_SSL', false),
  },

  jwt: {
    secret: getEnvVar('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '30m'),
    refreshExpiresIn: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  aws: {
    accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', ''),
    region: getEnvVar('AWS_REGION', 'eu-west-2'),
    s3BucketName: getEnvVar('S3_BUCKET_NAME', 'funding-platform-files'),
    s3BucketUrl: getEnvVar('S3_BUCKET_URL', ''),
  },

  email: {
    sendgridApiKey: getEnvVar('SENDGRID_API_KEY', ''),
    from: getEnvVar('EMAIL_FROM', 'noreply@fundingplatform.gov.uk'),
    fromName: getEnvVar('EMAIL_FROM_NAME', 'Funding Platform'),
    smtp: {
      host: getEnvVar('SMTP_HOST', ''),
      port: getEnvVarAsInt('SMTP_PORT', 587),
      user: getEnvVar('SMTP_USER', ''),
      password: getEnvVar('SMTP_PASSWORD', ''),
      secure: getEnvVarAsBool('SMTP_SECURE', false),
    },
  },

  rateLimit: {
    windowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: getEnvVarAsInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  upload: {
    maxFileSize: getEnvVarAsInt('MAX_FILE_SIZE', 52428800), // 50MB
    allowedFileTypes: getEnvVar(
      'ALLOWED_FILE_TYPES',
      'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,video/mp4'
    ).split(','),
  },

  timezone: getEnvVar('TIMEZONE', 'Europe/London'),

  cors: {
    origin: getEnvVar('CORS_ORIGIN', 'http://localhost:3001'),
  },

  session: {
    secret: getEnvVar('SESSION_SECRET', 'dev-session-secret'),
  },

  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    format: getEnvVar('LOG_FORMAT', 'combined'),
  },
};

export default config;
