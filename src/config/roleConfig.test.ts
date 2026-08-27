import { describe, it, expect } from 'vitest';
import { getRoleConfig, ROLE_CONFIG, type OrganisationRole } from './roleConfig';

describe('getRoleConfig', () => {
  it('falls back to viewer when role is undefined', () => {
    expect(getRoleConfig(undefined).role).toBe('viewer');
  });

  it('returns the exact config for every known role', () => {
    (Object.keys(ROLE_CONFIG) as OrganisationRole[]).forEach((role) => {
      const cfg = getRoleConfig(role);
      expect(cfg.role).toBe(role);
      expect(cfg.defaultLanding).toBeTruthy();
      expect(Array.isArray(cfg.allowedModules)).toBe(true);
      expect(Array.isArray(cfg.nav)).toBe(true);
    });
  });

  it('procurement officer lands on procurement and does not include approval-only modules they cannot drive', () => {
    const cfg = getRoleConfig('procurement_officer');
    expect(cfg.defaultLanding).toBe('/ops/procurement');
    expect(cfg.allowedModules).toContain('procurement');
    expect(cfg.allowedModules).not.toContain('admin_team');
  });

  it('finance lands on finance workspace', () => {
    expect(getRoleConfig('finance').defaultLanding).toBe('/ops/finance');
    expect(getRoleConfig('finance').allowedModules).toContain('finance');
  });

  it('technician lands on work orders', () => {
    expect(getRoleConfig('technician').defaultLanding).toBe('/ops/work-orders');
  });

  it('every nav item moduleKey is included in allowedModules when present', () => {
    (Object.keys(ROLE_CONFIG) as OrganisationRole[]).forEach((role) => {
      const cfg = ROLE_CONFIG[role];
      cfg.nav.forEach((item) => {
        if (item.moduleKey) {
          expect(cfg.allowedModules).toContain(item.moduleKey);
        }
      });
    });
  });
});
