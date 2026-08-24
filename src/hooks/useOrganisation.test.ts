import { describe, it, expect, vi } from 'vitest';

// useOrganisation.ts imports '@/lib/supabase' at module scope, and that
// module throws immediately if VITE_SUPABASE_URL/KEY aren't set (correct
// behaviour for the real app - fail loudly on missing config, not
// silently). These tests only exercise the two pure functions exported
// alongside the hooks, so the client itself is mocked out rather than
// requiring real Supabase env vars just to import the file.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => null }));

const { isModuleEnabled, roleAtLeast } = await import('./useOrganisation');

describe('isModuleEnabled', () => {
  it('treats a missing enabled_modules value as everything enabled (fail-open for orgs that predate the field)', () => {
    expect(isModuleEnabled(null, 'inventory')).toBe(true);
    expect(isModuleEnabled(undefined, 'inventory')).toBe(true);
  });

  it('treats a module absent from the object as enabled - only an explicit false disables it', () => {
    expect(isModuleEnabled({ procurement: false }, 'inventory')).toBe(true);
  });

  it('disables a module only when explicitly set to false', () => {
    expect(isModuleEnabled({ inventory: false }, 'inventory')).toBe(false);
    expect(isModuleEnabled({ inventory: true }, 'inventory')).toBe(true);
  });

  it('treats array-form enabled_modules as an explicit-disable list (inverted semantics from the object form)', () => {
    // this is the one genuinely surprising branch in the function - worth
    // pinning down with a test since a future refactor could easily flip
    // "includes" to mean "enabled" instead of "disabled" by mistake
    expect(isModuleEnabled(['inventory'], 'inventory')).toBe(false);
    expect(isModuleEnabled(['inventory'], 'procurement')).toBe(true);
  });
});

describe('roleAtLeast', () => {
  it('returns false for an undefined role rather than throwing', () => {
    expect(roleAtLeast(undefined, 'admin')).toBe(false);
  });

  it('owner outranks every other role including admin', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true);
  });

  it('a role meets its own minimum (>=, not >)', () => {
    expect(roleAtLeast('admin', 'admin')).toBe(true);
  });

  it('viewer does not meet admin, and admin does not meet owner', () => {
    expect(roleAtLeast('viewer', 'admin')).toBe(false);
    expect(roleAtLeast('admin', 'owner')).toBe(false);
  });

  it('same-tier specialist roles (finance vs fleet_manager) rank equal to each other', () => {
    // this is the "not a real seniority hierarchy" case the source
    // comment warns about - pinning down that it's at least internally
    // consistent (equal tier, not accidentally ordered) rather than
    // testing a seniority claim the code never makes
    expect(roleAtLeast('finance', 'fleet_manager')).toBe(true);
    expect(roleAtLeast('fleet_manager', 'finance')).toBe(true);
  });
});
