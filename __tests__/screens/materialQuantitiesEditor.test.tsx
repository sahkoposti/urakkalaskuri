import { useState } from 'react';
import { TextInput } from 'react-native';
import { act } from 'react-test-renderer';

import { MaterialQuantitiesEditor } from '@/src/components/calculation/MaterialQuantitiesEditor';
import type { MaterialQuantityRow, StructureLine } from '@/src/core/models/types';

import { line } from '../pdfFixtures';
import { renderScreen } from './renderScreen';

function fictionalMaterialLine(): StructureLine {
  const row: MaterialQuantityRow = {
    id: 'mat_fixture_row_1',
    productName: 'Fiktiivinen maali',
    quantity: 2.5,
    unit: 'l',
    source: 'manual',
  };
  return {
    ...line('line_mat_fixture', 's1', 'Fiktiivinen rakenne'),
    materialQuantities: [row],
  };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style || typeof style !== 'object') return {};
  const entries = Array.isArray(style) ? style : [style];
  return entries.reduce<Record<string, unknown>>((acc, item) => {
    if (item && typeof item === 'object') return { ...acc, ...(item as Record<string, unknown>) };
    return acc;
  }, {});
}

describe('MaterialQuantitiesEditor screen layout', () => {
  it('matches snapshot with määrä and yksikkö on one row', () => {
    const tree = renderScreen(
      <MaterialQuantitiesEditor line={fictionalMaterialLine()} products={[]} onChange={() => undefined} />,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('places määrä and yksikkö inputs in a single horizontal row', () => {
    const tree = renderScreen(
      <MaterialQuantitiesEditor line={fictionalMaterialLine()} products={[]} onChange={() => undefined} />,
    );
    const row = tree.root.findByProps({ testID: 'material-qty-unit-row' });
    expect(flattenStyle(row.props.style).flexDirection).toBe('row');

    const inputs = row.findAllByType(TextInput);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.props.value).toBe('2,5');
    expect(inputs[1]?.props.value).toBe('l');
  });

  it('commits edited määrä and yksikkö through onChange', () => {
    function Harness() {
      const [current, setCurrent] = useState(fictionalMaterialLine());
      return <MaterialQuantitiesEditor line={current} products={[]} onChange={setCurrent} />;
    }
    const tree = renderScreen(<Harness />);
    const row = tree.root.findByProps({ testID: 'material-qty-unit-row' });
    const [quantityInput, unitInput] = row.findAllByType(TextInput);

    act(() => {
      quantityInput.props.onChangeText('7,25');
    });
    act(() => {
      unitInput.props.onChangeText('kg');
    });

    const inputsAfter = tree.root.findByProps({ testID: 'material-qty-unit-row' }).findAllByType(TextInput);
    expect(inputsAfter[0]?.props.value).toBe('7,25');
    expect(inputsAfter[1]?.props.value).toBe('kg');
  });
});