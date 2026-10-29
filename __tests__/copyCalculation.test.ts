jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-sqlite', () => ({}));

const stored = new Map<string, number | null>();
const inserts: unknown[][] = [];

const fakeDb = {
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  getFirstAsync: async (sql: string, id: string) => {
    if (sql.startsWith('SELECT offer_number')) {
      return stored.has(id) ? { offer_number: stored.get(id) } : null;
    }
    return null;
  },
  getAllAsync: async () => [],
  runAsync: async (...args: unknown[]) => {
    const sql = String(args[0]);
    if (sql.includes('INSERT OR REPLACE INTO calculations')) {
      inserts.push(args);
      stored.set(args[1] as string, (args[28] as number | null) ?? null);
    }
  },
};

jest.mock('../src/core/database/connection', () => ({
  ...jest.requireActual('../src/core/database/connection'),
  getDb: async () => fakeDb,
}));

import { copyCalculationRecord, saveCalculation } from '../src/core/database/database';
import { assignOfferNumber } from '../src/core/pdf/offerNumber';
import { record } from './pdfFixtures';

describe('copyCalculationRecord', () => {
  beforeEach(() => {
    stored.clear();
    inserts.length = 0;
    stored.set('src', 10285);
  });

  it('does not carry offerNumber to the copy; the next offer gets a new number', async () => {
    const source = record({}, { id: 'src', offerNumber: 10285, projectName: 'Lähde' });
    const createdAt = new Date(2026, 9, 2);
    const copy = copyCalculationRecord(source, 'copy', createdAt);

    expect(copy.id).toBe('copy');
    expect(copy.createdAt).toBe(createdAt);
    expect(copy.offerNumber).toBeUndefined();
    expect(copy.projectName).toBe('Lähde');
    expect(copy.lines).not.toBe(source.lines);
    expect(source.offerNumber).toBe(10285);
    expect(source.id).toBe('src');

    const nextOffer = assignOfferNumber(copy.offerNumber ?? null, 10286, 10285);
    expect(nextOffer).toMatchObject({ offerNumber: 10286, assigned: true });
    expect(nextOffer.offerNumber).not.toBe(source.offerNumber);

    await saveCalculation(copy);
    expect(stored.get('copy')).toBeNull();

    const carried = { ...source, id: 'naive' };
    await saveCalculation(carried);
    expect(stored.get('naive')).toBeNull();
    expect(carried.offerNumber).toBe(10285);

    await saveCalculation(source);
    expect(stored.get('src')).toBe(10285);
    const kept = inserts.at(-1);
    expect(kept).toBeDefined();
    const [, ...params] = kept as unknown[];
    expect(params[27]).toBe(10285);
  });
});
