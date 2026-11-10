/**
 * v1.3.5-esimerkkien HTML ja PDF (2+ rakennetta, tuotteita, sävyjä).
 *
 * npx tsx --tsconfig tsconfig.json scripts/v135-sample-pdfs.ts
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { PDFDocument } from '@cantoo/pdf-lib';

import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { input, line, record } from '../__tests__/pdfFixtures';

const root = process.cwd();
const outDir = process.env.SAMPLE_PDF_DIR ?? '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const logo = readFileSync(`${root}/assets/images/logo-colorajaton-pdf.png`).toString('base64');
const logoDataUri = `data:image/png;base64,${logo}`;

const customer = {
  name: 'Maija Mallinen',
  address: 'Esimerkkikatu 1',
  postalCode: '00100',
  postalLocality: 'Helsinki',
  phone: '040 000 0000',
  email: 'maija.mallinen@example.test',
};

const lineOne = {
  ...line('a', 's1', 'ulkomaalaus talo A'),
  additionalInfo: '**Pitkä** lisätieto\nja *toinen* rivi',
  contractPriceVat0: 1000,
  materialQuantities: [
    {
      id: 'paint',
      productName: 'Nova 7',
      quantity: 0,
      source: 'manual' as const,
      shades: [
        { id: 'g', name: 'G47', quantity: 3, unit: 'l' },
        { id: 'x', name: '505X', quantity: 5, unit: 'l' },
      ],
    },
  ],
};

const lineTwo = {
  ...line('b', 's2', 'sokkeli patina B', '30'),
  contractPriceVat0: 450,
  materialQuantities: [
    { id: 'primer', productName: 'Pohjuste X', quantity: 4, unit: 'l', source: 'manual' as const },
    { id: 'brush', productName: 'Pensseli 50', quantity: 2, unit: 'kpl', source: 'manual' as const },
  ],
};

const sampleRec = record({ ...customer, notes: 'Koira piha-alueella.' }, {
  id: 'nayte-1-3-5',
  projectName: 'Maija Mallinen',
  offerNumber: 10286,
  structureLines: [lineOne, lineTwo],
});

function printPdf(htmlPath: string, pdfPath: string) {
  rmSync(pdfPath, { force: true });
  const profile = `/tmp/chrome-v135-${process.pid}`;
  try {
    execFileSync(
      'timeout',
      [
        '--signal=KILL',
        '8',
        'google-chrome',
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        `--user-data-dir=${profile}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: 'inherit' },
    );
  } catch (error) {
    const header = readFileSync(pdfPath).subarray(0, 5).toString('utf8');
    if (header !== '%PDF-') throw error;
  }
}

async function describe(name: string) {
  const bytes = readFileSync(`${outDir}/${name}`);
  const pdf = await PDFDocument.load(bytes);
  return {
    fileName: name,
    pageCount: pdf.getPageCount(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  };
}

function writeHtml(name: string, html: string) {
  const path = `/tmp/${name}.html`;
  writeFileSync(path, html);
  printPdf(path, `${outDir}/${name}.pdf`);
}

async function main() {
  const ctx = input(sampleRec, {
    offerCompany: {
      ...defaultOfferCompanySettings,
      additionalInfoText: 'Esimerkkiyrityksen lisätieto keksitty näytettä varten.',
    },
    generatedAt: new Date(2026, 10, 10),
    offerNumber: 10286,
  });
  const offerHtml = renderTarjousHtml(buildPdfContext(ctx), { logoDataUri });
  const cardHtml = renderUrakkakorttiHtml(
    buildUrakkakorttiContext({ ...ctx, record: sampleRec, sivukulukerroin: 1.5 }),
    { logoDataUri },
  );
  if (!offerHtml.includes('class="price-block offer-totals"')) throw new Error('tarjouksen yhteensä puuttuu');
  const totalsAt = offerHtml.indexOf('class="price-block offer-totals"');
  const lisatiedotAt = offerHtml.indexOf('Lisätiedot:');
  if (lisatiedotAt < totalsAt) throw new Error('Lisätiedot ennen hintoja');
  if (!cardHtml.includes('uk-structure')) throw new Error('materiaalien rakenneotsikot puuttuvat');
  writeHtml('tarjous-1-3-5', offerHtml);
  writeHtml('urakkakortti-1-3-5', cardHtml);
  const files = await Promise.all([describe('tarjous-1-3-5.pdf'), describe('urakkakortti-1-3-5.pdf')]);
  const manifest = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    files,
  };
  writeFileSync(`${outDir}/manifest-v135.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

void main();
