# Browser Audit Report - Funding Application Platform

**Date**: 2026-02-15
**Auditor**: Automated Browser Exploration (agent-browser)
**Frontend URL**: http://localhost:3000
**Backend API**: http://localhost:4000 (proxied via Vite at /api)

---

## Executive Summary

The Funding Application Platform is a React SPA (Vite + React Router v6) with a Node.js/Express backend. The application has a GOV.UK-styled public frontend and a dashboard for coordinators. Of the 12 routes tested, **only 4 render functional content**. The remaining routes either show empty pages (no matched React Router child), display placeholder text, or fail due to API rate limiting. There are critical routing mismatches between the sidebar navigation links and the actual router configuration.

### Status At a Glance

| Status | Count | Details |
|--------|-------|---------|
| Fully functional | 3 | Coordinator Dashboard, AI Settings, Login layout |
| Partially functional | 1 | Homepage/Calls list (API 429 error) |
| Placeholder only | 2 | Login page, Register page |
| Empty page (no content) | 6+ | Most dashboard sub-routes |

---

## Route-by-Route Findings

### 1. Homepage - `/` (redirects to `/calls`)

**Status**: PARTIALLY FUNCTIONAL - API Error

- **Loads**: Yes - PublicLayout renders with full header, navigation, breadcrumbs, and footer
- **Error**: Main content area shows `"Error loading calls"` with message `"Request failed with status code 429"`
- **Root Cause**: The backend API at `/api/v1/calls/open` returns HTTP 429 (Too Many Requests) when accessed through the Vite proxy. Direct backend access on port 4000 returns valid demo data.
- **UI Elements Present**:
  - GOV.UK-styled header with "UK Funding Platform" branding
  - Main navigation: Home, Funding Opportunities, My Applications, Help & Support
  - Sign in / Register links
  - Breadcrumb navigation (Home > Calls)
  - Footer with Funding, Support, and Legal sections
  - Social links (Twitter, LinkedIn - both point to "#")
  - WCAG 2.1 AA compliance statement
- **Data Source**: Should display 3 open funding calls from backend demo data
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-01-homepage.png`

### 2. Calls List - `/calls`

**Status**: PARTIALLY FUNCTIONAL - Same as Homepage

- Identical content to `/` since the homepage redirects here
- Same API 429 error prevents call data from loading
- The `useOpenCalls` hook in `useCalls.ts` has fallback demo data (`DEMO_CALLS` array) but the error handling path displays the error message rather than falling back to demo data
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-02-calls.png`

### 3. Application Form - `/apply`

**Status**: EMPTY PAGE - Route Not Defined

- Renders a completely blank page (empty `<div id="root">`)
- **Root Cause**: The route `/apply` does not exist in the React Router configuration in `App.tsx`. The actual application form route is `/dashboard/applications` (or `/dashboard/applications/:id`)
- The React app fails to mount because this path matches the `*` catch-all route but the `Page Not Found` text also does not render (indicating a possible React mount failure on certain routes)
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-03-apply.png`

### 4. Login Page - `/login` (redirects to `/auth/login`)

**Status**: PARTIALLY FUNCTIONAL - Placeholder Content

- **Loads**: Yes - AuthLayout renders with split-screen design
- `/login` is a legacy redirect to `/auth/login`
- **Left panel**: Marketing content with "Welcome to UK Funding Platform" heading, feature highlights (Secure & Compliant, Fast Processing, Expert Review), and a testimonial quote from "Dr. Jane Doe, Research Council"
- **Right panel**: Shows only `"Login Page"` text - **no actual login form fields** (email, password, submit button)
- The login route is defined as: `<Route path="login" element={<div className="p-8 text-center">Login Page</div>} />`
- This is a hardcoded placeholder `<div>`, not a real login component
- **UI Elements Present**:
  - Skip to form link
  - Banner with "Funding Platform UK Research & Innovation" and "Back to home"
  - Footer with Privacy Policy, Terms of Service, Accessibility links
- **Missing**: Email field, password field, "Remember me" checkbox, submit button, "Forgot password" link, link to registration
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-04-login.png`

### 5. Registration - `/register`

**Status**: EMPTY PAGE - Route Not Defined at Top Level

- Renders blank page
- **Root Cause**: `/register` is not a defined route. The actual registration route is `/auth/register`
- Testing `/auth/register` shows the AuthLayout with placeholder text `"Register Page"` - same situation as login (no actual form fields)
- The register route is defined as: `<Route path="register" element={<div className="p-8 text-center">Register Page</div>} />`
- **Missing**: Name fields, email field, password field, role selection, organization field, terms acceptance, submit button
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-05-register.png`

### 6. Main Dashboard - `/dashboard` (redirects to `/dashboard/coordinator`)

**Status**: FULLY FUNCTIONAL - Demo Data

- **Loads**: Yes - DashboardLayout renders with sidebar, header, and main content
- `/dashboard` automatically redirects to `/dashboard/coordinator` via React Router `Navigate`
- **Sidebar Navigation** (coordinator role):
  - Dashboard (`/dashboard`)
  - Funding Calls with badge "3" (`/dashboard/calls`)
  - Applications with badge "12" (`/dashboard/applications`)
  - Assessments (`/dashboard/assessments`)
  - Assessors (`/dashboard/assessors`)
  - Reports (`/dashboard/reports`)
  - Settings (`/dashboard/settings`)
- **Header**: Collapse sidebar button, notifications bell (with red dot), user avatar "U"
- **Main Content**:
  - H1: "Dashboard" with subtitle "Overview of funding calls and assessments"
  - "Create New Call" button (links to `/coordinator/calls/new` -- BROKEN link, see issues)
  - **Stats Cards**: Total Calls: 4, Open Calls: 2, In Assessment: 0, Completed: 0, Total Applications: 84
  - **Active Calls Section**: Cards for "Innovation Research Fund 2026" (24 apps, deadline 17/03/2026) and "Climate Action Research Programme" (18 apps, deadline 01/04/2026)
  - **All Calls Table**: 4 rows with columns: Call Name, Status, Deadline, Applications, Progress, Actions
    - Innovation Research Fund 2026 | open | 17/03/2026 | 24
    - Climate Action Research Programme | open | 01/04/2026 | 18
    - Digital Health Innovation Grant | closed | 16/01/2026 | 42
    - Future Transport Research | draft | 16/04/2026 | 0
- **Data Source**: Demo data from `DEMO_CALLS` in `useCalls.ts` hook (hardcoded fallback)
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-06-dashboard.png`

### 7. Call Management - `/dashboard/calls`

**Status**: EMPTY PAGE - Route Mismatch

- Renders completely blank (empty root div, React app does not mount)
- **Root Cause**: `/dashboard/calls` is NOT a defined child route under the `/dashboard` route group. The router defines routes under `/dashboard/coordinator/*` instead. When React Router matches `/dashboard` as parent but finds no child matching `calls`, the Outlet renders nothing. The DashboardLayout wrapper should still render, but the page appears blank.
- The sidebar link "Funding Calls" points to `/dashboard/calls` which has no corresponding route definition
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-07-dashboard-calls.png`

### 8. Applications View - `/dashboard/applications`

**Status**: EMPTY PAGE - Renders But No Visible Content

- The route IS defined in the router: `<Route path="applications" element={<ApplicationForm />} />`
- However, the `ApplicationForm` component expects a `callId` parameter from `useParams()` which is not provided at this route path (it's a standalone route, not nested under a call)
- Without `callId`, the component likely renders a loading state or fails silently
- The browser shows a completely empty page (body innerHTML = 87 chars, just the root div and script tag)
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-08-dashboard-applications.png`

### 9. Assignments View - `/dashboard/assignments`

**Status**: EMPTY PAGE - Route Not Defined

- No route definition matches `/dashboard/assignments`
- The actual assignment tool route is `/dashboard/coordinator/assignments`
- The sidebar for the assessor role links to `/dashboard/assignments` but this route does not exist in the coordinator navigation context
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-09-dashboard-assignments.png`

### 10. Results View - `/dashboard/results`

**Status**: EMPTY PAGE - Route Not Defined

- No route definition matches `/dashboard/results`
- The actual results route is `/dashboard/coordinator/results`
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-10-dashboard-results.png`

### 11. AI Settings - `/dashboard/admin/ai-settings`

**Status**: FULLY FUNCTIONAL - Demo Data

- **Loads**: Yes - DashboardLayout with full AI settings interface
- Also accessible via `/dashboard/settings` (redirect)
- **Content**:
  - H1: "AI Settings" with subtitle "Configure AI provider and features (Demo Mode)"
  - "Refresh Status" button
  - **Service Status**: AI Service Enabled, 1,247 Requests, 892,340 Tokens, 51.3% Cache Hit Rate, 423 Cached Responses
  - **AI Provider Section**:
    - OpenAI - "Configured" (Active)
    - Anthropic Claude - "Configured"
    - Ollama (Local) - "Not configured"
    - LM Studio - "Not configured"
    - Custom Endpoint - "Not configured"
  - **Features Section**:
    - Summarization - "Generate summaries of applications"
    - Scoring Assistance - "AI-suggested scores for assessors"
    - Anomaly Detection - "Detect scoring anomalies and outliers"
    - Similarity Search - "Find similar applications"
- **Data Source**: Demo data from `DEMO_STATUS` and `DEMO_PROVIDERS` in `useAI.ts` hook
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-11-ai-settings.png`

### 12. Call Setup Wizard - `/dashboard/admin/call-setup`

**Status**: EMPTY PAGE - Route Not Defined

- No route definition matches `/dashboard/admin/call-setup`
- The actual call setup route is `/dashboard/coordinator/calls/new` (or `/dashboard/coordinator/calls/:id` for editing)
- **Screenshot**: `/home/devuser/workspace/funding_platform/docs/screenshots/audit-12-call-setup.png`

---

## Additional Routes Tested

### `/dashboard/coordinator` (actual coordinator dashboard)

**Status**: FULLY FUNCTIONAL - Same as `/dashboard` (which redirects here)

### `/dashboard/coordinator/calls/new` (call setup)

**Status**: EMPTY PAGE - React fails to mount on direct URL load. The component file `CallSetup.tsx` exists and imports correctly, but the page renders blank. The route IS defined in the router. This may be a Vite HMR or module loading issue with deep nested routes.

### `/dashboard/coordinator/applications` (applications view)

**Status**: EMPTY PAGE - Same rendering failure as above.

### `/coordinator/calls/demo-001` (linked from dashboard)

**Status**: EMPTY PAGE - This is a TOP-LEVEL route (`/coordinator/*`) that is NOT defined in the router. Dashboard links generate these URLs but they don't match any route.

### `/coordinator/calls/demo-001/applications` (linked from active calls cards)

**Status**: EMPTY PAGE - Same issue. These are broken links from the coordinator dashboard.

### `/dashboard/assessments`, `/dashboard/assessors`, `/dashboard/reports`

**Status**: EMPTY PAGE - These sidebar navigation links have no corresponding route definitions.

### `/dashboard/settings`

**Status**: FUNCTIONAL - Redirects to `/dashboard/admin/ai-settings` (works correctly)

---

## Critical Issues

### Issue 1: Broken Link Paths in Coordinator Dashboard (HIGH)

The `CoordinatorDashboard` component (`/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/Dashboard.tsx`) generates links with incorrect base paths:

| Link Location | Generated URL | Expected URL |
|---------------|---------------|--------------|
| "Create New Call" button (line 61) | `/coordinator/calls/new` | `/dashboard/coordinator/calls/new` |
| Call name links in table (line 134) | `/coordinator/calls/${call.id}` | `/dashboard/coordinator/calls/${call.id}` |
| "View" action links (line 174) | `/coordinator/calls/${call.id}` | `/dashboard/coordinator/calls/${call.id}` |
| "Applications" card link (line 304) | `/coordinator/calls/${call.id}/applications` | `/dashboard/coordinator/applications` |
| "Results" card link (line 310) | `/coordinator/calls/${call.id}/results` | `/dashboard/coordinator/results` |

All links from the coordinator dashboard lead to non-existent routes, making the dashboard essentially a dead end.

### Issue 2: Sidebar Navigation Mismatch (HIGH)

The sidebar navigation in `DashboardLayout.tsx` (`/home/devuser/workspace/funding_platform/frontend/src/layouts/DashboardLayout.tsx`) defines links that do not match the router:

| Sidebar Link | Sidebar URL | Actual Router Path |
|--------------|-------------|-------------------|
| Dashboard | `/dashboard` | `/dashboard/coordinator` (via redirect) |
| Funding Calls | `/dashboard/calls` | No direct equivalent (only `/dashboard/coordinator/calls/:id`) |
| Applications | `/dashboard/applications` | `/dashboard/coordinator/applications` |
| Assessments | `/dashboard/assessments` | No route defined |
| Assessors | `/dashboard/assessors` | No route defined |
| Reports | `/dashboard/reports` | No route defined |
| Settings | `/dashboard/settings` | Redirects to `/dashboard/admin/ai-settings` (works) |

### Issue 3: Login/Register Are Placeholder Divs (MEDIUM)

Both authentication routes render inline `<div>` elements with text-only placeholders instead of actual form components. No authentication functionality exists in the frontend.

### Issue 4: API Rate Limiting on Public Pages (MEDIUM)

The `/calls` page (homepage) fails with HTTP 429 from the backend API proxy. The hook (`useOpenCalls`) catches the error but displays it rather than falling back to demo data. The `useAllCalls` hook used by the coordinator dashboard successfully falls back to demo data, creating an inconsistent user experience.

### Issue 5: Empty Page Rendering on Deep Routes (MEDIUM)

Multiple routes that ARE defined in the router (`/dashboard/coordinator/calls/new`, `/dashboard/coordinator/applications`) render completely blank when loaded directly via URL. This may indicate:
- A module import error in child components that silently crashes React
- A Vite dev server issue with serving the SPA HTML for deep nested paths
- A missing Error Boundary that swallows component-level errors

### Issue 6: useParams Mismatch (LOW)

Several components use different parameter names than what the router provides:
- `CallSetup.tsx` uses `useParams<{ callId?: string }>()` but the route defines `:id`
- `ApplicationsView.tsx` uses `useParams<{ callId: string }>()` but its route `/dashboard/coordinator/applications` has no params
- `SubmissionConfirmation.tsx` expects `callId` and `applicationId` but the route `/dashboard/confirmation/:id` only provides `:id`

---

## PRD Coverage Analysis

### Required Screens vs Implementation Status

#### Applicant Screens

| PRD Requirement | Route | Status |
|----------------|-------|--------|
| Call Landing Page | `/calls` | EXISTS but API error prevents data loading |
| Application Submission Form | `/dashboard/applications` | EXISTS but renders blank (missing callId param) |
| Submission Confirmation | `/dashboard/confirmation/:id` | EXISTS in router, not directly testable without valid ID |

#### Assessor Screens

| PRD Requirement | Route | Status |
|----------------|-------|--------|
| Assigned Applications List | `/dashboard/assignments` | NO ROUTE (sidebar links to non-existent path) |
| Assessment Form | None | NOT IMPLEMENTED - No assessment form component or route exists |

#### Coordinator Screens

| PRD Requirement | Route | Status |
|----------------|-------|--------|
| Call Setup Wizard | `/dashboard/coordinator/calls/new` | EXISTS in router, component file exists (`CallSetup.tsx` with 4-step wizard), renders BLANK |
| Applications Table | `/dashboard/coordinator/applications` | EXISTS in router, component file exists (`ApplicationsView.tsx`), renders BLANK |
| Assignment Tool | `/dashboard/coordinator/assignments` | EXISTS in router, component file exists (`AssignmentTool.tsx`), renders BLANK |
| Progress Dashboard | `/dashboard/coordinator` | FUNCTIONAL with demo data |
| Master Results | `/dashboard/coordinator/results` | EXISTS in router, component file exists (`MasterResults.tsx`), renders BLANK |

#### Admin Screens

| PRD Requirement | Route | Status |
|----------------|-------|--------|
| AI Settings | `/dashboard/admin/ai-settings` | FULLY FUNCTIONAL with demo data |

---

## Missing Features from PRD

1. **Authentication System**: Login and registration forms are placeholder divs. No actual auth flow exists.
2. **Assessor Dashboard**: No assessor-specific views are routable despite sidebar navigation items being defined for the assessor role.
3. **Assessment Form**: No component exists for assessors to score and comment on applications.
4. **Notifications System**: Bell icon in header is present but non-functional (no notification panel).
5. **User Profile Management**: `/dashboard/profile` is linked from user dropdown and assessor sidebar but has no route.
6. **Search/Filter on Calls List**: No search, filter, or sort controls on the public calls list page.
7. **Bulk Operations**: ApplicationsView has bulk selection logic in code but the page doesn't render.
8. **Export Functionality**: MasterResults has export logic but the page doesn't render.

---

## Backend API Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/v1/calls/open` | 200 OK | Returns 3 demo calls with `"meta":{"demo":true}` |
| `GET /api/v1/calls` | 401 | Requires authentication |
| Proxy (port 3000 -> 4000) | 429 | Rate limited on repeated requests |

The backend serves demo data and has proper authentication middleware. The rate limiting issue is specific to the Vite proxy configuration.

---

## Architecture Notes

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, React Router v6, TanStack Query, React Hook Form, Tailwind CSS, Headless UI
- **Backend**: Express + TypeScript (ts-node-dev), running on port 4000
- **Proxy**: Vite dev server proxies `/api` to `http://localhost:4000`
- **Styling**: GOV.UK Design System influence with Tailwind utilities

### Component Architecture
- **Layouts**: PublicLayout, AuthLayout, DashboardLayout (with collapsible sidebar)
- **Pages**: Organized by role (Applicant, Coordinator, Admin)
- **Hooks**: Custom hooks per domain (useCalls, useApplications, useAssessments, useAI)
- **Demo Fallback**: Multiple hooks contain hardcoded `DEMO_*` arrays for offline operation

### Data Flow
- Public routes use `useOpenCalls` -> `callsApi.getOpenCalls()` -> `/api/v1/calls/open`
- Dashboard uses `useAllCalls` -> falls back to `DEMO_CALLS` on API failure
- AI Settings uses `useAISettings` -> falls back to `DEMO_STATUS` on API failure

---

## Recommendations (Priority Order)

1. **Fix sidebar navigation URLs** to match the actual router paths (or restructure routes to match sidebar)
2. **Fix coordinator dashboard link paths** by prepending `/dashboard` to all generated URLs
3. **Investigate blank page rendering** on deep routes -- likely a component import/mount error that needs Error Boundary wrapping
4. **Fix useParams mismatches** between route definitions and component expectations
5. **Implement login/register forms** to replace placeholder divs
6. **Add consistent demo data fallback** in `useOpenCalls` to match `useAllCalls` behavior
7. **Resolve API rate limiting** in the Vite proxy configuration
8. **Implement missing assessor screens** (assessment form, assigned applications list)
9. **Add React Error Boundary** around route outlets to catch and display component errors
10. **Wire up notification system** and user profile management

---

## Files Referenced

| File | Purpose |
|------|---------|
| `/home/devuser/workspace/funding_platform/frontend/src/App.tsx` | Router configuration (all route definitions) |
| `/home/devuser/workspace/funding_platform/frontend/src/layouts/DashboardLayout.tsx` | Dashboard sidebar navigation links |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/Dashboard.tsx` | Coordinator dashboard with broken links |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/CallSetup.tsx` | 4-step call setup wizard (doesn't render) |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/ApplicationsView.tsx` | Applications table with filters (doesn't render) |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/AssignmentTool.tsx` | Assignment tool with round-robin (doesn't render) |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Coordinator/MasterResults.tsx` | Results with sorting and export (doesn't render) |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Applicant/CallsList.tsx` | Public calls list page |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Applicant/ApplicationForm.tsx` | Multi-step application form |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Applicant/SubmissionConfirmation.tsx` | Post-submission confirmation |
| `/home/devuser/workspace/funding_platform/frontend/src/pages/Admin/AISettings.tsx` | AI provider and feature configuration |
| `/home/devuser/workspace/funding_platform/frontend/src/hooks/useCalls.ts` | Calls data hook with demo fallback |
| `/home/devuser/workspace/funding_platform/frontend/src/hooks/useAI.ts` | AI settings hook with demo fallback |
| `/home/devuser/workspace/funding_platform/frontend/src/services/api.ts` | Axios API client (base URL: /api/v1) |
| `/home/devuser/workspace/funding_platform/frontend/vite.config.ts` | Vite config with proxy to port 4000 |
