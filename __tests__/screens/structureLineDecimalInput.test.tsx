import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';

import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
import type { StructureLine } from '@/src/core/models/types';
import { formatCurrency } from '@/src/core/utils/formatters';
import {
  linePricesIncludeVat,
  lineTotalVat0,
  toCardAmount,
  withDerivedLinePricing,
} from '@/src/core/structure/linePricing';

import { line } from '../pdfFixtures';
import { renderScreen } from './renderScreen';

function findInputByLabel(root: ReactTestInstance, label: string): ReactTestInstance {
  const labelNode = root.findAllByType(Text).find((node) => node.props.children === label);
  if (!labelNode) throw new Error(`Kenttä ${label} puuttuu`);
  let parent: ReactTestInstance | null = labelNode.parent;
  while (parent) {
    const inputs = parent.findAllByType(TextInput);
    if (inputs.length === 1) return inputs[0];
    parent = parent.parent;
  }
  throw new Error(`Syöte kentälle ${label} puuttuu`);
}

function totalOnCard(root: ReactTestInstance): string {
  const totalLabel = root.findAllByType(Text).find((node) => node.props.children === 'Yhteensä');
  if (!totalLabel?.parent) throw new Error('Yhteensä puuttuu');
  const valueNode = totalLabel.parent
    .findAllByType(Text)
    .find((node) => typeof node.props.children === 'string' && node.props.children.includes('€'));
  if (!valueNode) throw new Error('Yhteensä-summa puuttuu');
  return String(valueNode.props.children);
}

function fictionalLine(overrides: Partial<StructureLine> = {}): StructureLine {
  return {
    ...line('line_dec_fixture', 's1', 'Fiktiivinen rakenne'),
    unitPriceVat0: 1000,
    materialsVat0: 200,
    contractPriceVat0: 800,
    quantity: 1,
    discountPercent: 0,
    ...overrides,
  };
}

describe('StructureLineCard decimal inputs', () => {
  it('sets each price field to zero when cleared and zeroes Yhteensä after hinta', () => {
    let current = fictionalLine();
    function Harness() {
      const [row, setRow] = useState(current);
      return (
        <StructureLineCard
          line={row}
          onChange={(next) => {
            current = next;
            setRow(next);
          }}
          onDelete={() => undefined}
        />
      );
    }
    const base = fictionalLine();
    const tree = renderScreen(<Harness />);
    const expectedTotal = formatCurrency(
      toCardAmount(lineTotalVat0(base), linePricesIncludeVat(base), base.vatPercent),
    );
    expect(totalOnCard(tree.root)).toBe(expectedTotal);

    act(() => {
      findInputByLabel(tree.root, 'Hinta €').props.onChangeText('');
    });
    expect(findInputByLabel(tree.root, 'Hinta €').props.value).toBe('');
    expect(current.unitPriceVat0).toBe(0);
    expect(totalOnCard(tree.root)).toBe(formatCurrency(toCardAmount(0, linePricesIncludeVat(base), base.vatPercent)));

    act(() => {
      findInputByLabel(tree.root, 'Materiaalit €').props.onChangeText('200,00');
    });
    act(() => {
      findInputByLabel(tree.root, 'Materiaalit €').props.onChangeText('');
    });
    expect(findInputByLabel(tree.root, 'Materiaalit €').props.value).toBe('');
    expect(current.materialsVat0).toBe(0);

    act(() => {
      findInputByLabel(tree.root, 'Urakkahinta € (alv0)').props.onChangeText('800,00');
    });
    act(() => {
      findInputByLabel(tree.root, 'Urakkahinta € (alv0)').props.onChangeText('');
    });
    expect(findInputByLabel(tree.root, 'Urakkahinta € (alv0)').props.value).toBe('');
    expect(current.contractPriceVat0).toBe(0);
  });

  it('shows määrä error when cleared, blocks validity, and accepts explicit zero', () => {
    const validity: Record<string, boolean> = {};
    let current = fictionalLine({ quantity: 2 });
    function Harness() {
      const [row, setRow] = useState(current);
      return (
        <StructureLineCard
          line={row}
          onChange={(next) => {
            current = next;
            setRow(next);
          }}
          onDelete={() => undefined}
          onValidityChange={(lineId, valid) => {
            validity[lineId] = valid;
          }}
        />
      );
    }
    const tree = renderScreen(<Harness />);
    const quantityInput = findInputByLabel(tree.root, 'Määrä');
    expect(validity.line_dec_fixture).toBe(true);
    expect(current.quantity).toBe(2);

    act(() => {
      quantityInput.props.onChangeText('');
    });
    expect(quantityInput.props.value).toBe('');
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Anna määrä')).toBe(true);
    expect(validity.line_dec_fixture).toBe(false);
    expect(current.quantity).toBe(2);

    act(() => {
      quantityInput.props.onChangeText('3');
    });
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Anna määrä')).toBe(false);
    expect(validity.line_dec_fixture).toBe(true);
    expect(current.quantity).toBe(3);

    act(() => {
      quantityInput.props.onChangeText('0');
    });
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Anna määrä')).toBe(false);
    expect(validity.line_dec_fixture).toBe(true);
    expect(current.quantity).toBe(0);
  });

  it('does not accept a minus sign in määrä', () => {
    const tree = renderScreen(
      <StructureLineCard
        line={fictionalLine({ quantity: 2 })}
        onChange={() => undefined}
        onDelete={() => undefined}
      />,
    );
    const quantityInput = findInputByLabel(tree.root, 'Määrä');
    act(() => {
      quantityInput.props.onChangeText('-2');
    });
    expect(quantityInput.props.value).toBe('2');
    expect(String(quantityInput.props.value)).not.toContain('-');
  });

  it('confirms clearing hinta does not keep the previous unit price', () => {
    let current = fictionalLine();
    const onChange = jest.fn((next: StructureLine) => {
      current = next;
    });
    const tree = renderScreen(
      <StructureLineCard line={current} onChange={onChange} onDelete={() => undefined} />,
    );
    act(() => {
      findInputByLabel(tree.root, 'Hinta €').props.onChangeText('');
    });
    expect(onChange).toHaveBeenCalled();
    expect(current.unitPriceVat0).toBe(0);
    expect(withDerivedLinePricing(current).marginEur).not.toBe(
      withDerivedLinePricing(fictionalLine()).marginEur,
    );
  });
});