/**
 * v1.3.4-esimerkkien HTML ja PDF.
 * Keksitty asiakas. Chrome headless, ei Android eikä expo-print.
 *
 * Ajo repositorion juuresta:
 * npx tsx --tsconfig tsconfig.json scripts/v134-sample-pdfs.ts
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

const shadedLine = {
  ...line('a', 's1', 'Ulkomaalaus'),
  additionalInfo: '**Pitkä** lisätieto\nja *toinen* rivi',
  contractPriceVat0: 1000,
  unitPriceVat0: 1000,
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
    { id: 'brush', productName: 'Pensseli', quantity: 2, unit: 'kpl', source: 'manual' as const },
  ],
};

function sample(siteAddress: string, touched: boolean) {
  return record(customer, {
    id: 'nayte-1',
    projectName: 'Maija Mallinen',
    offerNumber: 10285,
    formSnapshot: {
      formId: 'nayte',
      formVersion: 1,
      fields: [],
      siteAddress,
      siteAddressTouched: touched,
    },
    structureLines: [shadedLine],
  });
}

const withSite = sample('Työmaa 5, 33100 Tampere', true);
const clearedSite = sample('', true);

function contextFor(rec: ReturnType<typeof sample>) {
  return input(rec, {
    offerCompany: {
      ...defaultOfferCompanySettings,
      additionalInfoText: 'Esimerkkiyrityksen lisätieto. Teksti on keksitty näytettä varten eikä ole sopimusehto.',
    },
    generatedAt: new Date(2026, 10, 7),
    offerNumber: 10285,
  });
}

function printPdf(htmlPath: string, pdfPath: string) {
  rmSync(pdfPath, { force: true });
  const profile = `/tmp/chrome-v134-${process.pid}-${htmlPath.replace(/[^a-z0-9]/gi, '')}`;
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
  const siteCtx = contextFor(withSite);
  const clearedCtx = contextFor(clearedSite);
  const offerHtml = renderTarjousHtml(buildPdfContext(siteCtx), { logoDataUri });
  const cardHtml = renderUrakkakorttiHtml(
    buildUrakkakorttiContext({ ...siteCtx, record: withSite, sivukulukerroin: 1.5 }),
    { logoDataUri },
  );
  const clearedHtml = renderTarjousHtml(buildPdfContext(clearedCtx), { logoDataUri });
  if (!offerHtml.includes('Kohde: Työmaa 5, 33100 Tampere') || !offerHtml.includes('Esimerkkikatu 1, 00100 Helsinki')) {
    throw new Error('kohdeosoitteen otsikko puuttuu');
  }
  if (!clearedHtml.includes('Esimerkkikatu 1, 00100 Helsinki') || clearedHtml.includes('Kohde:')) {
    throw new Error('tyhjennetty kohde piilotti asiakkaan osoitteen tai tulosti kohderivin');
  }
  if (!cardHtml.includes('G47') || !cardHtml.includes('505X')) {
    throw new Error('sävyrivit puuttuvat');
  }
  writeHtml('tarjous-kohde', offerHtml);
  writeHtml('urakkakortti-savy', cardHtml);
  writeHtml('tarjous-tyhja-kohde', clearedHtml);
  const files = await Promise.all([
    describe('tarjous-kohde.pdf'),
    describe('urakkakortti-savy.pdf'),
    describe('tarjous-tyhja-kohde.pdf'),
  ]);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const node = process.version;
  const chrome = execFileSync('google-chrome', ['--version'], { encoding: 'utf8' }).trim();
  const manifest = {
    sourceCommit,
    note: 'Headless Google Chrome print of the app HTML renderers. This is not Android and not expo-print. Chrome writes the PDF and then may stay running; timeout sends SIGKILL after 8 seconds once the file exists.',
    environment: { node, chrome, os: process.platform },
    commands: [
      'node -v',
      'google-chrome --version',
      'git rev-parse HEAD',
      'npx tsx --tsconfig tsconfig.json scripts/v134-sample-pdfs.ts',
    ],
    chromeArguments: [
      'timeout --signal=KILL 8 google-chrome --headless=new --disable-gpu --no-sandbox --no-first-run --disable-extensions --disable-dev-shm-usage --user-data-dir=/tmp/chrome-v134-<pid>-<html> --no-pdf-header-footer --print-to-pdf=<pdf> file://<html>',
    ],
    files: files.map(({ fileName, pageCount, sha256 }) => ({ fileName, pageCount, sha256 })),
  };
  writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

void main();
