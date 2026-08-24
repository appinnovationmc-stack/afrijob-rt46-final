import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// useEntitlements wraps useBillingAccount - mock that one layer so these
// tests exercise the actual level-derivation logic (the part with real
// branching to get wrong) without needing a live Supabase org/query.
const mockUseBillingAccount = vi.fn();
vi.mock('./useBillingAccount', () => ({
  useBillingAccount: () => mockUseBillingAccount(),
}));

const { useEntitlements } = await import('./useEntitlements');

function billing(overrides: Partial<{ status: string; trial_ends_at: string | null }>) {
  return {
    data: {
      id: 'x', organisation_id: 'org', plan: 'standard', provider: 'none',
      external_account_ref: null, created_at: '', updated_at: '',
      trial_ends_at: null, status: 'trial',
      ...overrides,
    },
    isLoading: false,
  };
}

describe('useEntitlements', () => {
  afterEach(() => {
    vi.useRealTimers();
    mockUseBillingAccount.mockReset();
  });

  it('returns null data while billing is still loading, not a false "ok"', () => {
    mockUseBillingAccount.mockReturnValue({ data: null, isLoading: true });
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('cancelled status is a hard block - the one status that gates', () => {
    mockUseBillingAccount.mockReturnValue(billing({ status: 'cancelled' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data?.level).toBe('blocked');
  });

  it('past_due is a warning, not a block - no payment provider is wired up so the org has no way to self-resolve it', () => {
    mockUseBillingAccount.mockReturnValue(billing({ status: 'past_due' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data?.level).toBe('warn');
  });

  it('active status with no trial is unconditionally ok', () => {
    mockUseBillingAccount.mockReturnValue(billing({ status: 'active' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data).toEqual({ level: 'ok', message: null, trialDaysRemaining: null });
  });

  it('trial with more than 7 days left is ok and silent (no nagging banner)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    mockUseBillingAccount.mockReturnValue(billing({ status: 'trial', trial_ends_at: '2026-01-20T00:00:00Z' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data?.level).toBe('ok');
    expect(result.current.data?.message).toBeNull();
  });

  it('trial with 7 or fewer days left warns but does not block', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    mockUseBillingAccount.mockReturnValue(billing({ status: 'trial', trial_ends_at: '2026-01-05T00:00:00Z' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data?.level).toBe('ok'); // still ok, not yet 0
    expect(result.current.data?.trialDaysRemaining).toBe(4);
    expect(result.current.data?.message).toContain('4 day');
  });

  it('an already-ended trial (0 or negative days remaining) warns, it does not block', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    mockUseBillingAccount.mockReturnValue(billing({ status: 'trial', trial_ends_at: '2026-01-01T00:00:00Z' }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.data?.level).toBe('warn');
    expect(result.current.data?.message).toMatch(/trial has ended/i);
  });
});
