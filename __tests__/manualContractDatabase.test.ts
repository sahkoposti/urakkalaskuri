jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-sqlite', () => ({}));

const updates: unknown[][] = [];
let row: Record<string, unknown> | null = null;

const fakeDb = {
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  getFirstAsync: async (sql: string) => (sql.startsWith('SELECT offer_number') ? { offer_number: 10290 } : row),
  getAllAsync: async () => [],
  runAsync: async (...args: unknown[]) => {
    updates.push(args);
  },
};

jest.mock('../src/core/database/connection', () => ({
  ...jest.requireActual('../src/core/database/connection'),
  getDb: async () => fakeDb,
}));

import { saveManualContractPrices } from '../src/core/database/database';

describe('saveManualContractPrices', () => {
  beforeEach(() => {
    updates.length = 0;
    row = {
      id: 'c1',
      project_name: 'Testi',
      customer: null,
      created_at: '2026-10-01T00:00:00.000Z',
      contract_price_vat0: 0,
      materials_vat0: 0,
      total_price_vat0: 1000,
      total_price_vat0_before_discount: 1000,
      margin_eur: 1000,
      offer_number: 10290,
      vat_percent: 25.5,
      structure_lines: JSON.stringify([
        {
          id: 'l1',
          structureId: 's1',
          name: 'Rakenne',
          quantity: 1,
          unitPriceVat0: 1000,
          materialsVat0: 0,
          discountPercent: 0,
          vatPercent: 25.5,
          contractPriceVat0: 0,
          workDurationDays: 1,
          commissionPercent: 0,
          commissionEur: 0,
          marginEur: 0,
          marginPercent: 0,
          fieldValues: {},
          formFilled: false,
          overrides: [],
        },
      ]),
    };
  });

  it('replaces contractPriceVat0, recalculates margin, saves via saveCalculation (offer number kept)', async () => {
    const saved = await saveManualContractPrices('c1', { l1: 750 });
    expect(saved.structureLines?.[0].contractPriceVat0).toBe(750);
    expect(saved.structureLines?.[0].overrides).toContain('contractPrice');
    expect(saved.structureLines?.[0].marginEur).toBe(250);
    expect(saved.contractPriceVat0).toBe(750);
    expect(saved.marginEur).toBe(250);
    const inserts = updates.filter((u) => String(u[0]).includes('INSERT OR REPLACE INTO calculations'));
    expect(inserts).toHaveLength(1);
    const [sql, ...params] = inserts[0] as [string, ...unknown[]];
    expect(sql).toContain('INSERT OR REPLACE INTO calculations');
    expect(params[8]).toBe(750); // contract_price_vat0
    expect(params[10]).toBe(250); // margin_eur
    expect(params[27]).toBe(10290); // offer_number preserved
    expect(JSON.parse(params[26] as string)[0].contractPriceVat0).toBe(750);
  });

  it('throws for a missing calculation', async () => {
    row = null;
    await expect(saveManualContractPrices('x', { l1: 1 })).rejects.toThrow('Laskelmaa ei löytynyt');
    expect(updates).toHaveLength(0);
  });
});
