jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

type Row = { offer_number: number | null };
const calculations = new Map<string, Row>();
const settings = new Map<string, string>();

const fakeDb = {
  withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  getFirstAsync: async (sql: string, arg: string) => {
    if (sql.includes('FROM calculations')) return calculations.get(arg) ?? null;
    if (sql.includes('FROM settings')) return settings.has(arg) ? { value: settings.get(arg) } : null;
    return null;
  },
  runAsync: async (sql: string, ...args: unknown[]) => {
    if (sql.startsWith('UPDATE calculations SET offer_number')) {
      calculations.set(args[1] as string, { offer_number: args[0] as number });
    } else if (sql.startsWith('INSERT OR REPLACE INTO settings')) {
      settings.set(args[0] as string, args[1] as string);
    }
  },
};

jest.mock('../src/core/database/connection', () => ({
  getDb: async () => fakeDb,
}));

import { assignOfferNumberForCalculation, getStoredNextOfferNumber } from '../src/core/database/database';

describe('assignOfferNumberForCalculation', () => {
  beforeEach(() => {
    calculations.clear();
    settings.clear();
    calculations.set('a', { offer_number: null });
    calculations.set('b', { offer_number: null });
  });

  it('assigns sequential numbers from the default start and reuses on reprint', async () => {
    const first = await assignOfferNumberForCalculation('a');
    expect(first).toMatchObject({ offerNumber: 10285, assigned: true });
    const reprint = await assignOfferNumberForCalculation('a');
    expect(reprint).toMatchObject({ offerNumber: 10285, assigned: false });
    const second = await assignOfferNumberForCalculation('b');
    expect(second.offerNumber).toBe(10286);
    expect(await getStoredNextOfferNumber()).toBe(10287);
  });

  it('parallel taps on the same calculation give one number', async () => {
    const [x, y] = await Promise.all([assignOfferNumberForCalculation('a'), assignOfferNumberForCalculation('a')]);
    expect(x.offerNumber).toBe(y.offerNumber);
    expect(await getStoredNextOfferNumber()).toBe(10286);
  });

  it('uses the configured start number', async () => {
    settings.set('offer_company_settings', JSON.stringify({ offerNumberStart: 500 }));
    expect((await assignOfferNumberForCalculation('a')).offerNumber).toBe(500);
  });

  it('rejects an unknown calculation without moving the counter', async () => {
    await expect(assignOfferNumberForCalculation('missing')).rejects.toThrow('Laskelmaa ei löytynyt');
    expect(await getStoredNextOfferNumber()).toBeUndefined();
  });
});
