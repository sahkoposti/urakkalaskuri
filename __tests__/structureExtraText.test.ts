import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { structureRowShowsAdditionalInfo } from '../src/core/pdf/structureExtraText';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { input, line, record, structure } from './pdfFixtures';

const FIRST = 'Ensimmäisen rakenteen lisätieto.';
const SECOND = 'Toisen rakenteen lisätieto.';
const OLD = 'VANHA_EI_TULOSTU';

const structures = [
  { ...structure('s1', 'Ulkomaalaus'), defaultAdditionalInfo: FIRST },
  { ...structure('s2', 'Sokkeli'), defaultAdditionalInfo: SECOND },
];

const settings = {
  s1: { additionalInfoText: OLD, offerPages: [] },
  s2: { additionalInfoText: 'Toinen vanha teksti', offerPages: [] },
};

function offerHtml(lines: ReturnType<typeof line>[], companyText = '') {
  const rec = record({}, { structureLines: lines });
  return renderTarjousHtml(
    buildPdfContext(
      input(rec, {
        structures,
        offerStructureSettings: settings,
        offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: companyText },
      }),
    ),
  );
}

function cardHtml(lines: ReturnType<typeof line>[], companyText = '') {
  const rec = record({}, { structureLines: lines });
  return renderUrakkakorttiHtml(
    buildUrakkakorttiContext({
      ...input(rec, {
        structures,
        offerStructureSettings: settings,
        offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: companyText },
      }),
      record: rec,
    }),
  );
}

describe('structure Lisätiedot on the real offer and card', () => {
  const lines = [
    { ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: FIRST },
    line('b', 's2', 'Sokkeli'),
  ];

  it('prints the first structure text and hides the later structure', () => {
    const offer = offerHtml(lines, 'Yrityksen maksuehto.');
    const card = cardHtml(lines, 'Yrityksen maksuehto.');
    expect(offer).toContain(FIRST);
    expect(card).toContain(FIRST);
    expect(offer).not.toContain(SECOND);
    expect(card).not.toContain(SECOND);
    expect(offer).not.toContain(OLD);
    expect(card).not.toContain(OLD);
    expect(offer).not.toContain('Toinen vanha teksti');
    expect(card).not.toContain('Toinen vanha teksti');
    expect(offer).toContain('Lisätiedot:');
    expect(offer).toContain('Yrityksen maksuehto.');
    expect(card).not.toContain('Lisätiedot:');
    expect(card).not.toContain('Yrityksen maksuehto.');
    expect(structureRowShowsAdditionalInfo(lines, 'a', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo(lines, 'b', structures)).toBe(false);
  });

  it('uses the structure default when the line has no copy, and prints nothing when every structure is empty', () => {
    const fromDefault = [line('a', 's1', 'Ulkomaalaus'), line('b', 's2', 'Sokkeli')];
    expect(offerHtml(fromDefault)).toContain(FIRST);
    expect(cardHtml(fromDefault)).toContain(FIRST);
    expect(offerHtml(fromDefault)).not.toContain(SECOND);
    expect(structureRowShowsAdditionalInfo(fromDefault, 'a', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo(fromDefault, 'b', structures)).toBe(false);

    const emptyStructures = structures.map((item) => ({ ...item, defaultAdditionalInfo: undefined }));
    const emptyLines = [line('a', 's1', 'Ulkomaalaus'), line('b', 's2', 'Sokkeli')];
    const rec = record({}, { structureLines: emptyLines });
    const offer = renderTarjousHtml(
      buildPdfContext(input(rec, { structures: emptyStructures, offerStructureSettings: settings })),
    );
    const card = renderUrakkakorttiHtml(
      buildUrakkakorttiContext({
        ...input(rec, { structures: emptyStructures, offerStructureSettings: settings }),
        record: rec,
      }),
    );
    expect(offer).not.toContain(FIRST);
    expect(card).not.toContain(FIRST);
    expect(offer).not.toContain(OLD);
    expect(card).not.toContain(OLD);
    expect(offer).not.toContain('>Muuta<');
    expect(card).not.toContain('>Muuta<');
    expect(structureRowShowsAdditionalInfo(emptyLines, 'a', emptyStructures)).toBe(false);
    expect(structureRowShowsAdditionalInfo(emptyLines, 'b', emptyStructures)).toBe(false);
  });
});
