import { readFileSync } from 'fs';
import { join } from 'path';
import { PDF_LOGO_PNG_BASE64 } from '../src/core/pdf/pdfLogoPng';

test('the embedded PDF logo is byte-identical to assets/images/logo-colorajaton-pdf.png', () => {
  const png = readFileSync(join(__dirname, '..', 'assets', 'images', 'logo-colorajaton-pdf.png'));
  expect(Buffer.from(PDF_LOGO_PNG_BASE64, 'base64').equals(png)).toBe(true);
  expect(PDF_LOGO_PNG_BASE64.startsWith('iVBORw0KGgo')).toBe(true);
});
