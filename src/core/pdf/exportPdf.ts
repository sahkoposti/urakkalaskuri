import { readAttachmentPageLayout } from '../attachments/attachmentPageLayout';
import type { Attachment } from '../attachments/types';
import type { AttachmentPdfDeps } from '../attachments/prepareAttachmentPrint';
import type { CompanyProfile } from '../company/types';
import type { AppSettings, CalculationRecord, Product } from '../models/types';
import { customerFromRecord } from '../models/types';
import type { ProductStructure } from '../structure/types';
import { ensureStructureLines } from '../structure/legacyCalculation';
import { buildPdfContext } from './buildPdfContext';
import { commitStoredDocument } from '../documents/commitStoredDocument';
import {
  documentSummary,
  tarjousDocumentInputs,
  tarjousDocumentTotal,
  urakkakorttiDocumentInputs,
  urakkakorttiDocumentTotal,
} from '../documents/documentInputs';
import type { ExportedDocument, NewDocumentInput } from '../documents/types';
import type { GeneratePdfOptions, GeneratePdfResult } from './generatePdf';
import {
  calculationWithUrakkakorttiRivihinnat,
  cardLinesNeedingManualContract,
  readUrakkakorttiHidePrices,
  readUrakkakorttiRivihinnat,
  urakkakorttiContractProblems,
} from './urakkakorttiCard';
import { offerDocumentProblems } from './offerDocument';
import type { OfferNumberAssignment } from './offerNumber';
import type { OfferCompanySettings, OfferStructureSettings } from './types';
import { buildPdfFileName } from './pdfFileName';
import { renderTarjousHtml } from './renderTarjousHtml';
import { renderUrakkakorttiHtml } from './renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from './urakkakortti';

/** Sovelluksen muistissa olevat tiedot (AppContext). */
export type PdfAppData = {
  settings: AppSettings;
  products: Product[];
  structures: ProductStructure[];
};

/** Ulkoiset riippuvuudet: oikeat toteutukset pdfExportDeps.ts:ssä, testeissä väärennökset. */
export type PdfExportDeps = {
  getCalculation: (id: string) => Promise<CalculationRecord | null>;
  assignOfferNumber: (id: string) => Promise<OfferNumberAssignment>;
  saveManualContractPrices: (id: string, values: Record<string, number>) => Promise<CalculationRecord>;
  saveCalculation: (record: CalculationRecord) => Promise<void>;
  getCompanyProfile: () => Promise<CompanyProfile>;
  getOfferCompanySettings: () => Promise<OfferCompanySettings>;
  getOfferStructureSettings: (structureId: string) => Promise<OfferStructureSettings>;
  loadLogoDataUri: () => Promise<string | null>;
  generatePdf: (options: GeneratePdfOptions) => Promise<GeneratePdfResult>;
  newDocumentId: () => string;
  appVersion: () => string | null;
  insertDocument: (input: NewDocumentInput) => Promise<unknown>;
  removeStoredPdf: (relativePath: string) => void;
  now: () => Date;
  /** Puuttuu testeissä ja vanhassa kutsussa: tuloste ilman liitteitä. */
  listAttachments?: (calculationId: string) => Promise<Attachment[]>;
  attachmentPdfDeps?: AttachmentPdfDeps;
};

async function storeExportedPdf(
  deps: PdfExportDeps,
  input: {
    calculationId: string;
    kind: ExportedDocument['kind'];
    offerNumber: number | null;
    html: string;
    fileName: string;
    inputs: NewDocumentInput['inputs'];
    total: number | null;
    createdAt: string;
    attachments?: GeneratePdfOptions['attachments'];
    composeHtml?: GeneratePdfOptions['composeHtml'];
    attachmentDeps?: GeneratePdfOptions['attachmentDeps'];
  },
): Promise<ExportedDocument> {
  const id = deps.newDocumentId();
  const placed = await deps.generatePdf({
    html: input.html,
    fileName: input.fileName,
    calculationId: input.calculationId,
    documentId: id,
    ...(input.attachments
      ? {
          attachments: input.attachments,
          composeHtml: input.composeHtml,
          attachmentDeps: input.attachmentDeps,
        }
      : {}),
  });
  await commitStoredDocument(
    placed.relativePath,
    () =>
      deps.insertDocument({
        id,
        calculationId: input.calculationId,
        kind: input.kind,
        offerNumber: input.offerNumber,
        fileRelPath: placed.relativePath,
        fileName: input.fileName,
        inputs: input.inputs,
        summary: documentSummary(input.total, placed.numberOfPages),
        appVersion: deps.appVersion(),
        createdAt: input.createdAt,
      }),
    deps.removeStoredPdf,
  );
  return {
    id,
    path: placed.uri,
    fileName: input.fileName,
    numberOfPages: placed.numberOfPages,
    kind: input.kind,
    offerNumber: input.offerNumber,
    warnings: placed.warnings ?? [],
  };
}

async function listedAttachments(deps: PdfExportDeps, calculationId: string): Promise<Attachment[] | null> {
  if (!deps.listAttachments) return null;
  return deps.listAttachments(calculationId);
}

async function requireCalculation(deps: PdfExportDeps, id: string): Promise<CalculationRecord> {
  const record = await deps.getCalculation(id);
  if (!record) throw new Error('Laskelmaa ei löytynyt.');
  return record;
}

/**
 * Tarjous: numero myönnetään ensin (uusintatulostus = sama numero), sitten konteksti → HTML → PDF → jako.
 * Tuplanapautus on estetty sekä painikkeessa että tietokannan lukolla.
 */
export async function exportTarjousPdf(
  calculationId: string,
  app: PdfAppData,
  deps: PdfExportDeps,
): Promise<ExportedDocument> {
  const existing = await requireCalculation(deps, calculationId);
  const problems = offerDocumentProblems(existing);
  if (problems.length > 0) {
    throw new Error(problems.join('\n'));
  }
  const { offerNumber } = await deps.assignOfferNumber(calculationId);
  const record = await requireCalculation(deps, calculationId);
  const [company, offerCompany, logoDataUri] = await Promise.all([
    deps.getCompanyProfile(),
    deps.getOfferCompanySettings(),
    deps.loadLogoDataUri(),
  ]);
  const structureIds = [...new Set(ensureStructureLines(record).map((line) => line.structureId))];
  const offerStructureSettings = Object.fromEntries(
    await Promise.all(structureIds.map(async (id) => [id, await deps.getOfferStructureSettings(id)] as const)),
  );
  const generatedAt = deps.now();
  const ctx = buildPdfContext({
    record,
    company,
    offerCompany,
    offerStructureSettings,
    structures: app.structures,
    products: app.products,
    settings: app.settings,
    generatedAt,
    offerNumber,
  });
  const items = await listedAttachments(deps, calculationId);
  const renderOffer = (sectionHtml: string) =>
    renderTarjousHtml(ctx, {
      logoDataUri,
      accentColor: app.settings.theme?.accentColor,
      ...(sectionHtml ? { attachmentHtml: sectionHtml } : {}),
    });
  const fileName = buildPdfFileName({ kind: 'Tarjous', customerName: customerFromRecord(record).name, date: generatedAt, offerNumber });
  return storeExportedPdf(deps, {
    calculationId,
    kind: 'tarjous',
    offerNumber,
    html: items ? '' : renderOffer(''),
    fileName,
    inputs: tarjousDocumentInputs(record, offerCompany.offerValidDays),
    total: tarjousDocumentTotal(record),
    createdAt: generatedAt.toISOString(),
    ...(items
      ? {
          attachments: {
            items,
            target: 'offer' as const,
            layout: readAttachmentPageLayout(record.formSnapshot),
          },
          composeHtml: renderOffer,
          attachmentDeps: deps.attachmentPdfDeps,
        }
      : {}),
  });
}

/**
 * Käsin syötetty hinta: rivillä jo oleva yliajo päivitetään yliajoksi (tarjouksen summat eivät muutu).
 * Ilman yliajoa hinta kirjoitetaan rivin contractPriceVat0-kenttään kuten ennen.
 */
async function applyCardManualPrices(
  deps: PdfExportDeps,
  calculationId: string,
  values: Record<string, number>,
): Promise<CalculationRecord> {
  const existing = await requireCalculation(deps, calculationId);
  const current = readUrakkakorttiRivihinnat(existing.formSnapshot) ?? {};
  const contract: Record<string, number> = {};
  const overrides = { ...current };
  let overrideChanged = false;
  for (const [lineId, value] of Object.entries(values)) {
    if (Object.prototype.hasOwnProperty.call(current, lineId)) {
      overrides[lineId] = value;
      overrideChanged = true;
    } else {
      contract[lineId] = value;
    }
  }
  let record = existing;
  if (overrideChanged) {
    record = calculationWithUrakkakorttiRivihinnat(existing, overrides);
    await deps.saveCalculation(record);
  }
  if (Object.keys(contract).length > 0) {
    record = await deps.saveManualContractPrices(calculationId, contract);
  }
  return record;
}

export type UrakkakorttiExportResult =
  | { status: 'needsManualContract'; lines: { id: string; name: string }[] }
  | ({ status: 'done' } & ExportedDocument);

/**
 * Urakkakortti: ei tarjousnumeroa. Jos jollakin rivillä ei ole urakkaa (lomaketta ei käytetty),
 * palauttaa needsManualContract → käyttöliittymä kysyy summat ja kutsuu uudelleen manualValues-arvoilla.
 */
export async function exportUrakkakorttiPdf(
  calculationId: string,
  app: PdfAppData,
  deps: PdfExportDeps,
  manualValues?: Record<string, number>,
): Promise<UrakkakorttiExportResult> {
  const record =
    manualValues && Object.keys(manualValues).length > 0
      ? await applyCardManualPrices(deps, calculationId, manualValues)
      : await requireCalculation(deps, calculationId);
  const hidePrices = readUrakkakorttiHidePrices(record.formSnapshot);
  const contractProblems = hidePrices ? [] : urakkakorttiContractProblems(record);
  if (contractProblems.length > 0) {
    throw new Error(contractProblems.join('\n'));
  }
  const missing = cardLinesNeedingManualContract(record);
  if (missing.length > 0) {
    return { status: 'needsManualContract', lines: missing.map((line) => ({ id: line.id, name: line.name })) };
  }
  const [company, logoDataUri, offerCompany] = await Promise.all([
    deps.getCompanyProfile(),
    deps.loadLogoDataUri(),
    deps.getOfferCompanySettings(),
  ]);
  const structureIds = [...new Set(ensureStructureLines(record).map((line) => line.structureId))];
  const offerStructureSettings = Object.fromEntries(
    await Promise.all(structureIds.map(async (id) => [id, await deps.getOfferStructureSettings(id)] as const)),
  );
  const generatedAt = deps.now();
  const ctx = buildUrakkakorttiContext({
    record,
    company,
    structures: app.structures,
    products: app.products,
    settings: app.settings,
    generatedAt,
    sivukulukerroin: offerCompany.sivukulukerroin,
    additionalInfo: offerCompany.additionalInfoText,
    offerStructureSettings,
  });
  const items = await listedAttachments(deps, calculationId);
  const renderCard = (sectionHtml: string) =>
    renderUrakkakorttiHtml(ctx, {
      logoDataUri,
      accentColor: app.settings.theme?.accentColor,
      ...(sectionHtml ? { attachmentHtml: sectionHtml } : {}),
    });
  const fileName = buildPdfFileName({ kind: 'Urakkakortti', customerName: customerFromRecord(record).name, date: generatedAt });
  const document = await storeExportedPdf(deps, {
    calculationId,
    kind: 'urakkakortti',
    offerNumber: null,
    html: items ? '' : renderCard(''),
    fileName,
    inputs: urakkakorttiDocumentInputs(record),
    total: urakkakorttiDocumentTotal(record, offerCompany.sivukulukerroin),
    createdAt: generatedAt.toISOString(),
    ...(items
      ? {
          attachments: {
            items,
            target: 'card' as const,
            layout: 'card_grid' as const,
          },
          composeHtml: renderCard,
          attachmentDeps: deps.attachmentPdfDeps,
        }
      : {}),
  });
  return { status: 'done', ...document };
}
