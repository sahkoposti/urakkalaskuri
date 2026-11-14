import { spawn, execFileSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import { PDFDocument } from '@cantoo/pdf-lib';

import {
  ATTACHMENT_CARD_IMAGE_MAX_HEIGHT_MM,
  ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM,
  ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM,
  appendAttachmentSection,
  attachmentCaptionBlockMaxMm,
  attachmentCardContentWidthMm,
  attachmentPairUsableMm,
  renderAttachmentSectionHtml,
} from '@/src/features/attachments/lib/attachmentSectionHtml';
import type { AttachmentSectionLayout } from '@/src/features/attachments/lib/attachmentPrintPlan';
import { PDF_USABLE_BODY_MM } from '@/src/core/pdf/pdfStyles';
import { renderDocument } from '@/src/core/pdf/renderTarjousHtml';

const LONG_CAPTION = 'W'.repeat(120);

function findChrome(): string | null {
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
      if (found) return found;
    } catch {
      // Seuraava nimi.
    }
  }
  return null;
}

function pngDataUri(width: number, height: number): string {
  const crc = (buf: Buffer) => {
    const out = Buffer.alloc(4);
    out.writeUInt32BE(zlib.crc32(buf) >>> 0);
    return out;
  };
  const chunk = (type: string, data: Buffer) =>
    Buffer.concat([Buffer.from([(data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255]), Buffer.from(type), data, crc(Buffer.concat([Buffer.from(type), data]))]);
  const raw = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = (1 + width * 3) * y;
    raw[offset] = 0;
    raw.fill(0x88, offset + 1, offset + 1 + width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const DOC_CTX = {
  customerLines: ['Malli Asiakas'],
  offerInfo: [{ label: 'Tarjous', value: '1' }],
  footer: { left: ['Vasen'], center: ['Keski'], right: ['Oikea'] },
};

function documentHtml(sectionHtml: string, offer: boolean): string {
  const document = renderDocument(DOC_CTX, '<p>Runko.</p>', offer ? { offerAccentBar: true, bodyClass: 'doc-offer' } : {});
  return appendAttachmentSection(document, sectionHtml);
}

const CHROME_ATTEMPT_MS = 20_000;
const CHROME_ATTEMPTS = 3;
/** 90 s kattaa kolme yritystä yhdelle tulosteelle. */
const CHROME_PRINT_TIMEOUT_MS = 90_000;

const chromeJobs: { child: ChildProcess; dir: string }[] = [];

function stopChromeJob(job: { child: ChildProcess; dir: string }) {
  try {
    job.child.kill('SIGKILL');
  } catch {
    // Prosessi on jo poissa.
  }
  fs.rmSync(job.dir, { recursive: true, force: true });
}

afterAll(() => {
  for (const job of chromeJobs.splice(0)) stopChromeJob(job);
});

function chromePrintArgs(pdfPath: string, htmlPath: string, userDataDir: string | null): string[] {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
  ];
  if (process.env.CI) {
    args.push('--disable-dev-shm-usage');
    if (userDataDir) args.push(`--user-data-dir=${userDataDir}`);
  }
  args.push(htmlPath);
  return args;
}

function printToPdfOnce(chrome: string, html: string): Promise<{ pdf: Buffer | null; stderr: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'liite-sivu-'));
  const htmlPath = path.join(dir, 'doc.html');
  const pdfPath = path.join(dir, 'doc.pdf');
  const userDataDir = process.env.CI ? path.join(dir, 'chrome-profile') : null;
  if (userDataDir) fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(htmlPath, html);
  return new Promise((resolve) => {
    const child = spawn(chrome, chromePrintArgs(pdfPath, htmlPath, userDataDir), {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const job = { child, dir };
    chromeJobs.push(job);
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // Prosessi on jo poissa.
      }
    }, CHROME_ATTEMPT_MS);
    let wroteTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (wroteTimer) clearTimeout(wroteTimer);
      const index = chromeJobs.indexOf(job);
      if (index >= 0) chromeJobs.splice(index, 1);
      let pdf: Buffer | null = null;
      try {
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) pdf = fs.readFileSync(pdfPath);
      } catch {
        pdf = null;
      }
      stopChromeJob(job);
      resolve({ pdf, stderr });
    };
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (!wroteTimer && stderr.includes('bytes written')) {
        wroteTimer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // Prosessi on jo poissa.
          }
        }, 200);
      }
    });
    child.on('exit', finish);
    child.on('error', () => {
      try {
        child.kill('SIGKILL');
      } catch {
        // Prosessi ei käynnistynyt.
      }
      finish();
    });
  });
}

async function printToPdf(chrome: string, html: string): Promise<Buffer> {
  let lastStderr = '';
  for (let attempt = 1; attempt <= CHROME_ATTEMPTS; attempt += 1) {
    const result = await printToPdfOnce(chrome, html);
    if (result.pdf && result.pdf.length > 0) return result.pdf;
    lastStderr = result.stderr;
  }
  throw new Error(lastStderr.slice(-400) || 'PDF puuttuu');
}

function paintedImageHeightsMm(pdf: Buffer): number[] {
  const heights: number[] = [];
  const streams = pdf.toString('latin1').match(/stream\r?\n[\s\S]*?\r?\nendstream/g) ?? [];
  for (const block of streams) {
    const body = block.replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, '');
    let decoded: Buffer;
    try {
      decoded = zlib.inflateSync(Buffer.from(body, 'latin1'));
    } catch {
      continue;
    }
    if (!decoded.includes(Buffer.from(' Do'))) continue;
    const multiply = (m1: number[], m2: number[]) => {
      const [a1, b1, c1, d1, e1, f1] = m1;
      const [a2, b2, c2, d2, e2, f2] = m2;
      return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    };
    let stack = [[1, 0, 0, 1, 0, 0]];
    for (const line of decoded.toString('latin1').split(/\r?\n/)) {
      if (line === 'q') stack.push(stack[stack.length - 1].slice());
      else if (line === 'Q' && stack.length > 1) stack.pop();
      else if (line.endsWith(' cm')) {
        const parts = line.split(' ').slice(0, 6).map(Number);
        if (parts.length === 6 && parts.every((part) => Number.isFinite(part))) {
          stack[stack.length - 1] = multiply(stack[stack.length - 1], parts);
        }
      } else if (line.endsWith(' Do')) {
        const height = Math.abs(stack[stack.length - 1][3]) / 72 * 25.4;
        if (height > 20) heights.push(height);
      }
    }
  }
  return heights;
}

describe('attachment section height budget', () => {
  it('fits two images and two captions in the usable page height', () => {
    expect(PDF_USABLE_BODY_MM).toBe(223);
    for (const extraPt of [0, 1]) {
      const used =
        2 * (ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM + attachmentCaptionBlockMaxMm(extraPt));
      expect(used).toBeLessThanOrEqual(attachmentPairUsableMm(extraPt));
    }
    expect(ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM).toBeGreaterThan(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM);
    expect(ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM + attachmentCaptionBlockMaxMm(1)).toBeLessThanOrEqual(
      PDF_USABLE_BODY_MM,
    );
    expect(attachmentCardContentWidthMm()).toBe(176);
    expect(ATTACHMENT_CARD_IMAGE_MAX_HEIGHT_MM * 2).toBeLessThan(PDF_USABLE_BODY_MM);
    const html = renderAttachmentSectionHtml({
      images: [{ dataUri: 'data:image/png;base64,xx', caption: 'Teksti' }],
      pdfs: [],
    });
    expect(html).toContain(`max-height: ${ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM}mm`);
    expect(html).toContain(`max-height: ${ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM}mm`);
    expect(html).toContain(`max-height: ${PDF_USABLE_BODY_MM}mm`);
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('overflow: hidden');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('class="liitteet page-break"');
  });
});

const chrome = findChrome();

describe('attachment section printed pages', () => {
  if (!chrome) {
    it.skip('google-chrome puuttuu: sivumäärää ei todisteta (google-chrome --headless --no-sandbox --print-to-pdf)', () => undefined);
    return;
  }

  const browser = chrome;
  const portrait = pngDataUri(900, 1400);
  let offerBodyPages = 0;
  let cardBodyPages = 0;

  beforeAll(async () => {
    offerBodyPages = (await PDFDocument.load(await printToPdf(browser, documentHtml('', true)))).getPageCount();
    cardBodyPages = (await PDFDocument.load(await printToPdf(browser, documentHtml('', false)))).getPageCount();
    expect(offerBodyPages).toBe(1);
    expect(cardBodyPages).toBe(1);
  }, 2 * CHROME_PRINT_TIMEOUT_MS);

  async function attachmentPages(
    count: number,
    layout: AttachmentSectionLayout,
    caption: string,
    fontExtraPt: number,
  ): Promise<{ pages: number; heights: number[] }> {
    const html = documentHtml(
      renderAttachmentSectionHtml({
        images: Array.from({ length: count }, () => ({ dataUri: portrait, caption })),
        pdfs: [],
        layout,
        fontExtraPt,
      }),
      layout !== 'card_grid',
    );
    const pdf = await printToPdf(browser, html);
    const total = (await PDFDocument.load(pdf)).getPageCount();
    const body = layout === 'card_grid' ? cardBodyPages : offerBodyPages;
    return { pages: total - body, heights: paintedImageHeightsMm(pdf) };
  }

  function expectHeight(heights: number[], count: number, maxMm: number) {
    expect(heights).toHaveLength(count);
    for (const height of heights) {
      expect(height).toBeGreaterThan(maxMm - 2);
      expect(height).toBeLessThanOrEqual(maxMm + 0.5);
    }
  }

  it.each([0, 1])('keeps the offer two-up option on one page at font +%i pt', async (extraPt) => {
    const pairs: [number, number][] = [
      [2, 1],
      [4, 2],
      [5, 3],
    ];
    for (const caption of ['Ovi', LONG_CAPTION]) {
      for (const [count, expected] of pairs) {
        const printed = await attachmentPages(count, 'two_per_page', caption, extraPt);
        expect(printed.pages).toBe(expected);
        expectHeight(printed.heights, count, ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM);
      }
    }
  }, 6 * CHROME_PRINT_TIMEOUT_MS);

  it.each([0, 1])('puts one offer image on each page at font +%i pt', async (extraPt) => {
    for (const caption of ['Ovi', LONG_CAPTION]) {
      for (const count of [2, 4, 5]) {
        const printed = await attachmentPages(count, 'one_per_page', caption, extraPt);
        expect(printed.pages).toBe(count);
        expectHeight(printed.heights, count, ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM);
      }
    }
  }, 6 * CHROME_PRINT_TIMEOUT_MS);

  it.each([0, 1])('fits four card images on a page at font +%i pt', async (extraPt) => {
    const pairs: [number, number][] = [
      [4, 1],
      [8, 2],
      [5, 2],
    ];
    for (const caption of ['Ovi', LONG_CAPTION]) {
      for (const [count, expected] of pairs) {
        const printed = await attachmentPages(count, 'card_grid', caption, extraPt);
        expect(printed.pages).toBe(expected);
        expectHeight(printed.heights, count, ATTACHMENT_CARD_IMAGE_MAX_HEIGHT_MM);
      }
    }
  }, 6 * CHROME_PRINT_TIMEOUT_MS);
});
