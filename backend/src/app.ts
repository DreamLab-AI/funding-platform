import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { auditMiddleware } from './middleware/audit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import callsRoutes from './routes/calls.routes';
import applicationsRoutes from './routes/applications.routes';
import assessmentsRoutes from './routes/assessments.routes';
import assignmentsRoutes from './routes/assignments.routes';
import resultsRoutes from './routes/results.routes';
import { aiRouter } from './routes/ai.routes';
import { nostrRouter } from './routes/nostr.routes';

const app: Application = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined'));
}

// Audit logging for all API requests
app.use('/api/', auditMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/nostr', nostrRouter);
app.use('/api/v1/calls', callsRoutes);
app.use('/api/v1/applications', applicationsRoutes);
app.use('/api/v1/assessments', assessmentsRoutes);
app.use('/api/v1/assignments', assignmentsRoutes);
app.use('/api/v1/results', resultsRoutes);
app.use('/api/v1/ai', aiRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
