jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const ids = { n: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    ids.n += 1;
    return `id-${ids.n}`;
  },
}));

jest.mock('../src/core/attachments/attachmentFiles', () => ({
  deleteCalculationAttachmentFolder: jest.fn(),
}));
jest.mock('../src/core/documents/documentFiles', () => ({
  deleteCalculationDocumentFolder: jest.fn(),
}));

type SqlDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
};

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqlDb;
};

function adapt(db: SqlDb) {
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      db.prepare(sql).run(...args);
    },
    getFirstAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  };
}

let current: ReturnType<typeof adapt>;

jest.mock('../src/core/database/connection', () => {
  const actual = jest.requireActual('../src/core/database/connection') as Record<string, unknown>;
  return {
    ...actual,
    getDb: async () => current,
  };
});

import { ensureCalculationStatusColumn } from '../src/core/database/connection';
import {
  beginNewCalculation,
  clearWizardDraft,
  getCalculation,
  getCalculations,
  getWizardDraft,
  saveCalculation,
  saveWizardDraft,
  saveWizardViewSession,
} from '../src/core/database/database';
import type { CalculationRecord, PersistedWizardDraft, StructureLine } from '../src/core/models/types';
import { exportTarjousPdf, type PdfExportDeps } from '../src/core/pdf/exportPdf';
import { patchStructureLine } from '../src/core/structure/applyFormToLine';
import { isDraftCalculation, wizardDraftFromCalculation } from '../src/core/wizard/draftCalculation';
import {
  draftReplacingLine,
  lineFormFinishedLine,
  lineFormInputLine,
  lineFormPreservesInputsOnLeave,
} from '../src/core/wizard/draftSession';
import { calculationToFormState } from '../src/core/wizard/calculationToWizard';
import {
  buildPersistedWizardDraft,
  composerStateSignature,
  decideComposerLeave,
  persistedDraftToFormState,
  shouldKeepResumeDraftOnLeave,
} from '../src/core/wizard/wizardDraftHelpers';
import { isExportBlockedByEditDraft } from '../src/core/history/detailDraftPolicy';
import type { CalculationResult } from '../src/core/calculation/calculationPipeline';
import { formatCustomerAddress } from '../src/core/pdf/siteAddress';
import { input, line, record } from './pdfFixtures';

const V3_SQL = `
CREATE TABLE calculations (
  id TEXT PRIMARY KEY NOT NULL,
  project_name TEXT NOT NULL,
  customer TEXT,
  group_duration_h REAL NOT NULL,
  crew_size INTEGER NOT NULL,
  hourly_rate REAL NOT NULL,
  margin_percent REAL NOT NULL,
  commission_percent REAL NOT NULL,
  contract_price_vat0 REAL NOT NULL,
  materials_vat0 REAL NOT NULL,
  margin_eur REAL NOT NULL,
  commission_eur REAL NOT NULL,
  total_price_vat0 REAL NOT NULL,
  vat_amount REAL NOT NULL,
  total_price_vat REAL NOT NULL,
  work_duration_days REAL NOT NULL,
  created_at INTEGER NOT NULL,
  vat_percent REAL,
  form_snapshot TEXT,
  discount_percent REAL,
  discount_eur REAL,
  total_price_vat_before_discount REAL,
  total_price_vat0_before_discount REAL,
  offer_number INTEGER,
  customer_id TEXT,
  delivery_schedule_text TEXT,
  travel_time_one_way_h REAL,
  structure_lines TEXT
);
CREATE TABLE calculation_lines (
  id TEXT PRIMARY KEY NOT NULL,
  calculation_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price_vat0 REAL NOT NULL,
  quantity REAL NOT NULL,
  line_total_vat0 REAL NOT NULL
);
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL
);
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL
);
CREATE TABLE wizard_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  step INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const formula: CalculationResult = {
  contractPriceVat0: 800,
  materialsVat0: 365,
  marginEur: 2000,
  commissionEur: 237,
  totalPriceVat0: 3223.84,
  vatAmount: 822.08,
  totalPriceVat: 4045.92,
  workDurationDays: 2,
  discountPercent: 5,
  discountEur: 169.68,
  totalPriceVatBeforeDiscount: 4258.47,
  totalPriceVat0BeforeDiscount: 3393.52,
};

function finishedRecord(): CalculationRecord {
  const base = line('l1', 's1', 'Ulkomaalaus');
  const overridden = patchStructureLine(base, { unitPriceVat0: 640, contractPriceVat0: 480 });
  return record({ name: 'Valmis Asiakas' }, {
    id: 'fin-1',
    projectName: 'Valmis Asiakas',
    offerNumber: 10285,
    status: 'complete',
    createdAt: new Date(2026, 10, 1),
    structureLines: [overridden],
  });
}

function draftFrom(row: CalculationRecord): PersistedWizardDraft {
  const { form } = calculationToFormState(row, []);
  return buildPersistedWizardDraft(form, {
    editCalculationId: row.id,
    originalCreatedAt: row.createdAt,
    editFormVersion: row.formSnapshot?.formVersion,
  });
}

function priceSnapshot(row: CalculationRecord) {
  const structure = row.structureLines?.[0];
  return {
    id: row.id,
    status: row.status,
    totalPriceVat: row.totalPriceVat,
    totalPriceVat0: row.totalPriceVat0,
    contractPriceVat0: row.contractPriceVat0,
    materialsVat0: row.materialsVat0,
    offerNumber: row.offerNumber,
    line: structure
      ? {
          unitPriceVat0: structure.unitPriceVat0,
          materialsVat0: structure.materialsVat0,
          contractPriceVat0: structure.contractPriceVat0,
          discountPercent: structure.discountPercent,
          overrides: [...(structure.overrides ?? [])].sort(),
          fieldValues: structure.fieldValues,
          formFilled: structure.formFilled,
        }
      : null,
  };
}

async function seedFinished(): Promise<CalculationRecord> {
  await saveCalculation(finishedRecord());
  await current.runAsync('UPDATE calculations SET offer_number = 10285 WHERE id = ?', 'fin-1');
  return (await getCalculation('fin-1')) as CalculationRecord;
}

async function exportOffer(id: string) {
  const base = input(record({ name: 'Valmis Asiakas' }));
  const deps: PdfExportDeps = {
    getCalculation: (calcId) => getCalculation(calcId),
    assignOfferNumber: async () => ({ offerNumber: 10285, nextOfferNumber: 10286, assigned: false }),
    saveManualContractPrices: async () => {
      throw new Error('manuaalihintoja ei tarvita');
    },
    saveCalculation: async () => undefined,
    getCompanyProfile: async () => base.company,
    getOfferCompanySettings: async () => base.offerCompany,
    getOfferStructureSettings: async (structureId) =>
      base.offerStructureSettings[structureId] ?? { additionalInfoText: '', offerPages: [] },
    loadLogoDataUri: async () => null,
    generatePdf: async () => ({
      uri: 'file:///tmp/tarjous.pdf',
      relativePath: 'documents/tarjous.pdf',
      numberOfPages: 1,
      fileName: 'tarjous.pdf',
      warnings: [],
    }),
    newDocumentId: () => 'doc-lifecycle',
    appVersion: () => '1.3.4',
    insertDocument: async (doc) => doc,
    removeStoredPdf: () => undefined,
    now: () => new Date(2026, 10, 7),
  };
  return exportTarjousPdf(id, { settings: base.settings, products: [], structures: base.structures }, deps);
}

describe('v1.3.4 calculation lifecycle', () => {
  beforeEach(async () => {
    ids.n = 0;
    current = adapt(new DatabaseSync(':memory:'));
    await current.execAsync(V3_SQL);
    await ensureCalculationStatusColumn(current);
  });

  it('keeps a completed calculation completed when a line and customer screen are opened and left', async () => {
    const stored = await seedFinished();
    const before = priceSnapshot(stored);
    const opened = draftFrom(stored as CalculationRecord);

    await saveWizardViewSession(opened);
    await saveWizardViewSession(opened);
    expect(await getCalculations()).toHaveLength(1);
    expect(priceSnapshot((await getCalculation('fin-1')) as CalculationRecord)).toEqual(before);
    expect(isExportBlockedByEditDraft(await getWizardDraft(), 'fin-1')).toBe(true);

    const appliedSignature = composerStateSignature(calculationToFormState(stored as CalculationRecord, []).form);
    expect(
      decideComposerLeave({
        allowExit: false,
        dirty: false,
        hasContent: true,
        keepResume: shouldKeepResumeDraftOnLeave({
          resumedIncompleteDraft: false,
          currentSignature: appliedSignature,
          originSignature: appliedSignature,
        }),
        hasSession: true,
      }),
    ).toBe('clear-and-leave');
    await clearWizardDraft();

    const after = (await getCalculation('fin-1')) as CalculationRecord;
    expect(priceSnapshot(after)).toEqual(before);
    expect(isDraftCalculation(after)).toBe(false);
    expect(isExportBlockedByEditDraft(await getWizardDraft(), 'fin-1')).toBe(false);
    const exported = await exportOffer('fin-1');
    expect(exported.kind).toBe('tarjous');
    expect(exported.offerNumber).toBe(10285);
  });

  it('does not demote a completed calculation when the open session has extra material rows', async () => {
    const stored = await seedFinished();
    const before = priceSnapshot(stored);
    const view = draftFrom(stored);
    const lineWithPrefill: StructureLine = {
      ...(view.structureLines?.[0] as StructureLine),
      materialQuantities: [
        { id: 'mq', productName: 'Nova 7', quantity: 0, source: 'manual', shades: [{ id: 'g', name: 'G47', quantity: 3, unit: 'l' }] },
      ],
    };
    await saveWizardViewSession({ ...view, structureLines: [lineWithPrefill] });
    await beginNewCalculation();
    const after = (await getCalculation('fin-1')) as CalculationRecord;
    expect(priceSnapshot(after)).toEqual(before);
    expect(after.structureLines?.[0].materialQuantities).toBeUndefined();
    expect(await getWizardDraft()).toBeNull();
    expect(await getCalculations()).toHaveLength(1);
  });

  it('keeps the completed row when the customer screen saves without a change', async () => {
    const stored = await seedFinished();
    const before = priceSnapshot(stored);
    await saveWizardViewSession(draftFrom(stored));
    const session = (await getWizardDraft()) as PersistedWizardDraft;
    const { form } = persistedDraftToFormState(session, []);
    const siteTouched = form.siteAddressTouched === true;
    const rebuilt = buildPersistedWizardDraft(
      {
        ...form,
        siteAddress: siteTouched
          ? (form.siteAddress ?? '')
          : formatCustomerAddress({
              address: form.customerAddress,
              postalCode: form.customerPostalCode,
              postalLocality: form.customerPostalLocality,
            }),
        siteAddressTouched: siteTouched,
      },
      {
        editCalculationId: stored.id,
        originalCreatedAt: session.originalCreatedAt,
        editFormVersion: session.editFormVersion,
      },
      session,
    );
    await saveWizardDraft(rebuilt);
    expect(priceSnapshot((await getCalculation('fin-1')) as CalculationRecord)).toEqual(before);
    expect(await getCalculations()).toHaveLength(1);
  });

  it('turns a real edit into a draft on the same id and blocks PDF until it is finished again', async () => {
    const stored = await seedFinished();
    const prices = priceSnapshot(stored);
    const edited = draftFrom(stored);
    edited.customerName = 'Muokattu Asiakas';
    await saveWizardDraft(edited);
    await saveWizardDraft({ ...edited, customerPhone: '0401111111', updatedAt: Date.now() });

    const rows = await getCalculations();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('fin-1');
    expect(rows[0]?.status).toBe('draft');
    expect(rows[0]?.offerNumber).toBe(10285);
    expect(rows[0]?.totalPriceVat).toBe(prices.totalPriceVat);
    expect(rows[0]?.totalPriceVat0).toBe(prices.totalPriceVat0);
    expect(rows[0]?.projectName).toBe('Muokattu Asiakas');
    const snapshotDraft = rows[0] ? wizardDraftFromCalculation(rows[0]) : null;
    expect(snapshotDraft?.completedRecordJson).toBeUndefined();
    expect(snapshotDraft?.preserveCompleted).toBeUndefined();
    expect((await getWizardDraft())?.completedRecordJson).toEqual(expect.any(String));
    await expect(exportOffer('fin-1')).rejects.toThrow('Keskeneräisestä laskelmasta ei voi tehdä dokumenttia.');
  });

  it('saves line-form back and background inputs without refreshing prices, and discard restores the completed row', async () => {
    expect(lineFormPreservesInputsOnLeave('back')).toBe('prompt');
    expect(lineFormPreservesInputsOnLeave('background')).toBe('save-inputs');
    const stored = await seedFinished();
    const before = priceSnapshot(stored);
    await saveWizardViewSession(draftFrom(stored));
    const session = await getWizardDraft();
    const openedLine = session?.structureLines?.[0];
    expect(openedLine?.overrides).toEqual(expect.arrayContaining(['unitPrice', 'contractPrice']));
    expect(openedLine).toBeDefined();

    const inputs = lineFormInputLine(openedLine as StructureLine, {
      ...(openedLine as StructureLine).fieldValues,
      kiintea_seinapinta_ala_m2: '80',
    });
    expect(inputs.unitPriceVat0).toBe(640);
    expect(inputs.contractPriceVat0).toBe(480);
    expect(inputs.formFilled).toBe(false);
    expect(inputs.overrides).toEqual(expect.arrayContaining(['unitPrice', 'contractPrice']));
    await saveWizardDraft(draftReplacingLine(session as PersistedWizardDraft, [], inputs, 'fin-1'));

    const drafted = (await getCalculation('fin-1')) as CalculationRecord;
    expect(drafted.status).toBe('draft');
    expect(drafted.id).toBe('fin-1');
    expect(await getCalculations()).toHaveLength(1);
    expect(drafted.totalPriceVat).toBe(before.totalPriceVat);
    expect(drafted.structureLines?.[0].unitPriceVat0).toBe(640);
    expect(drafted.structureLines?.[0].contractPriceVat0).toBe(480);
    expect(drafted.structureLines?.[0].fieldValues.kiintea_seinapinta_ala_m2).toBe('80');
    expect(drafted.structureLines?.[0].overrides).toEqual(expect.arrayContaining(['unitPrice', 'contractPrice']));
    expect(drafted.structureLines?.[0].unitPriceVat0).not.toBe(formula.totalPriceVat0BeforeDiscount);

    const afterEdit = await getWizardDraft();
    await saveWizardDraft(
      draftReplacingLine(afterEdit as PersistedWizardDraft, [], openedLine as StructureLine, 'fin-1'),
    );
    await clearWizardDraft();
    const restored = (await getCalculation('fin-1')) as CalculationRecord;
    expect(priceSnapshot(restored)).toEqual(before);
    expect(isDraftCalculation(restored)).toBe(false);
    const exported = await exportOffer('fin-1');
    expect(exported.kind).toBe('tarjous');
  });

  it('commits formula prices only when Valmis refreshes them, and keeps overrides when it does not', async () => {
    const stored = await seedFinished();
    await saveWizardViewSession(draftFrom(stored));
    const session = (await getWizardDraft()) as PersistedWizardDraft;
    const openedLine = session.structureLines?.[0] as StructureLine;
    const values = { ...openedLine.fieldValues, kiintea_seinapinta_ala_m2: '90' };

    const kept = lineFormFinishedLine(openedLine, formula, values, 5, false);
    expect(kept.unitPriceVat0).toBe(640);
    expect(kept.contractPriceVat0).toBe(480);
    expect(kept.overrides).toEqual(expect.arrayContaining(['unitPrice', 'contractPrice']));
    expect(kept.formFilled).toBe(true);
    expect(kept.fieldValues.kiintea_seinapinta_ala_m2).toBe('90');
    expect(kept.priceRefreshed).toBeUndefined();
    await saveWizardDraft(draftReplacingLine(session, [], kept, 'fin-1'));
    const keptRow = (await getCalculation('fin-1')) as CalculationRecord;
    expect(keptRow.status).toBe('draft');
    expect(keptRow.structureLines?.[0].unitPriceVat0).toBe(640);
    expect(keptRow.structureLines?.[0].contractPriceVat0).toBe(480);
    expect(keptRow.structureLines?.[0].overrides).toEqual(expect.arrayContaining(['unitPrice', 'contractPrice']));
    expect(keptRow.totalPriceVat).toBe(stored.totalPriceVat);

    const refreshed = lineFormFinishedLine(openedLine, formula, values, 5, true);
    expect(refreshed.unitPriceVat0).toBe(formula.totalPriceVat0BeforeDiscount);
    expect(refreshed.contractPriceVat0).toBe(formula.contractPriceVat0);
    expect(refreshed.overrides ?? []).not.toContain('unitPrice');
    expect(refreshed.overrides ?? []).not.toContain('contractPrice');
    expect(refreshed.priceRefreshed).toBe(true);
    const refreshedSession = (await getWizardDraft()) as PersistedWizardDraft;
    await saveWizardDraft(draftReplacingLine(refreshedSession, [], refreshed, 'fin-1'));
    const refreshedRow = (await getCalculation('fin-1')) as CalculationRecord;
    expect(await getCalculations()).toHaveLength(1);
    expect(refreshedRow.id).toBe('fin-1');
    expect(refreshedRow.status).toBe('draft');
    expect(refreshedRow.structureLines?.[0].unitPriceVat0).toBe(3393.52);
    expect(refreshedRow.structureLines?.[0].contractPriceVat0).toBe(800);
    expect(refreshedRow.structureLines?.[0].overrides ?? []).not.toContain('unitPrice');
    expect(refreshedRow.structureLines?.[0].overrides ?? []).not.toContain('contractPrice');
  });

  function clearedDraft(id?: string): PersistedWizardDraft {
    return {
      step: 0,
      customerName: '',
      customerType: 'private',
      reverseVat: false,
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      customerPostalCode: '',
      customerPostalLocality: '',
      customerNotes: '',
      duration: '',
      lines: [],
      structureLines: [],
      fieldValues: {},
      updatedAt: Date.now(),
      ...(id ? { editCalculationId: id } : {}),
      siteAddress: '',
      siteAddressTouched: false,
    };
  }

  it('does not create a history row for an empty new calculation or wipe a completed row without an edit', async () => {
    await saveWizardDraft(clearedDraft());
    expect(await getCalculations()).toHaveLength(0);
    expect(await getWizardDraft()).toBeNull();

    const before = priceSnapshot(await seedFinished());
    await saveWizardDraft(clearedDraft('fin-1'));
    expect(priceSnapshot((await getCalculation('fin-1')) as CalculationRecord)).toEqual(before);
    expect(isDraftCalculation(await getCalculation('fin-1'))).toBe(false);
    expect(await getWizardDraft()).toBeNull();
    expect(await getCalculations()).toHaveLength(1);
  });

  it('persists a cleared draft on the same id so the old fields do not return', async () => {
    const stored = await seedFinished();
    await saveWizardDraft({ ...draftFrom(stored), customerPhone: '0401111111', updatedAt: 20 });
    const before = priceSnapshot((await getCalculation('fin-1')) as CalculationRecord);
    expect(before.status).toBe('draft');

    await saveWizardDraft(clearedDraft('fin-1'));
    const row = (await getCalculation('fin-1')) as CalculationRecord;
    expect(await getCalculations()).toHaveLength(1);
    expect(row.id).toBe('fin-1');
    expect(row.status).toBe('draft');
    expect(row.totalPriceVat).toBe(before.totalPriceVat);
    expect(row.offerNumber).toBe(10285);
    expect(wizardDraftFromCalculation(row)?.customerName).toBe('');
    expect(wizardDraftFromCalculation(row)?.customerPhone).toBe('');
    expect(wizardDraftFromCalculation(row)?.structureLines ?? []).toEqual([]);
    expect((await getWizardDraft())?.customerName).toBe('');
    expect((await getWizardDraft())?.customerPhone).toBe('');

    const reopened = persistedDraftToFormState(wizardDraftFromCalculation(row) as PersistedWizardDraft, []).form;
    expect(reopened.customerName).toBe('');
    expect(reopened.customerPhone).toBe('');
    expect(reopened.structureLines ?? []).toEqual([]);
  });

  it('demotes a completed calculation only when the clear is a real edit and keeps its prices', async () => {
    const stored = await seedFinished();
    const before = priceSnapshot(stored);
    await saveWizardViewSession(draftFrom(stored));
    expect(isDraftCalculation(await getCalculation('fin-1'))).toBe(false);

    await saveWizardDraft({ ...clearedDraft('fin-1'), updatedAt: 30 });
    const row = (await getCalculation('fin-1')) as CalculationRecord;
    expect(await getCalculations()).toHaveLength(1);
    expect(row.status).toBe('draft');
    expect(row.totalPriceVat).toBe(before.totalPriceVat);
    expect(row.totalPriceVat0).toBe(before.totalPriceVat0);
    expect(row.offerNumber).toBe(10285);
    expect(wizardDraftFromCalculation(row)?.customerName).toBe('');
    await expect(exportOffer('fin-1')).rejects.toThrow('Keskeneräisestä laskelmasta ei voi tehdä dokumenttia.');
  });
});
