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
  const keys = collectPreventRemoveRouteKeys(navigation, routeKey);
  return keys.find((key) => navigationHasRouteKey(navigation, key)) ?? keys[0];
}

/**
 * Expo Routerin useRoute().key ei aina ole sama kuin native-stackin reitti.
 * Kokeile avaimet sisäkkäisistä navigaattoreista, jotta preventRemove rekisteröityy.
 */
export function collectPreventRemoveRouteKeys(
  navigation: NavigationLike | undefined,
  routeKey: string,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key?: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  add(routeKey);
  let current = navigation;
  while (current) {
    const state = current.getState?.();
    const routes = state?.routes;
    if (Array.isArray(routes) && routes.length > 0) {
      add(routes[state?.index ?? 0]?.key);
      for (const route of routes) add(route.key);
    }
    current = current.getParent?.();
  }
  return keys;
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
): boolean {
  if (!routeKey) return false;
  try {
    setPreventRemove(id, routeKey, preventRemove);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Couldn't find a route")) {
      return false;
    }
    throw error;
  }
}

/** Rekisteröi preventRemove ensimmäisellä avaimella, jonka provider tuntee. */
export function registerPreventRemove(
  setPreventRemove: (id: string, routeKey: string, preventRemove: boolean) => void,
  id: string,
  candidateKeys: string[],
  preventRemove: boolean,
  previousKey?: string,
): string | undefined {
  if (!preventRemove) {
    const key = previousKey ?? candidateKeys[0];
    if (key) safeSetPreventRemove(setPreventRemove, id, key, false);
    return undefined;
  }

  for (const key of candidateKeys) {
    if (safeSetPreventRemove(setPreventRemove, id, key, true)) {
      return key;
    }
  }
  return undefined;
}
