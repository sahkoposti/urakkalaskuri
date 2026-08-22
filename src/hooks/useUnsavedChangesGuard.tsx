import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';

type UseUnsavedChangesGuardOptions = {
  isDirty: boolean;
  onSave?: () => void | Promise<void | boolean>;
};

export function useUnsavedChangesGuard({ isDirty, onSave }: UseUnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const allowExitRef = useRef(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  const closeExitDialog = useCallback(() => {
    setExitDialogVisible(false);
    pendingExitRef.current = null;
  }, []);

  const confirmExit = useCallback((onLeave: () => void) => {
    pendingExitRef.current = onLeave;
    setExitDialogVisible(true);
  }, []);

  const leaveWithoutSaving = useCallback(() => {
    allowExitRef.current = true;
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }, [closeExitDialog]);

  const saveAndExit = useCallback(async () => {
    if (!onSave) {
      leaveWithoutSaving();
      return;
    }
    const result = await onSave();
    if (result === false) return;
    allowExitRef.current = true;
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }, [closeExitDialog, leaveWithoutSaving, onSave]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || !isDirty) {
        return;
      }

      event.preventDefault();
      confirmExit(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [navigation, isDirty, confirmExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (allowExitRef.current || !isDirty) {
        return false;
      }

      confirmExit(() => {
        allowExitRef.current = true;
        router.back();
      });
      return true;
    });

    return () => subscription.remove();
  }, [isDirty, confirmExit]);

  function allowExit() {
    allowExitRef.current = true;
  }

  const exitDialog = (
    <ConfirmDialog
      visible={exitDialogVisible}
      title="Tallentamattomia muutoksia"
      message="Haluatko tallentaa muutokset ennen poistumista?"
      onClose={closeExitDialog}
      buttons={[
        {
          title: 'Peruuta',
          variant: 'outlined',
          onPress: closeExitDialog,
        },
        {
          title: 'Hylkää',
          variant: 'destructive',
          onPress: leaveWithoutSaving,
        },
        {
          title: 'Tallenna',
          variant: 'primary',
          onPress: () => {
            void saveAndExit();
          },
        },
      ]}
    />
  );

  return { allowExit, exitDialog };
}
