# Style Guide: Funding Application Submission & Assessment Platform

## Design System Overview

The platform follows a **GOV.UK-inspired design system** tailored for a funding application context. All public-facing applicant journeys must meet **WCAG 2.1 AA** compliance (PRD NFR-021). The design tokens are defined in `frontend/src/styles/design-tokens.css` with dark mode and high-contrast mode support.

---

## 1. Color Palette

### Primary Colors (GOV.UK Blue Scale)

| Token | Value | Usage |
|---|---|---|
| `--color-primary-500` | `#1d70b8` | Primary brand color, buttons, links |
| `--color-primary-600` | `#1a65a6` | Hover states |
| `--color-primary-700` | `#155490` | Active states |
| `--color-primary-800` | `#104478` | Dark accents |
| `--color-primary-900` | `#0b2e52` | Darkest shade |

### Semantic Status Colors

| Category | Token | Value | Usage |
|---|---|---|---|
| Success | `--color-success-500` | `#00703c` | GOV.UK Green. Submission confirmations, clean scan status |
| Error | `--color-error-500` | `#d4351c` | GOV.UK Red. Validation errors, infected file warnings, deadline passed |
| Warning | `--color-warning-500` | `#ffdd00` | GOV.UK Yellow. Approaching deadline, high variance flags |
| Info | `--color-info-500` | `#2e8aca` | Informational banners, pending states |

### Accessibility Focus State

| Token | Value | Usage |
|---|---|---|
| `--color-focus` | `#ffdd00` | Focus ring color (matches GOV.UK focus indicator) |
| `--color-focus-text` | `#0b0c0c` | Text color when element is focused |
| `--focus-ring-width` | `3px` | Width of focus outline |

### Text Colors (High Contrast)

| Token | Value | Contrast Ratio vs White | Usage |
|---|---|---|---|
| `--color-text-primary` | `#0b0c0c` | 19.3:1 | Body text, headings |
| `--color-text-secondary` | `#505a5f` | 7.0:1 | Supporting text, labels |
| `--color-text-tertiary` | `#6f777b` | 4.7:1 | Placeholder text, hints (AA compliant for large text) |
| `--color-text-link` | `#1d70b8` | 4.7:1 | Links (meets AA for large text; underline provides additional affordance) |
| `--color-text-link-visited` | `#4c2c92` | 7.3:1 | Visited links |

---

## 2. Typography

### Font Stack

```css
--font-family-sans: 'GDS Transport', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-family-mono: 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
```

GDS Transport is the GOV.UK typeface. The fallback chain ensures consistent rendering when the GDS Transport font is not available.

### Type Scale

All sizes use `rem` units based on a 16px root to support browser font size preferences (accessibility).

| Token | Size | Usage |
|---|---|---|
| `--font-size-xs` | 0.75rem (12px) | Metadata, timestamps, badge text |
| `--font-size-sm` | 0.875rem (14px) | Table cells, secondary labels |
| `--font-size-base` | 1rem (16px) | Body text, form inputs |
| `--font-size-lg` | 1.125rem (18px) | Emphasized body, lead paragraphs |
| `--font-size-xl` | 1.25rem (20px) | Section subheadings |
| `--font-size-2xl` | 1.5rem (24px) | Page section titles |
| `--font-size-3xl` | 1.875rem (30px) | Page headings (H2) |
| `--font-size-4xl` | 2.25rem (36px) | Primary headings (H1) |
| `--font-size-5xl` | 3rem (48px) | Hero text (landing page) |

### Line Heights

| Token | Value | Usage |
|---|---|---|
| `--line-height-tight` | 1.25 | Headings |
| `--line-height-normal` | 1.5 | Body text (WCAG recommended minimum) |
| `--line-height-relaxed` | 1.625 | Long-form content, descriptions |

### Font Weights

| Token | Value | Usage |
|---|---|---|
| `--font-weight-normal` | 400 | Body text |
| `--font-weight-medium` | 500 | Labels, navigation items |
| `--font-weight-semibold` | 600 | Table headers, emphasized text |
| `--font-weight-bold` | 700 | Headings, buttons |

---

## 3. Spacing System

Based on an 8px grid unit:

| Token | Value | Common Usage |
|---|---|---|
| `--space-1` | 4px | Inline icon gaps |
| `--space-2` | 8px | Tight component padding |
| `--space-3` | 12px | Button padding-block |
| `--space-4` | 16px | Card padding, form field gaps |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Page section margins |
| `--space-12` | 48px | Major section separators |
| `--space-16` | 64px | Page-level vertical rhythm |

---

## 4. Component Patterns

### Buttons

Implementation: `frontend/src/components/ui/Button.tsx`

- Primary: `--color-primary-500` background, white text, `--radius-default` corners
- Secondary: White background, `--color-primary-500` border and text
- Danger: `--color-error-500` background for destructive actions
- Ghost: Transparent background, primary text color
- All buttons: minimum 44px touch target (WCAG 2.5.5), visible focus ring

### Cards

Implementation: `frontend/src/components/ui/Card.tsx`

- White background, `--shadow-card` elevation
- `--shadow-card-hover` on hover for interactive cards
- `--space-4` to `--space-6` internal padding
- `--radius-lg` corners

### Data Tables

Implementation: `frontend/src/components/ui/DataTable.tsx`, `frontend/src/components/Tables/DataTable.tsx`

- Sortable column headers with sort indicators
- Filterable by status
- Striped rows with `--color-bg-secondary` alternating background
- Sticky header for scrollable tables
- Used for: coordinator applications view, master results, assessor pool

### File Upload Zone

Implementation: `frontend/src/components/ui/FileUpload.tsx`, `frontend/src/components/Forms/FileUpload.tsx`

- Drag-and-drop with dashed border zone
- Browse button as fallback
- Progress indicator during upload
- File type and size validation feedback inline
- Accepted file list displayed after upload

### Stepper (Multi-step Forms)

Implementation: `frontend/src/components/ui/Stepper.tsx`

- Horizontal step indicators with numbered circles
- Active step highlighted with primary color
- Completed steps show checkmark
- Used for: application submission flow, call setup wizard

### Score Input

Implementation: `frontend/src/components/ui/ScoreInput.tsx`, `frontend/src/components/Forms/ScoreInput.tsx`

- Numeric input with min/max validation
- Visual indicator of score range
- Optional comment field per criterion
- Used in: assessor scoring form

### Progress Indicators

Implementation: `frontend/src/components/ui/Progress.tsx`, `frontend/src/components/Common/ProgressBar.tsx`

- Linear progress bar with percentage label
- Color-coded: green (>75%), yellow (25-75%), red (<25%)
- Used for: upload progress, assessment completion tracking

### Toast Notifications

Implementation: `frontend/src/components/ui/Toast.tsx`, `frontend/src/components/Common/Toast.tsx`

- Top-right positioned via `react-hot-toast`
- Success (green), error (red), info (blue) variants
- Auto-dismiss after 5 seconds
- Dismissible via close button

### Modal Dialog

Implementation: `frontend/src/components/ui/Dialog.tsx`, `frontend/src/components/Common/Modal.tsx`

- Overlay with `--color-bg-overlay` backdrop
- Focus trapped within modal
- Escape key closes
- Used for: confirmation prompts, assignment actions

### Badge

Implementation: `frontend/src/components/ui/Badge.tsx`

- Small inline status indicators
- Variants: draft (grey), open (green), closed (red), in_assessment (blue), completed (purple)
- Used for: call status, application status, assignment status

---

## 5. Layout System

### Page Layouts

Three layout wrappers (defined in `frontend/src/layouts/`):

1. **PublicLayout** (`PublicLayout.tsx`): Header + content area. Used for open calls listing, landing page.
2. **AuthLayout** (`AuthLayout.tsx`): Centered card with title. Used for login, registration.
3. **DashboardLayout** (`DashboardLayout.tsx`): Sidebar + header + content area. Used for all authenticated routes.

### Layout Components

- **Header** (`components/Layout/Header.tsx`): Navigation, user identity, role badge
- **Sidebar** (`components/Layout/Sidebar.tsx`): Role-based navigation menu
- **Footer** (`components/Layout/Footer.tsx`): Copyright, links

### Responsive Breakpoints

| Token | Value | Usage |
|---|---|---|
| `--breakpoint-sm` | 640px | Mobile breakpoint |
| `--breakpoint-md` | 768px | Tablet breakpoint |
| `--breakpoint-lg` | 1024px | Desktop breakpoint |
| `--breakpoint-xl` | 1280px | Wide desktop |

Applicant submission flow works on mobile (PRD NFR-022). Coordinator dashboard is desktop-first.

---

## 6. Accessibility Requirements (WCAG 2.1 AA)

### Color Contrast
- Normal text (< 18px): minimum 4.5:1 contrast ratio
- Large text (>= 18px or 14px bold): minimum 3:1 contrast ratio
- Non-text elements (icons, borders): minimum 3:1 contrast ratio
- All primary/secondary text colors meet these thresholds

### Focus Indicators
- 3px yellow (`--color-focus`) outline on all interactive elements
- Focus visible on keyboard navigation
- Focus order follows logical DOM order

### Motion
- `prefers-reduced-motion` media query sets all animation durations to 0ms
- No content conveyed solely through animation

### High Contrast
- `prefers-contrast: high` media query increases text and border contrast
- Text goes to pure black, borders to pure black

### Keyboard Navigation
- All interactive elements reachable via Tab
- Modals trap focus
- Escape closes modals and dropdowns
- Enter/Space activates buttons and links

### Screen Reader Support
- Semantic HTML elements (nav, main, aside, section)
- ARIA labels on interactive elements
- Status messages announced via `aria-live` regions
- Form fields associated with labels via `htmlFor`/`id`

---

## 7. Dark Mode

Activated via `data-theme="dark"` attribute on the root element.

Key overrides:
- Background: `#1a1a2e` (primary), `#16213e` (secondary), `#0f0f23` (tertiary)
- Text: `#f8f9fa` (primary), `#b1b4b6` (secondary)
- Links: `#73b8ff` (unvisited), `#a3d0ff` (hover), `#b794f6` (visited)
- Primary accent: `#4d9de0` (lighter for dark backgrounds)
- Shadows: Increased opacity for visibility against dark backgrounds

---

## 8. Iconography

No icon library is mandated. Inline SVG icons are preferred for:
- Performance (no external font loading)
- Accessibility (can include `<title>` for screen readers)
- Styling (CSS-controlled fill/stroke)
- Consistent rendering across browsers

---

## 9. Data Visualizations

Implementation: `frontend/src/components/Visualizations/`

- **VarianceHeatmap**: Color-coded grid showing assessor score divergence
- **AssignmentNetwork**: Graph visualization of assessor-application relationships
- **ProgressRadial**: Circular progress indicator for completion rates
- **ScoreDistribution**: Histogram/bar chart of score frequencies
- **SubmissionTimeline**: Time-series chart of submission activity

WASM module (`frontend/src/wasm/`) provides performance-optimized rendering for complex visualizations.
