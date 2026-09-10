import {
  navigationHasRouteKey,
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

  test('returns undefined when navigation has no routes', () => {
    expect(resolvePreventRemoveRouteKey({ getState: () => undefined }, 'x')).toBeUndefined();
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
    expect(() => safeSetPreventRemove(setPreventRemove, 'id-1', 'products/[id]-abc', true)).not.toThrow();
  });

  test('rethrows unrelated errors', () => {
    const setPreventRemove = jest.fn(() => {
      throw new Error('boom');
    });
    expect(() => safeSetPreventRemove(setPreventRemove, 'id-1', 'route-1', true)).toThrow('boom');
  });
});
