import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('AfriOps industry configuration', () => {
  let INDUSTRY_CONFIG: typeof import('@/hooks/useOrganisation').INDUSTRY_CONFIG;
  let INDUSTRY_LABELS: typeof import('@/hooks/useOrganisation').INDUSTRY_LABELS;
  let isModuleEnabled: typeof import('@/hooks/useOrganisation').isModuleEnabled;

  beforeAll(async () => {
    // Keep this pure configuration suite independent from production Supabase
    // credentials. useOrganisation also exports hooks that initialise the
    // Supabase client at module load, so provide harmless test-only values
    // before the module is imported.
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
    const mod = await import('@/hooks/useOrganisation');
    INDUSTRY_CONFIG = mod.INDUSTRY_CONFIG;
    INDUSTRY_LABELS = mod.INDUSTRY_LABELS;
    isModuleEnabled = mod.isModuleEnabled;
  });

  it('defines all supported enterprise modes', () => {
    expect(Object.keys(INDUSTRY_CONFIG).sort()).toEqual(['fleet', 'general', 'government', 'logistics', 'mining', 'municipal']);
    expect(INDUSTRY_LABELS.fleet).toBe('Fleet');
    expect(INDUSTRY_LABELS.mining).toBe('Mining');
    expect(INDUSTRY_LABELS.municipal).toBe('Municipal');
    expect(INDUSTRY_LABELS.government).toBe('Government');
    expect(INDUSTRY_LABELS.logistics).toBe('Logistics');
  });

  it('gives every mode a coherent operational configuration', () => {
    for (const config of Object.values(INDUSTRY_CONFIG)) {
      expect(config.assetLabelSingular.length).toBeGreaterThan(0);
      expect(config.assetLabelPlural.length).toBeGreaterThan(0);
      expect(config.tagline.length).toBeGreaterThan(0);
      expect(config.kpiOrder.length).toBeGreaterThanOrEqual(4);
      expect(config.suggestedAssetCategories.length).toBeGreaterThan(0);
      expect(config.suggestedPrompts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not accidentally disable unmentioned modules', () => {
    expect(isModuleEnabled(null, 'inventory')).toBe(true);
    expect(isModuleEnabled({ inventory: false } as never, 'inventory')).toBe(false);
    expect(isModuleEnabled({ inventory: true } as never, 'inventory')).toBe(true);
    expect(isModuleEnabled({ procurement: false } as never, 'inventory')).toBe(true);
  });
});
