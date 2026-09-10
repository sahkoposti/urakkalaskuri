type NavigationLike = {
  getState?: () =>
    | {
        index?: number;
        routes?: Array<{ key: string }>;
      }
    | undefined;
  getParent?: () => NavigationLike | undefined;
};

export function navigationHasRouteKey(
  navigation: NavigationLike | undefined,
  routeKey: string,
): boolean {
  let current = navigation;
  while (current) {
    const routes = current.getState?.()?.routes;
    if (Array.isArray(routes) && routes.some((route) => route.key === routeKey)) {
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}

/** Native-stackin PreventRemoveProvider heittää, ellei avain ole sen tilassa. */
export function resolvePreventRemoveRouteKey(
  navigation: NavigationLike | undefined,
  routeKey: string,
): string | undefined {
  if (navigationHasRouteKey(navigation, routeKey)) return routeKey;
  const state = navigation?.getState?.();
  return state?.routes?.[state.index ?? 0]?.key;
}

/**
 * Expo Router / native-stack voi antaa useRoute()-avaimen, jota
 * PreventRemoveProvider ei tunne. Heitto kaataisi näytön ensimmäisellä
 * dirty-muutoksella (esim. maalin työkerroin).
 */
export function safeSetPreventRemove(
  setPreventRemove: (id: string, routeKey: string, preventRemove: boolean) => void,
  id: string,
  routeKey: string | undefined,
  preventRemove: boolean,
): void {
  if (!routeKey) return;
  try {
    setPreventRemove(id, routeKey, preventRemove);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Couldn't find a route")) {
      return;
    }
    throw error;
  }
}
