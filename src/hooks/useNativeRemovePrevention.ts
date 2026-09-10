import { useNavigation, usePreventRemoveContext, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useId, useInsertionEffect, useRef } from 'react';

import {
  collectPreventRemoveRouteKeys,
  registerPreventRemove,
} from '@/src/hooks/safeSetPreventRemove';

/** Estää native-stackin ele-/laitteistopalun, jotta JS ehtii kysyä vahvistuksen. */
export function useNativeRemovePrevention(prevent: boolean) {
  const navigation = useNavigation();
  const { key: routeKey } = useRoute();
  const { setPreventRemove, notifyPreventRemove } = usePreventRemoveContext();
  const preventId = useId();
  const registeredRouteKeyRef = useRef<string | undefined>(undefined);

  const applyPreventRemove = useCallback(
    (nextPrevent: boolean) => {
      registeredRouteKeyRef.current = registerPreventRemove(
        setPreventRemove,
        preventId,
        collectPreventRemoveRouteKeys(navigation, routeKey),
        nextPrevent,
        registeredRouteKeyRef.current,
      );
    },
    [navigation, preventId, routeKey, setPreventRemove],
  );

  useInsertionEffect(() => {
    applyPreventRemove(prevent);
    return () => {
      applyPreventRemove(false);
    };
  }, [applyPreventRemove, prevent]);

  useEffect(() => {
    notifyPreventRemove();
    return () => {
      notifyPreventRemove();
    };
  }, [preventId, routeKey, prevent, notifyPreventRemove]);

  return applyPreventRemove;
}
