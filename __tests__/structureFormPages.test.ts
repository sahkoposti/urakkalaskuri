import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { hasStructureFormPages, isStructureFormIncomplete, structureFormPages } from '../src/core/structure/formPages';
import { MANUAL_STRUCTURE_ID } from '../src/core/structure/types';

describe('structureFormPages', () => {
  test('ohittaa tyhjän asiakassivun ja näyttää sisältösivut', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const pages = structureFormPages(form);
    expect(pages.some((page) => page.system === 'customer')).toBe(false);
    expect(pages.length).toBeGreaterThan(0);
    expect(hasStructureFormPages(form)).toBe(true);
  });

  test('piilottaa hammasrattaan jos vain tyhjä asiakassivu', () => {
    const form = normalizeFormDefinition({
      id: 'empty',
      name: 'Tyhjä',
      version: 1,
      pages: [{ id: 'page_customer', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: [] }],
      fields: [],
      updatedAt: 0,
    });
    expect(hasStructureFormPages(form)).toBe(false);
  });

  test('keskeneräinen lomake vaatii sivuja ja formFilled=false', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    expect(isStructureFormIncomplete({ formFilled: false, structureId: 's1' }, { form })).toBe(true);
    expect(isStructureFormIncomplete({ formFilled: true, structureId: 's1' }, { form })).toBe(false);
    expect(
      isStructureFormIncomplete(
        { formFilled: false, structureId: 's1' },
        {
          form: normalizeFormDefinition({
            id: 'empty',
            name: 'Tyhjä',
            version: 1,
            pages: [
              { id: 'page_customer', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: [] },
            ],
            fields: [],
            updatedAt: 0,
          }),
        },
      ),
    ).toBe(false);
    expect(
      isStructureFormIncomplete({ formFilled: false, structureId: MANUAL_STRUCTURE_ID }, { form }),
    ).toBe(false);
  });
});
