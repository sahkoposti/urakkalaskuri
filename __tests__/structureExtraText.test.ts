import { buildOfferSections } from '../src/core/pdf/offerDocument';
import {
  firstPrintedStructureNote,
  structureRowShowsAdditionalInfo,
} from '../src/core/pdf/structureExtraText';
import { buildUrakkakorttiSections } from '../src/core/pdf/urakkakorttiSections';
import { input, line, record } from './pdfFixtures';

describe('first structure extra text', () => {
  const lines = [
    { ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: '' },
    { ...line('b', 's2', 'Sokkeli'), additionalInfo: 'Toinen kuvitteellinen huomio' },
    { ...line('c', 's3', 'Räystäs'), additionalInfo: 'Kolmas ei näy' },
  ];

  it('shows the row field until the first text and hides the rest', () => {
    expect(structureRowShowsAdditionalInfo(lines, 'a')).toBe(true);
    expect(structureRowShowsAdditionalInfo(lines, 'b')).toBe(true);
    expect(structureRowShowsAdditionalInfo(lines, 'c')).toBe(false);
    const filled = [{ ...lines[0], additionalInfo: 'Ensimmäinen' }, lines[1], lines[2]];
    expect(structureRowShowsAdditionalInfo(filled, 'b')).toBe(false);
  });

  it('prints only the first non-empty structure settings text', () => {
    const settings = {
      s1: { additionalInfoText: '   ', offerPages: [] },
      s2: { additionalInfoText: 'Sokkeli kuvitteellinen.', offerPages: [] },
      s3: { additionalInfoText: 'Ei mukaan.', offerPages: [] },
    };
    const rec = record({}, { structureLines: lines });
    const note = firstPrintedStructureNote(lines, (item) => settings[item.structureId as 's1'].additionalInfoText);
    expect(note).toEqual({ lineId: 'b', text: 'Sokkeli kuvitteellinen.' });
    const offer = buildOfferSections(input(rec, { offerStructureSettings: settings }));
    expect(JSON.stringify(offer)).toContain('Sokkeli kuvitteellinen.');
    expect(JSON.stringify(offer)).not.toContain('Ei mukaan.');
    const card = buildUrakkakorttiSections(input(rec, { offerStructureSettings: settings }), {
      offerStructureSettings: settings,
    });
    expect(JSON.stringify(card)).toContain('Sokkeli kuvitteellinen.');
    expect(JSON.stringify(card)).not.toContain('Ei mukaan.');
  });
});
