import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';

import { MaterialQuantitiesEditor } from '@/src/components/calculation/MaterialQuantitiesEditor';
import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
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

function lineWithMaterial(id: string, productName: string): StructureLine {
  const row: MaterialQuantityRow = {
    id: `row-${id}`,
    productName,
    quantity: 1,
    unit: 'l',
    source: 'manual',
  };
  return { ...line(id, 's1', `Rakenne ${id}`), materialQuantities: [row] };
}

function textInOrder(node: ReactTestInstance): string[] {
  const out: string[] = [];
  function walk(current: ReactTestInstance) {
    if (current.type === Text) {
      const children = current.props.children;
      if (typeof children === 'string') out.push(children);
      else if (Array.isArray(children)) {
        for (const child of children) {
          if (typeof child === 'string') out.push(child);
        }
      }
    }
    for (const child of current.children) {
      if (typeof child !== 'string') walk(child);
    }
  }
  walk(node);
  return out;
}

function materialSections(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAllByType(View).filter((node) => node.props?.testID === 'structure-materials');
}

function cardOf(materials: ReactTestInstance): ReactTestInstance {
  let node = materials;
  while (node.parent) {
    if (materialSections(node.parent).length > 1) return node;
    node = node.parent;
  }
  return node;
}

describe('materials inside structure cards', () => {
  it('renders each line’s materials below Yhteensä in that card only', () => {
    const tree = renderScreen(
      <>
        <StructureLineCard
          line={lineWithMaterial('l1', 'Maali A')}
          onChange={() => undefined}
          onDelete={() => undefined}
        />
        <StructureLineCard
          line={line('l2', 's2', 'Rakenne B')}
          onChange={() => undefined}
          onDelete={() => undefined}
        />
      </>,
    );
    const sections = materialSections(tree.root);
    expect(sections).toHaveLength(2);

    const withMaterial = textInOrder(cardOf(sections[0]));
    const empty = textInOrder(cardOf(sections[1]));
    const values = (node: ReactTestInstance) =>
      node.findAllByType(TextInput).map((input) => String(input.props.value ?? ''));
    expect(withMaterial.indexOf('Yhteensä')).toBeGreaterThanOrEqual(0);
    expect(withMaterial.indexOf('Yhteensä')).toBeLessThan(withMaterial.indexOf('Materiaalit (urakkakortti)'));
    expect(values(cardOf(sections[0]))).toContain('Maali A');
    expect(empty.indexOf('Yhteensä')).toBeLessThan(empty.indexOf('Lisää materiaali'));
    expect(values(cardOf(sections[1]))).not.toContain('Maali A');
    expect(empty).not.toContain('Materiaalit (urakkakortti)');
  });

  it('adds and removes materialQuantities on the same structure line', () => {
    function Harness() {
      const [lines, setLines] = useState([lineWithMaterial('l1', 'Maali A'), line('l2', 's2', 'Rakenne B')]);
      return (
        <>
          {lines.map((item) => (
            <StructureLineCard
              key={item.id}
              line={item}
              onChange={(next) =>
                setLines((current) => current.map((row) => (row.id === next.id ? next : row)))
              }
              onDelete={() => undefined}
            />
          ))}
        </>
      );
    }
    const tree = renderScreen(<Harness />);
    const removes = () =>
      tree.root.findAll(
        (node) =>
          node.props?.accessibilityLabel === 'Poista materiaali' && typeof node.props.onPress === 'function',
      );
    expect(removes()).toHaveLength(1);

    let add: ReactTestInstance | null =
      materialSections(tree.root)[1]
        .findAllByType(Text)
        .find((node) => node.props.children === 'Lisää materiaali') ?? null;
    while (add && typeof add.props.onPress !== 'function') add = add.parent;
    if (!add) throw new Error('Lisää materiaali button missing on the second card');
    act(() => {
      add.props.onPress();
    });

    expect(removes()).toHaveLength(2);
    const sections = materialSections(tree.root);
    const values = (node: ReactTestInstance) =>
      node.findAllByType(TextInput).map((input) => String(input.props.value ?? ''));
    expect(values(cardOf(sections[0]))).toContain('Maali A');
    expect(values(cardOf(sections[1]))).not.toContain('Maali A');
    expect(textInOrder(cardOf(sections[1]))).toContain('Materiaalit (urakkakortti)');

    act(() => {
      removes()[0].props.onPress();
    });
    const after = materialSections(tree.root);
    expect(values(cardOf(after[0]))).not.toContain('Maali A');
    expect(textInOrder(cardOf(after[1]))).toContain('Materiaalit (urakkakortti)');
    expect(removes()).toHaveLength(1);
  });
});