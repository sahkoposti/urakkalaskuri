import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { applyRefreshedStructurePrices, cardHeaderPrices } from '../src/core/pdf/urakkakorttiCard';
import { input, record } from './pdfFixtures';
import { applyFormResultToLine, patchStructureLine, saveIncompleteFormToLine } from '../src/core/structure/applyFormToLine';
import type { StructureLine } from '../src/core/models/types';
import type { CalculationResult } from '../src/core/calculation/calculationPipeline';

function line(partial: Partial<StructureLine> = {}): StructureLine {
  return {
    id: 'l1',
    structureId: 's1',
    name: 'Ulkoverhoilun maalaus',
    quantity: 1,
    unitPriceVat0: 0,
    materialsVat0: 0,
    discountPercent: 0,
    vatPercent: 25.5,
    contractPriceVat0: 0,
    workDurationDays: 0,
    commissionPercent: 7,
    commissionEur: 0,
    marginEur: 0,
    marginPercent: 0,
    fieldValues: {},
    formFilled: false,
    overrides: [],
    ...partial,
  };
}

const result: CalculationResult = {
  contractPriceVat0: 800,
  materialsVat0: 365,
  marginEur: 2000,
  commissionEur: 237,
  totalPriceVat0: 3223.84,
  vatAmount: 822.08,
  totalPriceVat: 4045.92,
  workDurationDays: 2,
  discountPercent: 5,
  discountEur: 169.68,
  totalPriceVatBeforeDiscount: 4258.47,
  totalPriceVat0BeforeDiscount: 3393.52,
};

describe('applyFormToLine', () => {
  test('lomake täyttää hinnan, materiat, urakan ja alennuksen', () => {
    const next = applyFormResultToLine(line(), result, { maali: 'x' }, 7, { formVersion: 4 });
    expect(next.unitPriceVat0).toBe(3393.52);
    expect(next.materialsVat0).toBe(365);
    expect(next.contractPriceVat0).toBe(800);
    expect(next.discountPercent).toBe(5);
    expect(next.formFilled).toBe(true);
    expect(next.fieldValues.maali).toBe('x');
    expect(next.formVersion).toBe(4);
  });

  test('yliajettua hintaa tai materiaaleja ei korvata', () => {
    const overridden = patchStructureLine(line({ formFilled: true }), {
      unitPriceVat0: 1000,
      materialsVat0: 0,
    });
    const next = applyFormResultToLine(overridden, result, { tuote: 'pid' }, 7);
    expect(next.unitPriceVat0).toBe(1000);
    expect(next.materialsVat0).toBe(0);
    expect(next.fieldValues.tuote).toBe('pid');
    expect(next.contractPriceVat0).toBe(800);
  });

  test('rakenteen oletushinnat yliajetaan lomakkeella kun korttia ei ole muokattu', () => {
    const next = applyFormResultToLine(
      line({
        unitPriceVat0: 100,
        materialsVat0: 10,
        contractPriceVat0: 50,
      }),
      result,
      { maali: 'x' },
      7,
    );
    expect(next.unitPriceVat0).toBe(3393.52);
    expect(next.materialsVat0).toBe(365);
    expect(next.contractPriceVat0).toBe(800);
    expect(next.overrides).toEqual([]);
  });

  test('yliajettua työn hintaa ei korvata', () => {
    const overridden = patchStructureLine(line(), { contractPriceVat0: 123 });
    const next = applyFormResultToLine(overridden, result, { maali: 'x' }, 7);
    expect(next.contractPriceVat0).toBe(123);
    expect(next.unitPriceVat0).toBe(3393.52);
    expect(next.overrides).toContain('contractPrice');
  });

  test('yliajettua keston näyttöarvoa ei korvata eikä laskentaa muuteta', () => {
    const overridden = patchStructureLine(line({ workDurationDays: 4 }), { displayWorkDurationDays: 9 });
    const next = applyFormResultToLine(overridden, result, { maali: 'x' }, 7);
    expect(next.displayWorkDurationDays).toBe(9);
    expect(next.workDurationDays).toBe(2);
    expect(next.overrides).toContain('workDurationDisplay');
    expect(next.contractPriceVat0).toBe(800);
  });

  test('Päivitä hinta korvaa urakan ja poistaa yliajon, myös kortin rivihinnan', () => {
    const overridden = patchStructureLine(line({ contractPriceVat0: 100, unitPriceVat0: 100 }), {
      contractPriceVat0: 50,
    });
    const next = applyFormResultToLine(overridden, result, { maali: 'uusi' }, 7, { refreshPrices: true });
    expect(next.contractPriceVat0).toBe(800);
    expect(next.unitPriceVat0).toBe(3393.52);
    expect(next.overrides).not.toContain('contractPrice');
    expect(next.priceRefreshed).toBe(true);
    const saved = applyRefreshedStructurePrices({
      id: 'c',
      projectName: 'Kuvitteellinen',
      groupDurationHours: 0,
      crewSize: 1,
      hourlyRate: 0,
      marginPercent: 0,
      commissionPercent: 0,
      contractPriceVat0: 50,
      materialsVat0: 0,
      marginEur: 0,
      commissionEur: 0,
      totalPriceVat0: 50,
      vatPercent: 25.5,
      vatAmount: 0,
      totalPriceVat: 50,
      workDurationDays: 0,
      discountPercent: 0,
      discountEur: 0,
      totalPriceVatBeforeDiscount: 50,
      totalPriceVat0BeforeDiscount: 50,
      createdAt: new Date(2026, 0, 1),
      lines: [],
      structureLines: [next],
      formSnapshot: {
        formId: 'f',
        formVersion: 1,
        fields: [],
        urakkakorttiRivihinnat: { l1: 50, other: 12 },
      },
    });
    expect(saved.structureLines?.[0].priceRefreshed).toBeUndefined();
    expect(saved.structureLines?.[0].contractPriceVat0).toBe(800);
    expect(saved.formSnapshot?.urakkakorttiRivihinnat).toEqual({ other: 12 });
  });

  test('Päivitä hinta pois päältä ei korvaa hintaa eikä yliajoa', () => {
    const overridden = patchStructureLine(line({ contractPriceVat0: 100, unitPriceVat0: 90 }), {
      contractPriceVat0: 50,
      unitPriceVat0: 40,
    });
    const next = applyFormResultToLine(overridden, result, { maali: 'sama' }, 7, { refreshPrices: false });
    expect(next.contractPriceVat0).toBe(50);
    expect(next.unitPriceVat0).toBe(40);
    expect(next.overrides).toEqual(expect.arrayContaining(['contractPrice', 'unitPrice']));
    expect(next.priceRefreshed).toBeUndefined();
    expect(next.fieldValues.maali).toBe('sama');

    const kept = applyFormResultToLine(overridden, result, { maali: 'sama' }, 7);
    const cardOf = (structureLine: StructureLine) => {
      const saved = applyRefreshedStructurePrices(
        record({}, {
          structureLines: [structureLine],
          formSnapshot: { formId: 'f', formVersion: 1, fields: [], urakkakorttiRivihinnat: { l1: 61 } },
        }),
      );
      expect(saved.formSnapshot?.urakkakorttiRivihinnat).toEqual({ l1: 61 });
      expect(cardHeaderPrices(saved, undefined).alihankkija).toBe(61);
      const html = renderUrakkakorttiHtml(buildUrakkakorttiContext({ ...input(saved), record: saved }));
      expect(html).toContain('61,00');
      expect(html).not.toContain('800,00');
    };
    cardOf(next);
    cardOf(kept);
  });

  test('lisätiedot säilyvät lomakkeen jälkeen', () => {
    const next = applyFormResultToLine(line({ additionalInfo: 'Telineet' }), result, { maali: 'x' }, 7);
    expect(next.additionalInfo).toBe('Telineet');
  });

  test('lisätietojen muokkaus ei aseta hintayliajoa', () => {
    const next = patchStructureLine(line(), { additionalInfo: '  Huom  ' });
    expect(next.additionalInfo).toBe('Huom');
    expect(next.overrides).toEqual([]);
  });

  test('nimen muokkaus säilyy lomakkeen jälkeen ilman yliajoa', () => {
    const renamed = patchStructureLine(line(), { name: 'Pihan maalaus' });
    expect(renamed.name).toBe('Pihan maalaus');
    expect(renamed.overrides).toEqual([]);
    const next = applyFormResultToLine(renamed, result, { maali: 'x' }, 7);
    expect(next.name).toBe('Pihan maalaus');
    expect(next.unitPriceVat0).toBe(3393.52);
  });

  test('keskeneräinen tallennus säilyttää kentät ilman että lomake merkitään valmiiksi', () => {
    const next = saveIncompleteFormToLine(line({ unitPriceVat0: 100 }), { pinta: '12' });
    expect(next.fieldValues).toEqual({ pinta: '12' });
    expect(next.formFilled).toBe(false);
    expect(next.unitPriceVat0).toBe(100);
  });
});
