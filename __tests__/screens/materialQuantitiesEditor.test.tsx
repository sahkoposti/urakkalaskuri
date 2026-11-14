import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';

import { MaterialQuantitiesEditor } from '@/src/components/calculation/MaterialQuantitiesEditor';
import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
import type { MaterialQuantityRow, StructureLine } from '@/src/core/models/types';

import { line } from '../pdfFixtures';
import { renderScreen } from './renderScreen';

jest.mock('@/src/components/ConfirmDialog', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    ConfirmDialog: ({
      visible,
      title,
      message,
      buttons,
    }: {
      visible: boolean;
      title: string;
      message: string;
      buttons: { title: string; onPress: () => void }[];
    }) =>
      visible
        ? React.createElement(
            View,
            { testID: 'confirm-dialog' },
            React.createElement(Text, null, title),
            React.createElement(Text, null, message),
            buttons.map((button) =>
              React.createElement(
                Pressable,
                { key: button.title, onPress: button.onPress, accessibilityLabel: `confirm-${button.title}` },
                React.createElement(Text, null, button.title),
              ),
            ),
          )
        : null,
  };
});

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
      <MaterialQuantitiesEditor
        lines={[{ line: fictionalMaterialLine() }]}
        products={[]}
        onChangeLine={() => undefined}
      />,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('places määrä and yksikkö inputs in a single horizontal row', () => {
    const tree = renderScreen(
      <MaterialQuantitiesEditor
        lines={[{ line: fictionalMaterialLine() }]}
        products={[]}
        onChangeLine={() => undefined}
      />,
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
      return (
        <MaterialQuantitiesEditor lines={[{ line: current }]} products={[]} onChangeLine={setCurrent} />
      );
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

function pressLabeled(root: ReactTestInstance, label: string) {
  const matches = root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props.onPress === 'function',
  );
  const target = matches[0];
  if (!target) throw new Error(`${label} puuttuu`);
  act(() => {
    target.props.onPress();
  });
}

describe('materials after the structure cards', () => {
  it('keeps cards free of materials and shows one merged section after them', () => {
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
        <MaterialQuantitiesEditor
          lines={[{ line: lineWithMaterial('l1', 'Maali A') }, { line: line('l2', 's2', 'Rakenne B') }]}
          products={[]}
          onChangeLine={() => undefined}
        />
      </>,
    );
    const cards = tree.root.findAllByType(View).filter((node) => textInOrder(node).includes('Yhteensä') && !textInOrder(node).includes('Materiaalit (urakkakortti)'));
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const card of cards) {
      expect(textInOrder(card)).not.toContain('Materiaalit (urakkakortti)');
      expect(textInOrder(card)).not.toContain('Lisää materiaali');
    }
    const sections = materialSections(tree.root);
    expect(sections).toHaveLength(1);
    const sectionText = textInOrder(sections[0]);
    expect(sectionText.indexOf('Materiaalit (urakkakortti)')).toBeGreaterThanOrEqual(0);
    expect(sectionText.indexOf('Materiaalit (urakkakortti)')).toBeLessThan(sectionText.indexOf('Lisää materiaali'));
    const values = sections[0].findAllByType(TextInput).map((input) => String(input.props.value ?? ''));
    expect(values).toContain('Maali A');
  });

  it('adds a manual row on the last line and removes it from that line', () => {
    function Harness() {
      const [lines, setLines] = useState([lineWithMaterial('l1', 'Maali A'), line('l2', 's2', 'Rakenne B')]);
      return (
        <MaterialQuantitiesEditor
          lines={lines.map((item) => ({ line: item }))}
          products={[]}
          onChangeLine={(next) => setLines((current) => current.map((row) => (row.id === next.id ? next : row)))}
        />
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
      materialSections(tree.root)[0]
        .findAllByType(Text)
        .find((node) => node.props.children === 'Lisää materiaali') ?? null;
    while (add && typeof add.props.onPress !== 'function') add = add.parent;
    if (!add) throw new Error('Lisää materiaali puuttuu');
    act(() => {
      add.props.onPress();
    });
    expect(removes()).toHaveLength(2);
    const values = () =>
      materialSections(tree.root)[0].findAllByType(TextInput).map((input) => String(input.props.value ?? ''));
    expect(values()).toContain('Maali A');
    expect(values()).toContain('');
    expect(textInOrder(materialSections(tree.root)[0])).toContain('Rakenne');
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.props?.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('Rakenne:'),
      )[0]?.props.accessibilityLabel,
    ).toBe('Rakenne: Rakenne B');

    act(() => {
      removes()[0].props.onPress();
    });
    expect(values()).not.toContain('Maali A');
    expect(removes()).toHaveLength(1);
  });

  it('stores a new manual row on the only structure without a line chooser', () => {
    function Harness() {
      const [current, setCurrent] = useState(line('l1', 's1', 'Ainoa'));
      return <MaterialQuantitiesEditor lines={[{ line: current }]} products={[]} onChangeLine={setCurrent} />;
    }
    const tree = renderScreen(<Harness />);
    let add: ReactTestInstance | null =
      materialSections(tree.root)[0]
        .findAllByType(Text)
        .find((node) => node.props.children === 'Lisää materiaali') ?? null;
    while (add && typeof add.props.onPress !== 'function') add = add.parent;
    if (!add) throw new Error('Lisää materiaali puuttuu');
    act(() => {
      add.props.onPress();
    });
    const section = materialSections(tree.root)[0];
    expect(textInOrder(section)).not.toContain('Rakenne');
    expect(section.findAllByType(TextInput).some((input) => input.props.value === '')).toBe(true);
  });

  it('edits one contribution from Erittely and deletes every contribution after confirm', () => {
    function Harness() {
      const [lines, setLines] = useState([
        lineWithMaterial('l1', 'Maali'),
        {
          ...line('l2', 's2', 'Rakenne B'),
          materialQuantities: [
            { id: 'row-l2', productName: 'Maali', quantity: 3, unit: 'l', source: 'manual' as const },
          ],
        },
      ]);
      return (
        <MaterialQuantitiesEditor
          lines={lines.map((item) => ({ line: item }))}
          products={[]}
          onChangeLine={(next) => setLines((current) => current.map((row) => (row.id === next.id ? next : row)))}
        />
      );
    }
    const tree = renderScreen(<Harness />);
    expect(tree.root.findByProps({ testID: 'material-readonly-qty' }).props.children).toBe('4');
    pressLabeled(tree.root, 'Erittely');
    const contributions = tree.root
      .findAllByType(View)
      .filter((node) => node.props?.testID === 'material-contribution');
    expect(contributions).toHaveLength(2);
    const firstQuantity = contributions[0].findAllByType(TextInput).find((input) => input.props.value === '1');
    if (!firstQuantity) throw new Error('ensimmäisen rakenteen määrä puuttuu');
    act(() => {
      firstQuantity.props.onChangeText('6');
    });
    expect(tree.root.findByProps({ testID: 'material-readonly-qty' }).props.children).toBe('9');

    pressLabeled(tree.root, 'Poista materiaali');
    pressLabeled(tree.root, 'confirm-Poista');
    expect(materialSections(tree.root)[0].findAllByType(TextInput).map((input) => input.props.value)).not.toContain('Maali');
  });

  it('does not write saved rows when the section only renders', () => {
    const saved = lineWithMaterial('l1', 'Maali A');
    const onChangeLine = jest.fn();
    renderScreen(
      <MaterialQuantitiesEditor lines={[{ line: saved }]} products={[]} onChangeLine={onChangeLine} />,
    );
    expect(onChangeLine).not.toHaveBeenCalled();
    expect(saved.materialQuantities?.[0]).toMatchObject({ productName: 'Maali A', quantity: 1, unit: 'l' });
  });
});