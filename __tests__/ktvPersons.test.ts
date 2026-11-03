jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-sqlite', () => ({}));

const COLUMNS = [
  'id',
  'project_name',
  'customer',
  'group_duration_h',
  'crew_size',
  'hourly_rate',
  'margin_percent',
  'commission_percent',
  'contract_price_vat0',
  'materials_vat0',
  'margin_eur',
  'commission_eur',
  'total_price_vat0',
  'vat_percent',
  'vat_amount',
  'total_price_vat',
  'work_duration_days',
  'discount_percent',
  'discount_eur',
  'total_price_vat_before_discount',
  'total_price_vat0_before_discount',
  'created_at',
  'form_snapshot',
  'customer_id',
  'delivery_schedule_text',
  'travel_time_one_way_h',
  'structure_lines',
  'offer_number',
] as const;

const rows = new Map<string, Record<string, unknown>>();

const fakeDb = {
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  getFirstAsync: async (sql: string, id: string) => {
    const row = rows.get(id);
    if (!row) return null;
    if (sql.includes('offer_number') && !sql.includes('form_snapshot')) return { offer_number: row.offer_number ?? null };
    return row;
  },
  getAllAsync: async () => [],
  runAsync: async (sql: string, ...args: unknown[]) => {
    if (!sql.includes('INSERT OR REPLACE INTO calculations')) return;
    const row: Record<string, unknown> = {};
    COLUMNS.forEach((column, index) => {
      row[column] = args[index];
    });
    rows.set(String(row.id), row);
  },
};

jest.mock('../src/core/database/connection', () => ({
  ...jest.requireActual('../src/core/database/connection'),
  getDb: async () => fakeDb,
}));

import { getCalculation, saveCalculation } from '../src/core/database/database';
import {
  calculationWithKtvPersons,
  ktvPersonsFieldText,
  parseKtvPersonsInput,
  preserveKtvPersons,
  readKtvPersons,
} from '../src/core/pdf/ktvPersons';
import { record } from './pdfFixtures';

describe('ktv persons storage', () => {
  beforeEach(() => {
    rows.clear();
  });

  it('defaults to 1 when the JSON key is absent and rejects invalid input', () => {
    expect(readKtvPersons(undefined)).toBe(1);
    expect(readKtvPersons({ formId: 'f', formVersion: 1, fields: [] })).toBe(1);
    expect(readKtvPersons({ formId: 'f', formVersion: 1, fields: [], ktvPersons: undefined })).toBe(1);
    expect(ktvPersonsFieldText(undefined)).toBe('1');
    expect(() => readKtvPersons({ formId: 'f', formVersion: 1, fields: [], ktvPersons: 11 })).toThrow(
      'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
    );
    expect(parseKtvPersonsInput('2')).toBe(2);
    expect(parseKtvPersonsInput('10')).toBe(10);
    for (const raw of ['0', '11', '2.5', '2,5', '', 'NaN', '01']) {
      expect(parseKtvPersonsInput(raw)).toBe('invalid');
    }
  });

  it('round-trips n through save and load in form_snapshot.ktvPersons', async () => {
    const source = calculationWithKtvPersons(record({}), 3);
    expect(source.formSnapshot?.ktvPersons).toBe(3);
    expect(JSON.stringify(source.formSnapshot)).toContain('"ktvPersons":3');
    await saveCalculation(source);
    const stored = rows.get(source.id);
    expect(stored?.form_snapshot).toEqual(expect.stringContaining('"ktvPersons":3'));
    expect(String(stored?.form_snapshot)).not.toContain('hourly_rate');
    const loaded = await getCalculation(source.id);
    expect(loaded?.formSnapshot?.ktvPersons).toBe(3);
    expect(readKtvPersons(loaded?.formSnapshot)).toBe(3);
    expect(ktvPersonsFieldText(loaded?.formSnapshot)).toBe('3');
  });

  it('keeps an absent key as 1 across save and load', async () => {
    const source = record({});
    expect(source.formSnapshot?.ktvPersons).toBeUndefined();
    await saveCalculation(source);
    const loaded = await getCalculation(source.id);
    expect(loaded?.formSnapshot?.ktvPersons).toBeUndefined();
    expect(readKtvPersons(loaded?.formSnapshot)).toBe(1);
  });

  it('wizard rebuild keeps the stored key', () => {
    const previous = calculationWithKtvPersons(record({}), 2).formSnapshot;
    const rebuilt = record({}, { formSnapshot: { formId: 'new', formVersion: 4, fields: [] } });
    const kept = preserveKtvPersons(rebuilt, previous);
    expect(kept.formSnapshot).toMatchObject({ formId: 'new', formVersion: 4, ktvPersons: 2 });
  });
});
