import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import { PDFDocument } from '@cantoo/pdf-lib';

import {
  ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM,
  ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM,
  appendAttachmentSection,
  attachmentCaptionBlockMaxMm,
  attachmentPairUsableMm,
  renderAttachmentSectionHtml,
} from '@/src/core/attachments/attachmentSectionHtml';
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

function offerHtml(sectionHtml: string): string {
  const document = renderDocument(
    {
      customerLines: ['Malli Asiakas'],
      offerInfo: [{ label: 'Tarjous', value: '1' }],
      footer: { left: ['Vasen'], center: ['Keski'], right: ['Oikea'] },
    },
    '<p>Runko.</p>',
    { offerAccentBar: true, bodyClass: 'doc-offer' },
  );
  return appendAttachmentSection(document, sectionHtml);
}

function printToPdf(chrome: string, html: string): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'liite-sivu-'));
  const htmlPath = path.join(dir, 'doc.html');
  const pdfPath = path.join(dir, 'doc.pdf');
  fs.writeFileSync(htmlPath, html);
  return new Promise((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--user-data-dir=${path.join(dir, 'profile')}`,
        `--print-to-pdf=${pdfPath}`,
        htmlPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let err = '';
    let settled = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) resolve(fs.readFileSync(pdfPath));
        else reject(new Error(err.slice(-400) || 'PDF puuttuu'));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
      setTimeout(() => {
        fs.rm(dir, { recursive: true, force: true }, () => undefined);
      }, 400);
    };
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString();
      if (err.includes('bytes written')) setTimeout(() => child.kill('SIGKILL'), 200);
    });
    child.on('exit', finish);
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
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
  jest.setTimeout(180000);
  const portrait = pngDataUri(900, 1400);
  let bodyPages = 0;

  beforeAll(async () => {
    const pdf = await printToPdf(browser, offerHtml(''));
    bodyPages = (await PDFDocument.load(pdf)).getPageCount();
    expect(bodyPages).toBe(1);
  });

  async function attachmentPages(
    count: number,
    layout: 'two_per_page' | 'one_per_page',
    caption: string,
    fontExtraPt: number,
  ): Promise<{ pages: number; heights: number[] }> {
    const html = offerHtml(
      renderAttachmentSectionHtml({
        images: Array.from({ length: count }, () => ({ dataUri: portrait, caption })),
        pdfs: [],
        layout,
        fontExtraPt,
      }),
    );
    const pdf = await printToPdf(browser, html);
    const total = (await PDFDocument.load(pdf)).getPageCount();
    return { pages: total - bodyPages, heights: paintedImageHeightsMm(pdf) };
  }

  it.each([0, 1])('lays out two images per page at font +%i pt', async (extraPt) => {
    const pairs: [number, number][] = [
      [2, 1],
      [4, 2],
      [5, 3],
    ];
    for (const caption of ['Ovi', LONG_CAPTION]) {
      for (const [count, expected] of pairs) {
        const printed = await attachmentPages(count, 'two_per_page', caption, extraPt);
        expect(printed.pages).toBe(expected);
        expect(printed.heights).toHaveLength(count);
        for (const height of printed.heights) {
          expect(height).toBeGreaterThan(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM - 2);
          expect(height).toBeLessThanOrEqual(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM + 0.5);
        }
      }
    }
  });

  it.each([0, 1])('lays out one large image per page at font +%i pt', async (extraPt) => {
    for (const caption of ['Ovi', LONG_CAPTION]) {
      for (const count of [2, 5]) {
        const printed = await attachmentPages(count, 'one_per_page', caption, extraPt);
        expect(printed.pages).toBe(count);
        expect(printed.heights).toHaveLength(count);
        for (const height of printed.heights) {
          expect(height).toBeGreaterThan(ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM - 2);
          expect(height).toBeLessThanOrEqual(ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM + 0.5);
        }
      }
    }
  });
});
