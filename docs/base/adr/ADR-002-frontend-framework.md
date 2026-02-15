# ADR-002: Frontend Framework Selection

## Status
Accepted

## Context
The platform requires a responsive, accessible web interface supporting three distinct user journeys (Applicant, Assessor, Coordinator) with complex interactive elements: drag-and-drop file upload, spreadsheet-style data tables, multi-step wizards, progress indicators, and score input forms. WCAG 2.1 AA compliance is mandated for public-facing applicant pages (NFR-021).

## Decision
We use **React 18** with **TypeScript**, built with **Vite**, and styled using a GOV.UK-inspired design token system with custom CSS.

Key technology choices:
- **React 18**: Component-based architecture with hooks, concurrent features, and a mature ecosystem.
- **TypeScript**: Static typing for all components, hooks, and service interfaces.
- **Vite**: Fast HMR in development, optimized production builds with tree-shaking.
- **React Router v6**: Declarative routing with nested layouts (PublicLayout, AuthLayout, DashboardLayout).
- **TanStack Query (React Query)**: Server state management with configurable stale time (5 minutes, per `frontend/src/App.tsx`).
- **react-hot-toast**: Non-intrusive toast notifications.

Implementation evidence:
- Application entry: `frontend/src/App.tsx` defines three layout wrappers (PublicLayoutWrapper, AuthLayoutWrapper, DashboardLayoutWrapper) with nested routes.
- Design tokens: `frontend/src/styles/design-tokens.css` provides a complete GOV.UK-inspired token system with WCAG AA compliant color values.
- Component library: `frontend/src/components/ui/` contains reusable primitives (Button, Card, Dialog, DataTable, FileUpload, Stepper, Badge, ScoreInput, Progress, Toast, Tooltip, Avatar).
- Domain components: Separate directories for Auth, Forms, Tables, Visualizations, AI, and Layout components.
- WASM integration: `frontend/src/wasm/` includes a WebAssembly module for performance-sensitive visualizations.
- Nostr DID: `frontend/src/lib/nostr/` provides client-side cryptographic key management and authentication.

Route structure:
- Public: `/calls` (open funding calls listing)
- Auth: `/auth/login`, `/auth/register`
- Dashboard/Applicant: `/dashboard/applications`, `/dashboard/confirmation/:id`
- Dashboard/Coordinator: `/dashboard/coordinator`, `/dashboard/coordinator/calls/new`, `/dashboard/coordinator/applications`, `/dashboard/coordinator/assignments`, `/dashboard/coordinator/results`
- Admin: `/dashboard/admin/ai-settings`

## Consequences

### Positive
- TypeScript catches type errors at compile time, reducing runtime bugs in form validation and API contract mismatches.
- Component architecture enables reuse across all three user journeys.
- Vite provides sub-second HMR, improving developer productivity.
- React Query reduces boilerplate for data fetching, caching, and optimistic updates.
- Design token system ensures consistent styling and makes theme changes (including dark mode) straightforward.

### Negative
- React's virtual DOM overhead may be noticeable on very large data tables (1000+ rows). Mitigation: virtualized rendering for the coordinator applications table.
- The SPA approach requires careful handling of SEO (not critical for this authenticated platform) and initial load performance.
- Custom CSS (not Tailwind or a full component library like MUI) means more manual work for complex layout patterns, but gives full control over GOV.UK alignment.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Next.js** | Server-side rendering is unnecessary for an authenticated platform where SEO is not a priority. Adds framework complexity and deployment constraints (Node.js server required for SSR). |
| **Vue 3** | Smaller ecosystem for accessibility tooling and government design system integration compared to React. Team has stronger React experience. |
| **Angular** | Heavier framework with more boilerplate. Slower iteration speed for a small team. |
| **GOV.UK Frontend (Nunjucks)** | Server-rendered template approach would limit interactivity for the coordinator dashboard, file upload UX, and real-time progress tracking. |
