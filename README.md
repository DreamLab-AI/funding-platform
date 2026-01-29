# Funding Application Submission & Assessment Platform

A comprehensive, enterprise-grade platform for managing funding calls, applications, assessments, and results. Built with modern architecture, decentralized identity, AI-powered features, and high-performance WASM visualizations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)

## Overview

This platform provides a complete solution for organizations managing competitive funding programs, research grants, or any application-based selection process. It supports the entire lifecycle from call creation through application submission, expert assessment, and final results aggregation.

### Key Features

- **Multi-Call Management** - Create and manage multiple funding calls with customizable criteria
- **Applicant Portal** - Intuitive interface for application submission with file uploads
- **Assessor Interface** - Streamlined assessment workflow with CoI declarations
- **Coordinator Dashboard** - Full oversight with assignment management and progress tracking
- **Master Results** - Aggregated scoring with variance detection and analytics
- **Decentralized Identity** - Nostr-based DID authentication (NIP-05, NIP-07, NIP-98)
- **Model-Agnostic AI** - Configurable AI assistance (OpenAI, Anthropic, Ollama, LM Studio)
- **WASM Visualizations** - High-performance Rust/WebAssembly charts and graphs
- **GDPR Compliant** - Full audit logging, data export, and privacy controls
- **WCAG 2.1 AA** - Accessibility-first design system

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Nostr     │  │   Design    │  │   WASM Visualizations   │  │
│  │  DID Auth   │  │   System    │  │    (Rust + plotters)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js + Express)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │   REST   │  │   RBAC   │  │  Audit   │  │  Model-Agnostic │  │
│  │   API    │  │ Middleware│  │  Logger  │  │      AI        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │PostgreSQL│   │  Redis   │   │  AWS S3  │
        │   15+    │   │  Cache   │   │  Storage │
        └──────────┘   └──────────┘   └──────────┘
```

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and builds
- **React Query** for data fetching and caching
- **React Router** for navigation
- **React Hook Form** + **Zod** for form validation
- **Custom Design System** with CSS custom properties
- **WASM/Rust** visualizations using `plotters-canvas`

### Backend
- **Node.js 20+** with Express
- **TypeScript** with strict mode
- **PostgreSQL 15** with UUID primary keys
- **Redis** for session management and caching
- **JWT** + **Nostr DID** authentication
- **Zod** for API validation
- **Winston** for structured logging

### AI Integration
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude)
- **Ollama** (local models)
- **LM Studio** (local inference)
- **Custom endpoints** (configurable)

### Infrastructure
- **Docker** + **Docker Compose**
- **Kubernetes** manifests
- **GitHub Actions** CI/CD
- **Terraform** infrastructure as code
- **Prometheus** + **Grafana** monitoring

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dreamlab-ai/funding-platform.git
cd funding-platform

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run database migrations
cd ../database
psql -U postgres -d funding_platform -f migrations/001_initial_schema.sql
psql -U postgres -d funding_platform -f migrations/002_indexes.sql
psql -U postgres -d funding_platform -f migrations/003_user_identities.sql

# Start development servers
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Project Structure

```
funding-platform/
├── backend/                    # Node.js Express API
│   └── src/
│       ├── ai/                # Model-agnostic AI integration
│       │   ├── providers/     # OpenAI, Anthropic, Ollama, LM Studio
│       │   └── features/      # Summarize, scoring-assist, anomaly, similarity
│       ├── auth/              # Nostr DID authentication
│       ├── config/            # Configuration management
│       ├── controllers/       # Route handlers
│       ├── middleware/        # Auth, RBAC, validation, rate limiting
│       ├── models/            # Data models
│       ├── routes/            # API routes
│       ├── security/          # JWT, RBAC, audit, CSRF
│       ├── services/          # Business logic
│       ├── types/             # TypeScript definitions
│       └── utils/             # Helpers and utilities
├── frontend/                  # React TypeScript application
│   └── src/
│       ├── components/        # Reusable UI components
│       │   ├── ui/           # Design system components
│       │   └── Visualizations/ # WASM chart wrappers
│       ├── hooks/             # Custom React hooks
│       ├── lib/               # Utilities and services
│       │   └── nostr/        # Nostr DID client library
│       ├── pages/             # Page components
│       ├── services/          # API client services
│       ├── stores/            # State management
│       ├── styles/            # CSS and design tokens
│       └── wasm/              # WASM loader and bindings
├── wasm-viz/                  # Rust WASM visualization library
│   └── src/
│       ├── charts/           # Chart implementations
│       │   ├── score_distribution.rs
│       │   ├── progress_tracker.rs
│       │   ├── variance_heatmap.rs
│       │   ├── timeline.rs
│       │   └── network_graph.rs
│       └── lib.rs            # WASM entry point
├── database/                  # PostgreSQL schemas
│   ├── migrations/           # SQL migrations
│   └── seeds/                # Development data
├── infrastructure/           # Infrastructure as code
│   └── terraform/           # AWS/GCP/Azure configs
├── k8s/                      # Kubernetes manifests
├── docs/                     # Documentation
│   ├── api/                 # OpenAPI specifications
│   └── architecture/        # Architecture decision records
├── scripts/                  # Utility scripts
├── .github/                  # GitHub Actions workflows
└── docker-compose.yml        # Docker development setup
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Applicant** | Submit applications, upload files, track status |
| **Assessor** | View assigned applications, submit assessments, declare CoI |
| **Coordinator** | Manage calls, assign assessors, view all applications, export results |
| **Scheme Owner** | View results, approve funding decisions |
| **Admin** | Full system access, user management, audit logs |

## API Overview

### Authentication
```
POST /api/v1/auth/register          # Register new user
POST /api/v1/auth/login             # Login with email/password
POST /api/v1/auth/nostr/challenge   # Get Nostr challenge
POST /api/v1/auth/nostr/verify      # Verify Nostr signature
POST /api/v1/auth/refresh           # Refresh JWT token
```

### Funding Calls
```
GET  /api/v1/calls/open             # List open calls (public)
POST /api/v1/calls                  # Create new call
GET  /api/v1/calls/:id              # Get call details
PUT  /api/v1/calls/:id              # Update call
POST /api/v1/calls/:id/close        # Close call
```

### Applications
```
POST /api/v1/applications           # Create application
GET  /api/v1/applications/my        # My applications
PUT  /api/v1/applications/:id       # Update draft
POST /api/v1/applications/:id/submit # Submit application
POST /api/v1/applications/:id/files # Upload files
```

### Assessments
```
GET  /api/v1/assessments/my         # My assignments
POST /api/v1/assessments/assignment/:id    # Submit assessment
POST /api/v1/assessments/assignment/:id/submit  # Final submit
```

### Assignments
```
POST /api/v1/assignments            # Assign assessor
POST /api/v1/assignments/bulk       # Bulk assign
GET  /api/v1/assignments/progress/:callId  # Progress overview
```

### Results
```
GET  /api/v1/results/call/:id       # Master results
GET  /api/v1/results/call/:id/ranking    # Ranking
GET  /api/v1/results/call/:id/export     # Export CSV
GET  /api/v1/results/call/:id/analytics  # Analytics
```

### AI Features
```
POST /api/v1/ai/summarize           # Summarize application
POST /api/v1/ai/scoring-assist      # AI scoring suggestions
POST /api/v1/ai/anomaly             # Detect scoring anomalies
POST /api/v1/ai/similarity          # Find similar applications
```

## Nostr DID Authentication

The platform supports decentralized identity through the Nostr protocol:

```typescript
// Generate or import Nostr keys
import { generateKeyPair, getPublicKey } from '@/lib/nostr';

// Create DID from public key
const did = `did:nostr:${publicKeyHex}`;

// Sign authentication challenge
const event = await signEvent({
  kind: 22242,
  content: challenge,
  tags: [['challenge', challengeId]]
});

// Verify with backend
await api.post('/auth/nostr/verify', { event });
```

Supported NIPs:
- **NIP-01**: Basic protocol flow
- **NIP-05**: DNS-based verification
- **NIP-07**: Browser extension signing
- **NIP-98**: HTTP Auth events

## WASM Visualizations

High-performance charts rendered with Rust and WebAssembly:

```rust
// Rust implementation (wasm-viz/src/charts/score_distribution.rs)
#[wasm_bindgen]
pub fn render_score_distribution(
    canvas_id: &str,
    scores: &[f64],
    options: JsValue
) -> Result<(), JsValue> {
    let backend = CanvasBackend::new(canvas_id)?;
    let root = backend.into_drawing_area();

    // Histogram with customizable bins
    let mut chart = ChartBuilder::on(&root)
        .caption("Score Distribution", ("sans-serif", 20))
        .build_cartesian_2d(range.clone(), 0u32..max_count)?;

    chart.draw_series(Histogram::vertical(&chart)
        .style(BLUE.filled())
        .data(scores.iter().map(|x| (*x, 1))))?;

    Ok(())
}
```

```tsx
// React wrapper
import { useWasmViz } from '@/wasm/hooks/useWasmViz';

function ScoreDistribution({ scores }) {
  const { ready, renderChart } = useWasmViz();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ready && canvasRef.current) {
      renderChart('score_distribution', canvasRef.current.id, scores);
    }
  }, [ready, scores]);

  return <canvas ref={canvasRef} id="score-dist" />;
}
```

Available visualizations:
- **Score Distribution** - Histogram with configurable bins
- **Progress Radial** - Circular progress indicators
- **Variance Heatmap** - Score variance visualization
- **Submission Timeline** - Time-series chart
- **Assignment Network** - Force-directed graph

## AI Provider Configuration

Configure AI providers in `.env`:

```bash
# OpenAI
AI_OPENAI_API_KEY=sk-...
AI_OPENAI_MODEL=gpt-4

# Anthropic
AI_ANTHROPIC_API_KEY=sk-ant-...
AI_ANTHROPIC_MODEL=claude-3-sonnet

# Ollama (local)
AI_OLLAMA_BASE_URL=http://localhost:11434
AI_OLLAMA_MODEL=llama2

# LM Studio (local)
AI_LMSTUDIO_BASE_URL=http://localhost:1234
AI_LMSTUDIO_MODEL=local-model

# Custom endpoint
AI_CUSTOM_BASE_URL=http://your-endpoint
AI_CUSTOM_MODEL=your-model
AI_CUSTOM_API_KEY=your-key

# Default provider
AI_DEFAULT_PROVIDER=openai
```

## Security Features

- **RBAC** - Role-based access control with fine-grained permissions
- **JWT** - Secure token-based authentication with refresh rotation
- **Nostr DID** - Decentralized identity verification
- **CSRF Protection** - Double-submit cookie pattern
- **Rate Limiting** - Request throttling per user/endpoint
- **Input Sanitization** - XSS prevention
- **Audit Logging** - Complete action trail
- **File Validation** - Type and size restrictions
- **Encrypted Storage** - Sensitive data encryption at rest

## GDPR Compliance

- **Consent Management** - Explicit consent tracking
- **Data Export** - User data export in machine-readable format
- **Right to Erasure** - Automated data deletion workflows
- **Audit Trail** - Complete history of data access and modifications
- **Data Minimization** - Collect only necessary information
- **Anonymization** - Support for anonymizing exported results

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:e2e

# WASM tests
cd wasm-viz
cargo test
wasm-pack test --headless --chrome
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Format
npm run format
```

### Building for Production

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build

# WASM
cd wasm-viz && wasm-pack build --target web
```

## Deployment

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRY` | Token expiration | `15m` |
| `AWS_S3_BUCKET` | S3 bucket for files | - |
| `AI_DEFAULT_PROVIDER` | Default AI provider | `openai` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

See `.env.example` for complete configuration.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with [Claude Flow V3](https://github.com/ruvnet/claude-flow) multi-agent orchestration and the [Agentic QE Fleet](https://github.com/ruvnet/agentic-qe) quality engineering system.

---

**Made with by DreamLab AI**
