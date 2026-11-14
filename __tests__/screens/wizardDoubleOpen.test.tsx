import * as ExpoRouter from 'expo-router';
import { router } from 'expo-router';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CalculationComposerScreen from '@/app/wizard/index';
import type { PersistedWizardDraft } from '@/src/core/models/types';

import { line } from '../pdfFixtures';
import { SCREEN_FIXED_TIMESTAMP, fixtureWizardDraft, mockFixtureApp } from './fixtures';
import { renderScreen } from './renderScreen';

const LINE_ID = 'line_fixture_nav_1';

function wizardDraftWithStructureLine(): PersistedWizardDraft {
  return {
    ...fixtureWizardDraft,
    structureLines: [line(LINE_ID, 's1', 'Ulkomaalaus')],
    updatedAt: SCREEN_FIXED_TIMESTAMP + 1,
  };
}

function countLineFormPushes(): number {
  return jest.mocked(router.push).mock.calls.filter((call) => {
    const target = call[0] as { pathname?: string };
    return target?.pathname === '/wizard/line/[lineId]';
  }).length;
}

function countCustomerPushes(): number {
  return jest.mocked(router.push).mock.calls.filter((call) => {
    const target = call[0] as { pathname?: string };
    return target?.pathname === '/wizard/customer';
  }).length;
}

function simulateScreenRefocus() {
  for (const [effect] of jest.mocked(ExpoRouter.useFocusEffect).mock.calls) {
    effect();
  }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function pressableAncestor(node: renderer.ReactTestInstance): renderer.ReactTestInstance | null {
  let current: renderer.ReactTestInstance | null = node;
  while (current) {
    if (typeof current.props?.onPress === 'function') return current;
    current = current.parent;
  }
  return null;
}

function findPressableWithText(root: renderer.ReactTestInstance, needle: string): renderer.ReactTestInstance {
  const textNode = root
    .findAllByType(Text)
    .find((node) => flattenText(node.props.children).includes(needle));
  if (!textNode) {
    throw new Error(`Text node "${needle}" not found`);
  }
  const pressable = pressableAncestor(textNode);
  if (!pressable) {
    throw new Error(`Pressable for "${needle}" not found`);
  }
  return pressable;
}

function flattenText(children: unknown): string {
  if (children == null) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenText).join('');
  if (typeof children === 'object' && children !== null && 'props' in children) {
    return flattenText((children as { props: { children?: unknown } }).props.children);
  }
  return '';
}

describe('wizard composer double navigation', () => {
  beforeEach(() => {
    Object.assign(mockFixtureApp, {
      wizardDraft: wizardDraftWithStructureLine(),
    });
  });

  it('pushes the line form route only once when the gear is pressed twice quickly', async () => {
    const tree = renderScreen(<CalculationComposerScreen />);

    const gear = tree.root.findByProps({ accessibilityLabel: 'Avaa lomake' });
    await act(async () => {
      gear.props.onPress();
      gear.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(countLineFormPushes()).toBe(1);
    const linePushes = jest
      .mocked(router.push)
      .mock.calls.filter((call) => (call[0] as { pathname?: string })?.pathname === '/wizard/line/[lineId]');
    expect(linePushes[0]?.[0]).toMatchObject({
      pathname: '/wizard/line/[lineId]',
      params: expect.objectContaining({ lineId: LINE_ID }),
    });
  });

  it('keeps the line form guarded through push then allows a second open after refocus', async () => {
    const tree = renderScreen(<CalculationComposerScreen />);
    const gear = tree.root.findByProps({ accessibilityLabel: 'Avaa lomake' });

    await act(async () => {
      gear.props.onPress();
    });
    await flushMicrotasks();
    expect(countLineFormPushes()).toBe(1);

    await act(() => {
      gear.props.onPress();
    });
    expect(countLineFormPushes()).toBe(1);

    simulateScreenRefocus();
    await act(async () => {
      gear.props.onPress();
    });
    await flushMicrotasks();
    expect(countLineFormPushes()).toBe(2);
  });

  it('pushes the customer route only once when the customer card is pressed twice quickly', async () => {
    const tree = renderScreen(<CalculationComposerScreen />);

    const customerCard = findPressableWithText(tree.root, 'Fiktiivinen Asiakas');
    const onPress = customerCard.props.onPress as () => void;

    await act(async () => {
      onPress();
      onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(countCustomerPushes()).toBe(1);
  });

  it('keeps the customer route guarded through push then allows a second open after refocus', async () => {
    const tree = renderScreen(<CalculationComposerScreen />);
    const customerCard = findPressableWithText(tree.root, 'Fiktiivinen Asiakas');
    const onPress = customerCard.props.onPress as () => void;

    await act(async () => {
      onPress();
    });
    await flushMicrotasks();
    expect(countCustomerPushes()).toBe(1);

    await act(() => {
      onPress();
    });
    expect(countCustomerPushes()).toBe(1);

    simulateScreenRefocus();
    await act(async () => {
      onPress();
    });
    await flushMicrotasks();
    expect(countCustomerPushes()).toBe(2);
  });
});
