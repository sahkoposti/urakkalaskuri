import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { useSaveToast } from '@/src/context/SaveToastContext';
import { exitStackScreenOptions } from '@/src/hooks/exitStackScreenOptions';
import { useNativeRemovePrevention } from '@/src/hooks/useNativeRemovePrevention';

type UseUnsavedChangesGuardOptions = {
  isDirty: boolean;
  onSave?: () => void | Promise<void | boolean>;
  onDiscard?: () => void | Promise<void>;
  title?: string;
  message?: string;
  cancelTitle?: string;
  discardTitle?: string;
  saveTitle?: string;
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
}: UseUnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const { showSaved } = useSaveToast();
  const allowExitRef = useRef(false);
  const isDirtyRef = useRef(isDirty);
  const onSaveRef = useRef(onSave);
  const onDiscardRef = useRef(onDiscard);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  isDirtyRef.current = isDirty;
  onSaveRef.current = onSave;
  onDiscardRef.current = onDiscard;

  const shouldPrevent = isDirty && !allowExitRef.current;
  const applyPreventRemove = useNativeRemovePrevention(shouldPrevent);

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;
    }, []),
  );

  const closeExitDialog = useCallback(() => {
    setExitDialogVisible(false);
    pendingExitRef.current = null;
  }, []);

  const confirmExit = useCallback((onLeave: () => void) => {
    pendingExitRef.current = onLeave;
    setExitDialogVisible(true);
  }, []);

  const markAllowExit = useCallback(() => {
    allowExitRef.current = true;
    applyPreventRemove(false);
  }, [applyPreventRemove]);

  const leaveWithoutSaving = useCallback(() => {
    void (async () => {
      await onDiscardRef.current?.();
      markAllowExit();
      const action = pendingExitRef.current;
      closeExitDialog();
      action?.();
    })();
  }, [closeExitDialog, markAllowExit]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!onSaveRef.current) return false;
    const result = await onSaveRef.current();
    if (result === false) return false;
    showSaved();
    return true;
  }, [showSaved]);

  const saveAndExit = useCallback(async () => {
    const saved = await save();
    if (!saved) return;
    markAllowExit();
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }, [closeExitDialog, markAllowExit, save]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || !isDirtyRef.current) {
        return;
      }

      event.preventDefault();
      confirmExit(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [navigation, confirmExit]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (allowExitRef.current || !isDirtyRef.current) {
          return false;
        }

        confirmExit(() => {
          markAllowExit();
          router.back();
        });
        return true;
      });

      return () => subscription.remove();
    }, [confirmExit, markAllowExit]),
  );

  const allowExit = useCallback(() => {
    markAllowExit();
  }, [markAllowExit]);

  const requestExit = useCallback(() => {
    if (allowExitRef.current || !isDirtyRef.current) {
      markAllowExit();
      router.back();
      return;
    }
    confirmExit(() => {
      markAllowExit();
      router.back();
    });
  }, [confirmExit, markAllowExit]);

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
