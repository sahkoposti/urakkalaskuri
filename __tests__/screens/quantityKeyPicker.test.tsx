import * as ExpoRouter from 'expo-router';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';

import FormFieldEditorScreen from '@/app/settings/calculation/fields/[fieldId]';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import type { FormField } from '@/src/core/form/types';
import { structure } from '../pdfFixtures';

import { mockFixtureApp, SCREEN_FIXED_DATE } from './fixtures';
import { renderScreen } from './renderScreen';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.label ?? partial.key, required: false, showOnSummary: false, ...partial };
}

const waxForm = normalizeFormDefinition({
  id: 'wax-form',
  name: 'Vahaus',
  version: 1,
  updatedAt: 1,
  pages: [{ id: 'tyo', title: 'Työ', sortOrder: 0, fieldIds: ['wax', 'vq'] }],
  fields: [
    field({
      id: 'wax',
      key: 'vahaus',
      type: 'product_select',
      label: 'Vahaus',
      print: { urakkakortti: { group: 'muuta', quantityKey: 'vahan_maara' } },
    }),
    field({ id: 'vq', key: 'vahan_maara', type: 'number', unit: 'litraa', label: 'Vahan määrä' }),
  ],
});

describe('form field editor quantity picker', () => {
  const structures = mockFixtureApp.structures;
  const activeStructureId = mockFixtureApp.activeStructureId;

  afterEach(() => {
    mockFixtureApp.structures = structures;
    mockFixtureApp.activeStructureId = activeStructureId;
  });

  it('shows Määräkenttä for a non-maali product_select on the urakkakortti', () => {
    mockFixtureApp.structures = [
      {
        ...structure('s-wax', 'Vahaus'),
        form: waxForm,
        createdAt: SCREEN_FIXED_DATE,
        updatedAt: SCREEN_FIXED_DATE,
      },
    ];
    mockFixtureApp.activeStructureId = 's-wax';
    jest.mocked(ExpoRouter.useLocalSearchParams).mockReturnValue({
      fieldId: 'wax',
      structureId: 's-wax',
    });

    const tree = renderScreen(<FormFieldEditorScreen />);
    const toggle = tree.root.findAllByType(Text).find((node) => node.props.children === 'Lisäasetukset ▸');
    if (!toggle) throw new Error('Lisäasetukset puuttuu');
    let pressable = toggle.parent;
    while (pressable && typeof pressable.props.onPress !== 'function') pressable = pressable.parent;
    if (!pressable) throw new Error('Lisäasetukset-painike puuttuu');
    act(() => {
      pressable.props.onPress();
    });

    const labels = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .filter((child) => typeof child === 'string');
    expect(labels).toContain('Määräkenttä');
  });
});
