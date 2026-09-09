import type { FormDefinition } from '../src/core/form/types';
import { isStructureFormFullyFilled } from '../src/core/wizard/wizardPageHelpers';

const form: FormDefinition = {
  id: 'f',
  name: 'Testi',
  version: 1,
  updatedAt: 0,
  pages: [
    {
      id: 'page_surfaces',
      title: 'Pinta-alat',
      sortOrder: 0,
      fieldIds: ['field_pinta'],
    },
    {
      id: 'page_notes',
      title: 'Lisätiedot',
      sortOrder: 1,
      fieldIds: ['field_notes'],
    },
  ],
  fields: [
    {
      id: 'field_pinta',
      key: 'pinta',
      label: 'Pinta-ala',
      type: 'number',
      required: true,
      showOnSummary: true,
    },
    {
      id: 'field_notes',
      key: 'notes',
      label: 'Huomiot',
      type: 'text',
      required: false,
      showOnSummary: false,
    },
  ],
};

describe('isStructureFormFullyFilled', () => {
  test('is incomplete until required fields are filled', () => {
    expect(isStructureFormFullyFilled(form, {})).toBe(false);
    expect(isStructureFormFullyFilled(form, { notes: 'kesken' })).toBe(false);
  });

  test('is complete when every required visible field has a value', () => {
    expect(isStructureFormFullyFilled(form, { pinta: '12' })).toBe(true);
  });
});
