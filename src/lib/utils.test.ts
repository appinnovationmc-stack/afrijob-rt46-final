import { describe, it, expect, vi, afterEach } from 'vitest';
import { cn, formatDate, daysUntil, formatCurrencyZAR } from './utils';

describe('cn', () => {
  it('merges class strings and drops falsy values', () => {
    const includeB = false;
    expect(cn('a', includeB && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    // this is the whole point of using tailwind-merge under the hood -
    // plain clsx would leave both 'px-2 px-4' in the string
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatDate', () => {
  it('renders an em dash for null/undefined rather than throwing or showing "Invalid Date"', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a real ISO date as day/short-month/year', () => {
    expect(formatDate('2026-03-05T00:00:00Z')).toBe('05 Mar 2026');
  });
});

describe('daysUntil', () => {
  afterEach(() => vi.useRealTimers());

  it('returns null for a missing date rather than NaN', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });

  it('rounds up to the nearest whole day remaining', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    // exactly 5 days away
    expect(daysUntil('2026-01-06T00:00:00Z')).toBe(5);
  });

  it('is negative for a date already in the past (this is how expiry warnings detect "already expired")', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    expect(daysUntil('2026-01-01T00:00:00Z')).toBeLessThan(0);
  });
});

describe('formatCurrencyZAR', () => {
  it('formats a real amount with the ZAR symbol (en-ZA locale: space thousands separator, comma decimal)', () => {
    expect(formatCurrencyZAR(4250.5)).toBe('R\u00A04\u00A0250,50');
  });

  it('renders null/undefined identically to an explicit 0, not a differently-formatted placeholder string', () => {
    // Regression test: this used to return a hardcoded 'R0.00' for
    // null/undefined while an actual 0 went through Intl and came out as
    // 'R 0,00' - two different-looking strings for what should be the
    // same "no cost" display. Both must now match exactly.
    const zero = formatCurrencyZAR(0);
    expect(formatCurrencyZAR(null)).toBe(zero);
    expect(formatCurrencyZAR(undefined)).toBe(zero);
  });
});
