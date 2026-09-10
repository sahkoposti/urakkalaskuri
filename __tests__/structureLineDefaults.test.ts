import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import type { ProductStructure } from '../src/core/structure/types';
import {
  emptyManualStructureLine,
  emptyStructureLine,
  isManualStructureId,
  MANUAL_STRUCTURE_ID,
} from '../src/core/structure/types';

function structure(partial: Partial<ProductStructure> = {}): ProductStructure {
  return {
    id: 's1',
    name: 'Ulkoverhoilun maalaus',
    unit: 'm²',
    form: normalizeFormDefinition(createMinimalFormDefinition()),
    commissionPercent: 7,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('emptyStructureLine', () => {
  test('kopioi rakenteen lisätiedot ja oletushinnat ilman yliajo-lippuja', () => {
    const line = emptyStructureLine({
      id: 'l1',
      structure: structure({
        defaultAdditionalInfo: '  Sisältää telineet  ',
        defaultUnitPriceVat0: 1200,
        defaultContractPriceVat0: 800,
        defaultMaterialsVat0: 150,
      }),
      vatPercent: 25.5,
    });
    expect(line.structureId).toBe('s1');
    expect(line.name).toBe('Ulkoverhoilun maalaus');
    expect(line.unit).toBe('m²');
    expect(line.additionalInfo).toBe('Sisältää telineet');
    expect(line.unitPriceVat0).toBe(1200);
    expect(line.contractPriceVat0).toBe(800);
    expect(line.materialsVat0).toBe(150);
    expect(line.commissionPercent).toBe(7);
    expect(line.overrides).toEqual([]);
    expect(line.formFilled).toBe(false);
  });

  test('ilman oletuksia hinnat ovat nollia ja lisätiedot puuttuvat', () => {
    const line = emptyStructureLine({
      id: 'l1',
      structure: structure(),
      vatPercent: 25.5,
    });
    expect(line.unitPriceVat0).toBe(0);
    expect(line.contractPriceVat0).toBe(0);
    expect(line.materialsVat0).toBe(0);
    expect(line.additionalInfo).toBeUndefined();
  });
});

describe('emptyManualStructureLine', () => {
  test('luo tyhjän rivin ilman lomakepohjaa', () => {
    const line = emptyManualStructureLine({ id: 'm1', vatPercent: 25.5 });
    expect(isManualStructureId(line.structureId)).toBe(true);
    expect(line.structureId).toBe(MANUAL_STRUCTURE_ID);
    expect(line.name).toBe('Tuoterakenne');
    expect(line.unitPriceVat0).toBe(0);
    expect(line.contractPriceVat0).toBe(0);
    expect(line.materialsVat0).toBe(0);
    expect(line.additionalInfo).toBeUndefined();
    expect(line.formFilled).toBe(false);
    expect(line.overrides).toEqual([]);
  });
});
