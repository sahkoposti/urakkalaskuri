import fs from 'fs';
import path from 'path';

import { buildPdfContext } from '../../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../../src/core/pdf/urakkakortti';

import {
  buildGoldenPdfContextInput,
  buildGoldenUrakkakorttiInput,
  GOLDEN_LOGO,
} from './goldenHtmlFixtures';

const describeWrite = process.env.GOLDEN_WRITE === '1' ? describe : describe.skip;

describeWrite('golden HTML writer (GOLDEN_WRITE=1 only)', () => {
  it('rewrites committed golden HTML files', () => {
    const dir = path.join(__dirname);
    const tarjous = renderTarjousHtml(buildPdfContext(buildGoldenPdfContextInput()), {
      logoDataUri: GOLDEN_LOGO,
    });
    const urakka = renderUrakkakorttiHtml(buildUrakkakorttiContext(buildGoldenUrakkakorttiInput()));
    fs.writeFileSync(path.join(dir, 'tarjous.golden.html'), tarjous);
    fs.writeFileSync(path.join(dir, 'urakkakortti.golden.html'), urakka);
  });
});
