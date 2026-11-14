import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import {
  isProductStructureLisatiedotLine,
  lineStructureLisatiedot,
  structureLineAdditionalInfoInputValue,
  structureRowShowsAdditionalInfo,
} from '../src/core/pdf/structureExtraText';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { emptyStructureLine, type ProductStructure } from '../src/core/structure/types';
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

function offerHtml(
  lines: ReturnType<typeof line>[],
  companyText = '',
  structureList: ProductStructure[] = structures,
) {
  const rec = record({}, { structureLines: lines });
  return renderTarjousHtml(
    buildPdfContext(
      input(rec, {
        structures: structureList,
        offerStructureSettings: settings,
        offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: companyText },
      }),
    ),
  );
}

function cardHtml(
  lines: ReturnType<typeof line>[],
  companyText = '',
  structureList: ProductStructure[] = structures,
) {
  const rec = record({}, { structureLines: lines });
  return renderUrakkakorttiHtml(
    buildUrakkakorttiContext({
      ...input(rec, {
        structures: structureList,
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
    expect(offer.indexOf(FIRST)).toBeLessThan(offer.indexOf('class="price-block offer-totals"'));
    expect(offer.indexOf('Yrityksen maksuehto.')).toBeGreaterThan(offer.indexOf('class="price-block offer-totals"'));
    expect(card).toContain('Lisätiedot:');
    expect(card.indexOf('Lisätiedot:')).toBeGreaterThan(card.indexOf('Ulkomaalaus'));
    expect(card).not.toContain('Yrityksen maksuehto.');
    expect(offer).not.toContain('>Muuta<');
    expect(card).not.toContain('>Muuta<');
    expect(structureRowShowsAdditionalInfo(lines, 'a', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo(lines, 'b', structures)).toBe(false);
  });

  it('prints nothing for a legacy line whose additionalInfo field is missing', () => {
    const legacy = [line('a', 's1', 'Ulkomaalaus'), line('b', 's2', 'Sokkeli')];
    expect(legacy[0].additionalInfo).toBeUndefined();
    expect(lineStructureLisatiedot(legacy[0], structures)).toBe('');
    expect(structureLineAdditionalInfoInputValue(legacy[0], structures[0])).toBe('');
    const changed = structures.map((item) => ({ ...item, defaultAdditionalInfo: 'Uusi oletus' }));
    expect(lineStructureLisatiedot(legacy[0], changed)).toBe('');
    expect(structureLineAdditionalInfoInputValue(legacy[0], changed[0])).toBe('');
    const offer = offerHtml(legacy);
    const card = cardHtml(legacy);
    expect(offer).not.toContain(FIRST);
    expect(card).not.toContain(FIRST);
    expect(offer).not.toContain(SECOND);
    expect(card).not.toContain(SECOND);
    expect(offer).not.toContain('Uusi oletus');
    expect(card).not.toContain('Uusi oletus');
    expect(offer).not.toContain(OLD);
    expect(card).not.toContain(OLD);
    expect(offer).not.toContain('>Muuta<');
    expect(card).not.toContain('>Muuta<');
    expect(structureRowShowsAdditionalInfo(legacy, 'a', structures)).toBe(false);
    expect(structureRowShowsAdditionalInfo(legacy, 'b', structures)).toBe(false);
  });

  it('prints Lisätiedot for a non-manual line even when the structure has no form', () => {
    const noForm = structures.map((item) => ({ ...item, form: undefined })) as unknown as ProductStructure[];
    const lines = [
      { ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: FIRST },
      { ...line('b', 's2', 'Sokkeli'), additionalInfo: SECOND },
    ];
    const missing = { ...line('c', 'puuttuva', 'Kadotettu'), additionalInfo: 'Kadonneen rakenteen teksti.' };
    expect(isProductStructureLisatiedotLine(lines[0], noForm)).toBe(true);
    expect(isProductStructureLisatiedotLine(missing, structures)).toBe(true);
    expect(isProductStructureLisatiedotLine({ ...line('m', 'manual', 'Nostin'), additionalInfo: 'Nostin.' }, structures)).toBe(
      false,
    );
    expect(offerHtml(lines, '', noForm)).toContain(FIRST);
    expect(cardHtml(lines, '', noForm)).toContain(FIRST);
    expect(cardHtml(lines, '', noForm)).not.toContain(SECOND);
    expect(offerHtml([missing, lines[1]])).toContain('Kadonneen rakenteen teksti.');
    expect(cardHtml([missing, lines[1]])).toContain('Kadonneen rakenteen teksti.');
    expect(offerHtml([missing, lines[1]])).not.toContain(SECOND);
    expect(cardHtml([missing, lines[1]])).not.toContain(SECOND);
    expect(structureRowShowsAdditionalInfo(lines, 'a', noForm)).toBe(true);
    expect(structureRowShowsAdditionalInfo(lines, 'b', noForm)).toBe(false);
  });

  it('snapshots the structure default at creation and ignores a later default', () => {
    const created = emptyStructureLine({
      id: 'new',
      structure: { ...structure('s1', 'Ulkomaalaus'), defaultAdditionalInfo: '  Alkuperäinen teksti  ' },
      vatPercent: 25.5,
    });
    expect(created.additionalInfo).toBe('Alkuperäinen teksti');
    const changed = [{ ...structures[0], defaultAdditionalInfo: 'Uusi oletus' }, structures[1]];
    expect(lineStructureLisatiedot(created, changed)).toBe('Alkuperäinen teksti');
    const stored = JSON.parse(JSON.stringify(created)) as typeof created;
    expect(stored.additionalInfo).toBe('Alkuperäinen teksti');
    expect(lineStructureLisatiedot(stored, changed)).toBe('Alkuperäinen teksti');
    const offer = offerHtml([created, line('b', 's2', 'Sokkeli')]);
    const card = cardHtml([created, line('b', 's2', 'Sokkeli')]);
    expect(offer).toContain('Alkuperäinen teksti');
    expect(card).toContain('Alkuperäinen teksti');
    expect(offer).not.toContain('Uusi oletus');
    expect(card).not.toContain(FIRST);
    expect(card).not.toContain(SECOND);
  });

  it('keeps an explicit empty string cleared and lets the next structure win', () => {
    const cleared = { ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: '' };
    const later = { ...line('b', 's2', 'Sokkeli'), additionalInfo: SECOND };
    expect(structureLineAdditionalInfoInputValue(cleared, structures[0])).toBe('');
    expect(structureLineAdditionalInfoInputValue({ additionalInfo: undefined }, structures[0])).toBe('');
    expect(lineStructureLisatiedot(cleared, structures)).toBe('');
    const reopened = JSON.parse(JSON.stringify(cleared)) as typeof cleared;
    expect(reopened.additionalInfo).toBe('');
    expect(structureLineAdditionalInfoInputValue(reopened, structures[0])).toBe('');
    expect(offerHtml([cleared, later])).toContain(SECOND);
    expect(cardHtml([cleared, later])).toContain(SECOND);
    expect(offerHtml([cleared, later])).not.toContain(FIRST);
    expect(structureRowShowsAdditionalInfo([cleared, later], 'a', structures)).toBe(false);
    expect(structureRowShowsAdditionalInfo([cleared, later], 'b', structures)).toBe(true);
  });

  it('prints a manual description in either order without blocking structure Lisätiedot', () => {
    const manualText = 'Nostin kuvitteelliselle pihalle.';
    const manual = { ...line('m', 'manual', 'Henkilönostin'), additionalInfo: manualText };
    const first = { ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: FIRST };
    const second = { ...line('b', 's2', 'Sokkeli'), additionalInfo: SECOND };
    for (const lines of [
      [manual, first],
      [first, manual],
      [manual, first, second],
      [first, manual, second],
    ]) {
      const offer = offerHtml(lines);
      const card = cardHtml(lines);
      expect(offer).toContain(manualText);
      expect(offer).toContain(FIRST);
      expect(card).toContain(FIRST);
      expect(card).not.toContain(manualText);
      expect(offer).not.toContain(SECOND);
      expect(card).not.toContain(SECOND);
    }
    expect(structureRowShowsAdditionalInfo([manual, first], 'm', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo([manual, first], 'a', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo([first, second], 'a', structures)).toBe(true);
    expect(structureRowShowsAdditionalInfo([first, second], 'b', structures)).toBe(false);
  });
});
