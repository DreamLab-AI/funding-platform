# ADR-014: Score Aggregation Algorithm

## Status
Accepted

## Context
When multiple assessors score an application, the platform must aggregate their scores into a master results view for coordinators (FR-040, FR-041, FR-042). The aggregation must support optional criterion weighting (FR-003), variance flagging for high divergence between assessors (FR-041), and ranking by total or weighted score (FR-044).

## Decision
We implement a **weighted average aggregation algorithm** with variance-based divergence detection, encapsulated in the `ScoringService` (`backend/src/services/scoring.service.ts`).

### Aggregation Pipeline

**Per-application calculation** (`calculateApplicationResult()`):

1. **Retrieve assessments**: Get all submitted assessments for the application with assessor info.

2. **Build assessor scores**: For each assessor, collect their per-criterion scores, overall score, and comments.

3. **Criterion-level aggregation** (per criterion across all assessors):
   - Collect all scores for the criterion
   - Calculate: average, min, max, variance
   - Flag high variance: `(variance / max_points^2) * 100 > threshold`
   - Default variance threshold: 20% (configurable per call via `variance_threshold`)

4. **Overall score aggregation**:
   - `total_average`: Mean of all assessors' overall scores
   - `weighted_average` (if weights defined): For each assessor, compute weighted average of their criterion scores using criterion weights, then average across assessors
   - `total_variance`: Variance of all assessors' overall scores
   - `high_variance_flag`: True if any criterion has high variance

5. **Completion tracking**: `assessments_completed` vs `assessments_required` (from call config)

### Mathematical Functions

Utility functions (from `backend/src/utils/helpers.ts`):
- `calculateAverage(values)`: Arithmetic mean
- `calculateVariance(values)`: Population variance (mean of squared deviations)
- `calculateWeightedAverage(values, weights)`: Sum(value * weight) / Sum(weights)
- `calculateStdDev(values)`: Square root of variance

### Variance Flagging Logic

High variance is flagged when:
```
(criterion_variance / criterion_max_points^2) * 100 > threshold_percentage
```

This normalizes the variance relative to the scoring range, making the threshold meaningful regardless of whether the criterion is scored out of 5 or 100. The threshold is configurable per call (stored in `funding_calls.criteria_config` as `variance_threshold`).

Requires at least 2 assessors' scores to trigger a flag (`scores.length >= 2`).

### Master Results

**`getMasterResults()`** aggregates all submitted applications for a call:
- Retrieves all submitted applications
- Calculates per-application results
- Generates summary: total_applications, fully_assessed, partially_assessed, not_assessed, high_variance_count

**Score validation** (`validateScores()`):
- Ensures all criteria have scores
- Validates score ranges (0 to max_points)
- Checks required comments per criterion

**Ranking** (`rankResults()`):
- Sorts by total_average or weighted_average (descending)
- Falls back to total_average if weighted_average is not available

### Progress Tracking

**`getCallProgress()`** provides:
- Total applications (submitted only)
- Total assignments, completed assessments, outstanding assessments
- Completion percentage
- Per-assessor progress: assigned_count, completed_count, outstanding_count, last_activity

**`getAssessorsWithOutstanding()`** filters assessors who still have incomplete assessments (used for reminder email targeting).

## Consequences

### Positive
- Weighted average supports criterion-prioritized rubrics without changing the aggregation logic.
- Normalized variance threshold makes flagging consistent across differently-scaled criteria.
- The aggregation is stateless (computed on read, not stored), so it is always current.
- Progress tracking enables real-time dashboard updates.

### Negative
- Computing aggregation on every read may become slow for calls with thousands of applications. Caching or materialized views should be considered for large calls.
- Population variance (not sample variance) is used. With only 2-3 assessors per application, sample variance (Bessel's correction) would be more statistically appropriate. The impact is minor for the intended use case (flagging, not statistical testing).
- The weighted average implementation averages the per-assessor weighted scores rather than computing criterion-level weighted averages and then averaging. Both approaches are valid but produce slightly different results when assessors score different subsets of criteria.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Pre-computed aggregation (stored in database)** | Adds write complexity and risk of stale data. Compute-on-read is simpler and ensures consistency. Can be optimized with caching if performance becomes an issue. |
| **Median instead of mean** | More robust to outliers, but harder to interpret for assessment contexts where all assessor opinions are considered equally valid. Mean with variance flagging provides both the average and a signal for divergence. |
| **Inter-rater reliability (Cohen's kappa, ICC)** | Statistically rigorous but overly complex for the v1 use case. Variance flagging is a simpler heuristic that meets the PRD requirement. |
