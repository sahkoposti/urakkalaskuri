import type { CompanyProfile } from '../company/types';
import type { AppSettings, CalculationRecord, Product } from '../models/types';
import { customerFromRecord } from '../models/types';
import type { ProductStructure } from '../structure/types';
import { ensureStructureLines } from '../structure/legacyCalculation';
import { buildPdfContext } from './buildPdfContext';
import type { GeneratePdfOptions, GeneratePdfResult } from './generatePdf';
import { linesNeedingManualContract } from './manualContract';
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
  getCompanyProfile: () => Promise<CompanyProfile>;
  getOfferCompanySettings: () => Promise<OfferCompanySettings>;
  getOfferStructureSettings: (structureId: string) => Promise<OfferStructureSettings>;
  loadLogoDataUri: () => Promise<string | null>;
  generatePdf: (options: GeneratePdfOptions) => Promise<GeneratePdfResult>;
  now: () => Date;
};

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
): Promise<GeneratePdfResult & { offerNumber: number; fileName: string }> {
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
  const html = renderTarjousHtml(ctx, { logoDataUri, accentColor: app.settings.theme?.accentColor });
  const fileName = buildPdfFileName({ kind: 'Tarjous', customerName: customerFromRecord(record).name, date: generatedAt, offerNumber });
  const result = await deps.generatePdf({ html, fileName, dialogTitle: `Tarjous ${offerNumber}` });
  return { ...result, offerNumber, fileName };
}

export type UrakkakorttiExportResult =
  | { status: 'needsManualContract'; lines: { id: string; name: string }[] }
  | ({ status: 'done'; fileName: string } & GeneratePdfResult);

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
      ? await deps.saveManualContractPrices(calculationId, manualValues)
      : await requireCalculation(deps, calculationId);
  const missing = linesNeedingManualContract(record);
  if (missing.length > 0) {
    return { status: 'needsManualContract', lines: missing.map((line) => ({ id: line.id, name: line.name })) };
  }
  const [company, logoDataUri] = await Promise.all([deps.getCompanyProfile(), deps.loadLogoDataUri()]);
  const generatedAt = deps.now();
  const ctx = buildUrakkakorttiContext({
    record,
    company,
    structures: app.structures,
    products: app.products,
    settings: app.settings,
    generatedAt,
  });
  const html = renderUrakkakorttiHtml(ctx, { logoDataUri, accentColor: app.settings.theme?.accentColor });
  const fileName = buildPdfFileName({ kind: 'Urakkakortti', customerName: customerFromRecord(record).name, date: generatedAt });
  const result = await deps.generatePdf({ html, fileName, dialogTitle: 'Urakkakortti' });
  return { status: 'done', fileName, ...result };
}
