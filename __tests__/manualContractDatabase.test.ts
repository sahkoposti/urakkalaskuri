jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-sqlite', () => ({}));

const updates: unknown[][] = [];
let row: Record<string, unknown> | null = null;

const fakeDb = {
  getFirstAsync: async () => row,
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

  it('writes only structure_lines with the manual sum', async () => {
    const saved = await saveManualContractPrices('c1', { l1: 750 });
    expect(saved.structureLines?.[0].manualContractPriceVat0).toBe(750);
    expect(saved.structureLines?.[0].contractPriceVat0).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0][0]).toBe('UPDATE calculations SET structure_lines = ? WHERE id = ?');
    expect(JSON.parse(updates[0][1] as string)[0].manualContractPriceVat0).toBe(750);
    expect(updates[0][2]).toBe('c1');
  });

  it('throws for a missing calculation', async () => {
    row = null;
    await expect(saveManualContractPrices('x', { l1: 1 })).rejects.toThrow('Laskelmaa ei löytynyt');
    expect(updates).toHaveLength(0);
  });
});
