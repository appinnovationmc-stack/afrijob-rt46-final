import { describe, expect, it } from 'vitest';
import { INDUSTRY_CONFIG, INDUSTRY_LABELS, isModuleEnabled } from '@/hooks/useOrganisation';

describe('AfriOps industry configuration', () => {
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
