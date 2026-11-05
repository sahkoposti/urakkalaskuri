import { exportTarjousPdf, exportUrakkakorttiPdf, type PdfExportDeps } from '../src/core/pdf/exportPdf';
import { assignOfferNumber } from '../src/core/pdf/offerNumber';
import { recordWithManualContractPrices } from '../src/core/pdf/manualContract';
import type { Attachment } from '../src/core/attachments/types';
import type { GeneratePdfOptions } from '../src/core/pdf/generatePdf';
import type { NewDocumentInput } from '../src/core/documents/types';
import type { CalculationRecord } from '../src/core/models/types';
import {
  calculationWithUrakkakorttiHidePrices,
  calculationWithUrakkakorttiMode,
  calculationWithUrakkakorttiRivihinnat,
} from '../src/core/pdf/urakkakorttiCard';
import { input, line, record } from './pdfFixtures';

function setup(rec: CalculationRecord) {
  let stored: CalculationRecord = rec;
  let next: number | undefined;
  const printed: GeneratePdfOptions[] = [];
  const inserted: NewDocumentInput[] = [];
  const removed: string[] = [];
  let documentSeq = 0;
  let failInsert = false;
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
    saveCalculation: async (next) => {
      stored = next;
    },
    getCompanyProfile: async () => base.company,
    getOfferCompanySettings: async () => base.offerCompany,
    getOfferStructureSettings: async (id) => base.offerStructureSettings[id] ?? { pages: [] } as never,
    loadLogoDataUri: async () => null,
    generatePdf: async (options) => {
      printed.push(options);
      return {
        uri: `file:///docs/documents/c1/${options.documentId}.pdf`,
        relativePath: `documents/c1/${options.documentId}.pdf`,
        numberOfPages: 2,
        fileName: options.fileName,
        warnings: [],
      };
    },
    newDocumentId: () => `doc-${++documentSeq}`,
    appVersion: () => '0.0.0-test',
    insertDocument: async (row) => {
      if (failInsert) throw new Error('Dokumentin tallennus epäonnistui.');
      inserted.push(row);
      return row;
    },
    removeStoredPdf: (path) => {
      removed.push(path);
    },
    now: () => new Date(2026, 9, 29),
  };
  const app = { settings: base.settings, products: base.products, structures: base.structures };
  return {
    deps,
    app,
    printed,
    inserted,
    removed,
    failInsert: () => {
      failInsert = true;
    },
    current: () => stored,
  };
}

describe('exportTarjousPdf', () => {
  it('assigns a number once, reprint keeps it; file name per plan §10', async () => {
    const { deps, app, printed, current, inserted } = setup(record({ name: 'Testi Asiakas' }, { projectName: 'Testi Asiakas' }));
    const first = await exportTarjousPdf('c1', app, deps);
    const again = await exportTarjousPdf('c1', app, deps);
    expect(first.offerNumber).toBe(again.offerNumber);
    expect(current().offerNumber).toBe(first.offerNumber);
    expect(printed[0].fileName).toBe(`Tarjous_${first.offerNumber}_Testi_Asiakas_2026-10-29.pdf`);
    expect(printed[0].html).toContain(`${first.offerNumber}`);
    expect(printed[0].html).toContain('Yhteensä sis. alv');
    expect(printed[0]).not.toHaveProperty('share');
    expect(first).toMatchObject({
      kind: 'tarjous',
      offerNumber: first.offerNumber,
      fileName: printed[0].fileName,
      numberOfPages: 2,
      id: 'doc-1',
    });
    expect(inserted[0]?.summary.pages).toBe(2);
    expect(inserted[0]?.offerNumber).toBe(first.offerNumber);
    expect(inserted[0]?.inputs).toMatchObject({ ktvPageIncluded: true });
    expect(first.warnings).toEqual([]);
  });

  it('passes offer attachments to generatePdf and leaves an empty section out of the html', async () => {
    const { deps, app, printed } = setup(record({ name: 'Testi Asiakas' }));
    const items: Attachment[] = [
      {
        id: 'img-1',
        calculationId: 'c1',
        kind: 'image',
        destination: 'offer',
        caption: 'Julkisivu',
        fileRelPath: 'attachments/c1/img-1.jpg',
        mime: 'image/jpeg',
        sizeBytes: 10,
        width: 10,
        height: 10,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    deps.listAttachments = async () => items;
    await exportTarjousPdf('c1', app, deps);
    expect(printed[0].html).toBe('');
    expect(printed[0].attachments).toEqual({ items, target: 'offer' });
    const empty = printed[0].composeHtml?.('') ?? '';
    expect(empty).toContain('Tarjous / sopimus');
    expect(empty).not.toContain('class="liitteet');
    expect(printed[0].composeHtml?.('<section class="liitteet page-break">x</section>')).toContain(
      'class="liitteet page-break"',
    );
  });

  it('removes the saved file when the document row cannot be inserted and does not share', async () => {
    const { deps, app, printed, removed, failInsert } = setup(record({ name: 'Testi Asiakas' }));
    failInsert();
    await expect(exportTarjousPdf('c1', app, deps)).rejects.toThrow('Dokumentin tallennus epäonnistui.');
    expect(printed).toHaveLength(1);
    expect(removed).toEqual([`documents/c1/${printed[0].documentId}.pdf`]);
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

  it('throws before PDF when Työntekijä has an invalid contract and leaves the calculation', async () => {
    const rec = calculationWithUrakkakorttiMode(
      record({ name: 'Testi' }, { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Räystäs'), contractPriceVat0: Number.NaN }] }),
      'tyontekija',
    );
    const { deps, app, printed, current } = setup(rec);
    await expect(exportUrakkakorttiPdf('c1', app, deps)).rejects.toThrow(
      'Urakkakortin rivillä Räystäs on virheellinen tai negatiivinen urakkahinta. Korjaa hinta ennen tulostusta.',
    );
    expect(printed).toHaveLength(0);
    expect(current().structureLines?.[0].contractPriceVat0).toBeNaN();
    expect(current().offerNumber).toBeUndefined();
  });

  it('writes a manual price onto an existing override and leaves the offer totals unchanged', async () => {
    const rec = calculationWithUrakkakorttiRivihinnat(
      record(
        { name: 'Testi' },
        { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Räystäs'), contractPriceVat0: 0 }] },
      ),
      { a: 0 },
    );
    const { deps, app, printed, current } = setup(rec);
    const ask = await exportUrakkakorttiPdf('c1', app, deps);
    expect(ask).toEqual({ status: 'needsManualContract', lines: [{ id: 'a', name: 'Räystäs' }] });
    const done = await exportUrakkakorttiPdf('c1', app, deps, { a: 640 });
    expect(done.status).toBe('done');
    expect(current().formSnapshot?.urakkakorttiRivihinnat).toEqual({ a: 640 });
    expect(current().structureLines?.[0].contractPriceVat0).toBe(0);
    expect(current().totalPriceVat).toBe(rec.totalPriceVat);
    expect(current().marginEur).toBe(rec.marginEur);
    expect(printed[0].html).toMatch(/640,00\s€/);
  });

  it('asks again when a Työntekijä override is zero and then divides the entered override', async () => {
    const rec = calculationWithUrakkakorttiMode(
      calculationWithUrakkakorttiRivihinnat(
        record(
          { name: 'Testi' },
          { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Räystäs'), contractPriceVat0: 900 }] },
        ),
        { a: 0 },
      ),
      'tyontekija',
    );
    const { deps, app, printed, current } = setup(rec);
    const ask = await exportUrakkakorttiPdf('c1', app, deps);
    expect(ask.status).toBe('needsManualContract');
    const done = await exportUrakkakorttiPdf('c1', app, deps, { a: 3000 });
    expect(done.status).toBe('done');
    expect(current().structureLines?.[0].contractPriceVat0).toBe(900);
    expect(current().totalPriceVat).toBe(rec.totalPriceVat);
    expect(printed[0].html).toMatch(/2\s000,00\s€/);
    expect(printed[0].html).not.toMatch(/kerroin/i);
  });

  it('does not ask for a manual contract or block an invalid Työntekijä price when prices are hidden', async () => {
    const rec = calculationWithUrakkakorttiHidePrices(
      calculationWithUrakkakorttiMode(
        record(
          { name: 'Testi' },
          { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Räystäs'), contractPriceVat0: Number.NaN }] },
        ),
        'tyontekija',
      ),
      true,
    );
    const { deps, app, printed, current } = setup(rec);
    const done = await exportUrakkakorttiPdf('c1', app, deps);
    expect(done.status).toBe('done');
    expect(printed).toHaveLength(1);
    expect(printed[0].html).not.toContain('Urakka (alv0)');
    expect(printed[0].html).not.toContain('Urakka:');
    expect(current().structureLines?.[0].contractPriceVat0).toBeNaN();
    expect(current().totalPriceVat).toBe(rec.totalPriceVat);
  });

  it('asks for a manual contract when Työntekijä price is zero, same as Alihankkija', async () => {
    const rec = calculationWithUrakkakorttiMode(
      record({ name: 'Testi' }, { projectName: 'Testi', structureLines: [{ ...line('a', 's1', 'Räystäs'), contractPriceVat0: 0 }] }),
      'tyontekija',
    );
    const { deps, app, printed } = setup(rec);
    const ask = await exportUrakkakorttiPdf('c1', app, deps);
    expect(ask).toEqual({ status: 'needsManualContract', lines: [{ id: 'a', name: 'Räystäs' }] });
    expect(printed).toHaveLength(0);
  });

  it('prints directly when contract sums exist; never assigns an offer number', async () => {
    const { deps, app, printed, current, inserted } = setup(record({ name: 'Testi' }));
    const spy = jest.spyOn(deps, 'assignOfferNumber');
    const done = await exportUrakkakorttiPdf('c1', app, deps);
    expect(done.status).toBe('done');
    expect(printed).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    expect(current().offerNumber).toBeUndefined();
    expect(done).toMatchObject({ status: 'done', kind: 'urakkakortti', offerNumber: null });
    expect(inserted[0]?.offerNumber).toBeNull();
    expect(printed[0].html).toContain('Sisältää telineet.');
    expect(printed[0].html).toContain('>Muuta<');
    expect(printed[0].html).not.toContain('Lisätiedot:');
  });

  it('passes card attachments to generatePdf', async () => {
    const { deps, app, printed } = setup(record({ name: 'Testi' }));
    deps.listAttachments = async () => [];
    await exportUrakkakorttiPdf('c1', app, deps);
    expect(printed[0].attachments).toEqual({ items: [], target: 'card' });
    const empty = printed[0].composeHtml?.('') ?? '';
    expect(empty).toContain('Urakkakortti');
    expect(empty).not.toContain('class="liitteet');
  });
});
