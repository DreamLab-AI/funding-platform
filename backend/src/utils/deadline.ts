/**
 * Submission deadline helpers.
 *
 * Funding-call deadlines (`funding_calls.close_at`) are authored as
 * Europe/London wall-clock times and persisted as PostgreSQL `TIMESTAMPTZ`,
 * i.e. an unambiguous absolute instant. Comparing absolute instants is
 * therefore timezone-correct without any manual offset arithmetic, and remains
 * correct across British Summer Time transitions. The `pg` driver hydrates a
 * `TIMESTAMPTZ` column into a JavaScript `Date`, but callers may also pass the
 * raw ISO string, so both are accepted here.
 */
export function isDeadlinePassed(
  closeAt: Date | string,
  now: Date = new Date()
): boolean {
  const deadline = closeAt instanceof Date ? closeAt : new Date(closeAt);

  // A value we cannot parse is treated as "not passed" so that a data anomaly
  // never spuriously blocks a legitimate submission; the controller only calls
  // this when close_at is present (the column is NOT NULL in the schema).
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  return now.getTime() > deadline.getTime();
}
