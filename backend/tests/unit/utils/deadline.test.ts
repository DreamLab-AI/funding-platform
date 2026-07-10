import { isDeadlinePassed } from '../../../src/utils/deadline';

describe('isDeadlinePassed', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');

  it('returns true when the deadline is in the past', () => {
    expect(isDeadlinePassed(new Date('2026-07-10T11:59:59.000Z'), now)).toBe(true);
  });

  it('returns false when the deadline is in the future', () => {
    expect(isDeadlinePassed(new Date('2026-07-10T12:00:01.000Z'), now)).toBe(false);
  });

  it('returns false at the exact deadline instant (boundary is inclusive)', () => {
    expect(isDeadlinePassed(new Date('2026-07-10T12:00:00.000Z'), now)).toBe(false);
  });

  it('accepts an ISO string deadline (as returned by the pg driver in raw mode)', () => {
    expect(isDeadlinePassed('2026-07-10T11:00:00.000Z', now)).toBe(true);
    expect(isDeadlinePassed('2026-07-10T13:00:00.000Z', now)).toBe(false);
  });

  it('is timezone-correct across a BST offset (TIMESTAMPTZ is an absolute instant)', () => {
    // 23:30 Europe/London on 2026-07-10 == 22:30Z (BST, UTC+1). A submission at
    // 22:45Z is after the deadline; at 22:15Z it is before.
    const deadline = '2026-07-10T22:30:00.000Z';
    expect(isDeadlinePassed(deadline, new Date('2026-07-10T22:45:00.000Z'))).toBe(true);
    expect(isDeadlinePassed(deadline, new Date('2026-07-10T22:15:00.000Z'))).toBe(false);
  });

  it('treats an unparseable deadline as not passed (fail-open, never blocks wrongly)', () => {
    expect(isDeadlinePassed('not-a-date', now)).toBe(false);
  });
});
