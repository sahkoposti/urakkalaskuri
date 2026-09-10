import {
  collectPreventRemoveRouteKeys,
  navigationHasRouteKey,
  registerPreventRemove,
  resolvePreventRemoveRouteKey,
  safeSetPreventRemove,
} from '../src/hooks/safeSetPreventRemove';

describe('navigationHasRouteKey', () => {
  test('finds the route in this navigator or a parent', () => {
    const parent = {
      getState: () => ({ routes: [{ key: 'parent-route' }] }),
    };
    const child = {
      getState: () => ({ routes: [{ key: 'child-route' }] }),
      getParent: () => parent,
    };

    expect(navigationHasRouteKey(child, 'child-route')).toBe(true);
    expect(navigationHasRouteKey(child, 'parent-route')).toBe(true);
    expect(navigationHasRouteKey(child, 'missing')).toBe(false);
  });
});

describe('resolvePreventRemoveRouteKey', () => {
  test('keeps useRoute key when the navigator knows it', () => {
    const navigation = {
      getState: () => ({ index: 0, routes: [{ key: 'screen-a' }] }),
    };
    expect(resolvePreventRemoveRouteKey(navigation, 'screen-a')).toBe('screen-a');
  });

  test('falls back to the focused stack route when useRoute key is unknown', () => {
    const navigation = {
      getState: () => ({
        index: 1,
        routes: [{ key: 'home' }, { key: 'products/[id]-native' }],
      }),
    };
    expect(resolvePreventRemoveRouteKey(navigation, 'expo-router-leaf')).toBe(
      'products/[id]-native',
    );
  });

  test('returns the useRoute key when navigation has no routes', () => {
    expect(resolvePreventRemoveRouteKey({ getState: () => undefined }, 'x')).toBe('x');
  });
});

describe('collectPreventRemoveRouteKeys', () => {
  test('lists useRoute key first, then focused and sibling routes from ancestors', () => {
    const parent = {
      getState: () => ({
        index: 1,
        routes: [{ key: 'home' }, { key: 'wizard-stack' }],
      }),
    };
    const child = {
      getState: () => ({
        index: 0,
        routes: [{ key: 'line-native' }, { key: 'other' }],
      }),
      getParent: () => parent,
    };

    expect(collectPreventRemoveRouteKeys(child, 'expo-leaf')).toEqual([
      'expo-leaf',
      'line-native',
      'other',
      'wizard-stack',
      'home',
    ]);
  });
});

describe('registerPreventRemove', () => {
  test('tries the next candidate when the provider rejects the first key', () => {
    const setPreventRemove = jest.fn((_id: string, routeKey: string) => {
      if (routeKey === 'expo-leaf') {
        throw new Error(
          "Couldn't find a route with the key expo-leaf. Is your component inside NavigationContent?",
        );
      }
    });

    expect(
      registerPreventRemove(setPreventRemove, 'id-1', ['expo-leaf', 'line-native'], true),
    ).toBe('line-native');
    expect(setPreventRemove).toHaveBeenCalledWith('id-1', 'expo-leaf', true);
    expect(setPreventRemove).toHaveBeenCalledWith('id-1', 'line-native', true);
  });

  test('clears the previously registered key', () => {
    const setPreventRemove = jest.fn();
    expect(
      registerPreventRemove(setPreventRemove, 'id-1', ['line-native'], false, 'line-native'),
    ).toBeUndefined();
    expect(setPreventRemove).toHaveBeenCalledWith('id-1', 'line-native', false);
  });
});

describe('safeSetPreventRemove', () => {
  test('forwards a successful registration', () => {
    const setPreventRemove = jest.fn();
    safeSetPreventRemove(setPreventRemove, 'id-1', 'route-1', true);
    expect(setPreventRemove).toHaveBeenCalledWith('id-1', 'route-1', true);
  });

  test('skips when route key is missing', () => {
    const setPreventRemove = jest.fn();
    safeSetPreventRemove(setPreventRemove, 'id-1', undefined, true);
    expect(setPreventRemove).not.toHaveBeenCalled();
  });

  test('swallows PreventRemoveProvider missing-route errors so the editor stays up', () => {
    const setPreventRemove = jest.fn(() => {
      throw new Error(
        "Couldn't find a route with the key products/[id]-abc. Is your component inside NavigationContent?",
      );
    });
    expect(safeSetPreventRemove(setPreventRemove, 'id-1', 'products/[id]-abc', true)).toBe(false);
  });

  test('rethrows unrelated errors', () => {
    const setPreventRemove = jest.fn(() => {
      throw new Error('boom');
    });
    expect(() => safeSetPreventRemove(setPreventRemove, 'id-1', 'route-1', true)).toThrow('boom');
  });
});
