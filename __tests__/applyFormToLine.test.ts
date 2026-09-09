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

  test('keskeneräinen tallennus säilyttää kentät ilman että lomake merkitään valmiiksi', () => {
    const next = saveIncompleteFormToLine(line({ unitPriceVat0: 100 }), { pinta: '12' });
    expect(next.fieldValues).toEqual({ pinta: '12' });
    expect(next.formFilled).toBe(false);
    expect(next.unitPriceVat0).toBe(100);
  });
});
