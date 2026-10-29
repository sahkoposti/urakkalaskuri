import { exportTarjousPdf, exportUrakkakorttiPdf, type PdfExportDeps } from '../src/core/pdf/exportPdf';
import { assignOfferNumber } from '../src/core/pdf/offerNumber';
import { recordWithManualContractPrices } from '../src/core/pdf/manualContract';
import type { GeneratePdfOptions } from '../src/core/pdf/generatePdf';
import type { CalculationRecord } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

function setup(rec: CalculationRecord) {
  let stored: CalculationRecord = rec;
  let next: number | undefined;
  const printed: GeneratePdfOptions[] = [];
  const base = input(rec);
  const deps: PdfExportDeps = {
    getCalculation: async () => stored,
    assignOfferNumber: async () => {
      const result = assignOfferNumber(stored.offerNumber ?? null, next, base.offerCompany.offerNumberStart);
      if (result.assigned) {
        stored = { ...stored, offerNumber: result.offerNumber };
        next = result.nextOfferNumber;
      }
      return result;
    },
    saveManualContractPrices: async (_id, values) => {
      stored = recordWithManualContractPrices(stored, values);
      return stored;
    },
    getCompanyProfile: async () => base.company,
    getOfferCompanySettings: async () => base.offerCompany,
    getOfferStructureSettings: async (id) => base.offerStructureSettings[id] ?? { pages: [] } as never,
    loadLogoDataUri: async () => null,
    generatePdf: async (options) => {
      printed.push(options);
      return { uri: `file:///cache/${options.fileName}`, numberOfPages: 2, shared: true };
    },
    now: () => new Date(2026, 9, 29),
  };
  const app = { settings: base.settings, products: base.products, structures: base.structures };
  return { deps, app, printed, current: () => stored };
}

describe('exportTarjousPdf', () => {
  it('assigns a number once, reprint keeps it; file name per plan §10', async () => {
    const { deps, app, printed, current } = setup(record({ name: 'Testi Asiakas' }, { projectName: 'Testi Asiakas' }));
    const first = await exportTarjousPdf('c1', app, deps);
    const again = await exportTarjousPdf('c1', app, deps);
    expect(first.offerNumber).toBe(again.offerNumber);
    expect(current().offerNumber).toBe(first.offerNumber);
    expect(printed[0].fileName).toBe(`Tarjous_${first.offerNumber}_Testi_Asiakas_2026-10-29.pdf`);
    expect(printed[0].html).toContain(`${first.offerNumber}`);
    expect(printed[0].html).toContain('Loppusumma');
  });

  it('blocks PDF generation when a line price is invalid and does not change the calculation', async () => {
    const rec = record(
      { name: 'Testi Asiakas' },
      {
        projectName: 'Testi Asiakas',
        structureLines: [{ ...line('a', 's1', 'Räystäs'), unitPriceVat0: Number.NaN }],
      },
    );
    const { deps, app, printed, current } = setup(rec);
    await expect(exportTarjousPdf('c1', app, deps)).rejects.toThrow(
      'Tarjouksen rivillä Räystäs on virheellinen hinta. Korjaa hinta ennen tulostusta.',
    );
    expect(printed).toHaveLength(0);
    expect(current().offerNumber).toBeUndefined();
    expect(current().structureLines?.[0].unitPriceVat0).toBeNaN();
    expect(current().totalPriceVat).toBe(rec.totalPriceVat);
  });
});

describe('exportUrakkakorttiPdf', () => {
  it('asks for a manual contract when the form was not used, then prints with it', async () => {
    const rec = record({ name: 'Testi' }, { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Ulkomaalaus'), contractPriceVat0: 0 }] });
    const { deps, app, printed, current } = setup(rec);
    const ask = await exportUrakkakorttiPdf('c1', app, deps);
    expect(ask).toEqual({ status: 'needsManualContract', lines: [{ id: 'a', name: 'Ulkomaalaus' }] });
    expect(printed).toHaveLength(0);
    const done = await exportUrakkakorttiPdf('c1', app, deps, { a: 640 });
    expect(done.status).toBe('done');
    expect(current().structureLines?.[0].contractPriceVat0).toBe(640);
    expect(printed[0].fileName).toBe('Urakkakortti_Testi_2026-10-29.pdf');
    expect(printed[0].html).toMatch(/640,00\s€/);
    expect(current().offerNumber).toBeUndefined();
  });

  it('prints directly when contract sums exist; never assigns an offer number', async () => {
    const { deps, app, printed, current } = setup(record({ name: 'Testi' }));
    const spy = jest.spyOn(deps, 'assignOfferNumber');
    const done = await exportUrakkakorttiPdf('c1', app, deps);
    expect(done.status).toBe('done');
    expect(printed).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    expect(current().offerNumber).toBeUndefined();
  });
});
