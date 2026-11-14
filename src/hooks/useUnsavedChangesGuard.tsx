import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useSaveToast } from '@/src/context/SaveToastContext';
import { exitStackScreenOptions } from '@/src/hooks/exitStackScreenOptions';
import { useNativeRemovePrevention } from '@/src/hooks/useNativeRemovePrevention';
import { createScreenLeave, LeaveCancelled } from '@/src/core/wizard/screenLeave';

type UseUnsavedChangesGuardOptions = {
  isDirty: boolean;
  onSave?: () => void | Promise<void | boolean>;
  onDiscard?: () => void | Promise<void>;
  title?: string;
  message?: string;
  cancelTitle?: string;
  discardTitle?: string;
  saveTitle?: string;
  /**
   * Likainen lomake tallennetaan poistuttaessa ja sovelluksen mennessä taustalle.
   * Vahvistusdialogia ei näytetä. Tallennuksen `false` jättää käyttäjän sivulle.
   */
  saveOnLeave?: boolean;
  /**
   * Tausta kutsuu `onSave` ilman dialogia. Paluu näyttää dialogin, jos `saveOnLeave` on false.
   */
  saveOnBackground?: boolean;
};

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  onDiscard,
  title = 'Tallentamattomia muutoksia',
  message = 'Haluatko tallentaa muutokset ennen poistumista?',
  cancelTitle = 'Peruuta',
  discardTitle = 'Hylkää',
  saveTitle = 'Tallenna',
  saveOnLeave = false,
  saveOnBackground = false,
}: UseUnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const { showSaved } = useSaveToast();
  const screenLeave = useRef(createScreenLeave()).current;
  const isDirtyRef = useRef(isDirty);
  const onSaveRef = useRef(onSave);
  const onDiscardRef = useRef(onDiscard);
  const saveOnLeaveRef = useRef(saveOnLeave);
  const saveOnBackgroundRef = useRef(saveOnBackground);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  isDirtyRef.current = isDirty;
  onSaveRef.current = onSave;
  onDiscardRef.current = onDiscard;
  saveOnLeaveRef.current = saveOnLeave;
  saveOnBackgroundRef.current = saveOnBackground;

  const shouldPrevent = isDirty && !screenLeave.shouldBypass();
  const applyPreventRemove = useNativeRemovePrevention(shouldPrevent);
  screenLeave.setOnRelease(() => {
    applyPreventRemove(isDirtyRef.current);
  });

  useFocusEffect(
    useCallback(() => {
      screenLeave.reset();
      return () => screenLeave.reset();
    }, [screenLeave]),
  );

  const closeExitDialog = useCallback(() => {
    setExitDialogVisible(false);
    pendingExitRef.current = null;
  }, []);

  const confirmExit = useCallback((onLeave: () => void) => {
    pendingExitRef.current = onLeave;
    setExitDialogVisible(true);
  }, []);

  const leaveWithoutSaving = useCallback(() => {
    void screenLeave.enqueue(async () => {
      await onDiscardRef.current?.();
      screenLeave.allowOnce(() => {
        applyPreventRemove(false);
        const action = pendingExitRef.current;
        closeExitDialog();
        action?.();
      });
    });
  }, [applyPreventRemove, closeExitDialog, screenLeave]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!onSaveRef.current) return false;
    const result = await onSaveRef.current();
    if (result === false) return false;
    showSaved();
    return true;
  }, [showSaved]);

  const saveAndExit = useCallback(() => {
    void screenLeave.enqueue(async () => {
      const saved = await save();
      if (!saved) return;
      screenLeave.allowOnce(() => {
        applyPreventRemove(false);
        const action = pendingExitRef.current;
        closeExitDialog();
        action?.();
      });
    });
  }, [applyPreventRemove, closeExitDialog, save, screenLeave]);

  const saveThenLeave = useCallback(
    (onLeave: () => void) => {
      void screenLeave
        .leave(async () => {
          const result = await onSaveRef.current?.();
          if (result === false) throw new LeaveCancelled();
        }, () => {
          applyPreventRemove(false);
          onLeave();
        })
        .catch((error: unknown) => {
          if (error instanceof LeaveCancelled) return;
          throw error;
        });
    },
    [applyPreventRemove, screenLeave],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (screenLeave.shouldBypass() || !isDirtyRef.current) {
        return;
      }

      event.preventDefault();
      if (saveOnLeaveRef.current) {
        saveThenLeave(() => navigation.dispatch(event.data.action));
        return;
      }
      confirmExit(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [navigation, confirmExit, saveThenLeave, screenLeave]);

  useEffect(() => {
    if (!saveOnLeave && !saveOnBackground) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      void screenLeave.enqueue(async () => {
        if (screenLeave.shouldBypass() || !isDirtyRef.current) return;
        if (!saveOnLeaveRef.current && !saveOnBackgroundRef.current) return;
        await onSaveRef.current?.();
      });
    });
    return () => subscription.remove();
  }, [saveOnLeave, saveOnBackground, screenLeave]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (screenLeave.shouldBypass() || !isDirtyRef.current) {
          return false;
        }

        if (saveOnLeaveRef.current) {
          saveThenLeave(() => router.back());
          return true;
        }
        confirmExit(() => {
          screenLeave.allowOnce(() => {
            applyPreventRemove(false);
            router.back();
          });
        });
        return true;
      });

      return () => subscription.remove();
    }, [applyPreventRemove, confirmExit, saveThenLeave, screenLeave]),
  );

  const allowExit = useCallback(() => {
    screenLeave.allowOnce(() => {
      applyPreventRemove(false);
    });
  }, [applyPreventRemove, screenLeave]);

  const requestExit = useCallback(() => {
    if (screenLeave.shouldBypass() || !isDirtyRef.current) {
      screenLeave.allowOnce(() => {
        applyPreventRemove(false);
        router.back();
      });
      return;
    }
    if (saveOnLeaveRef.current) {
      saveThenLeave(() => router.back());
      return;
    }
    confirmExit(() => {
      screenLeave.allowOnce(() => {
        applyPreventRemove(false);
        router.back();
      });
    });
  }, [applyPreventRemove, confirmExit, saveThenLeave, screenLeave]);

  const stackScreenOptions = exitStackScreenOptions(requestExit, shouldPrevent);

  useLayoutEffect(() => {
    navigation.setOptions(stackScreenOptions);
  }, [navigation, stackScreenOptions]);

  const exitDialog = (
    <ConfirmDialog
      visible={exitDialogVisible}
      title={title}
      message={message}
      onClose={closeExitDialog}
      buttons={[
        {
          title: cancelTitle,
          variant: 'outlined',
          onPress: closeExitDialog,
        },
        {
          title: discardTitle,
          variant: 'destructive',
          onPress: leaveWithoutSaving,
        },
        {
          title: saveTitle,
          variant: 'primary',
          onPress: () => {
            void saveAndExit();
          },
        },
      ]}
    />
  );

  return { allowExit, requestExit, exitDialog, save, shouldPrevent, stackScreenOptions };
}
