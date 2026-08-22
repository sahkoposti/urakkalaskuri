import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ConfirmDialog, type ConfirmDialogButton } from '@/src/components/ConfirmDialog';

type ThemedAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type ThemedAlertState = {
  title: string;
  message: string;
  buttons: ConfirmDialogButton[];
};

type ThemedAlertContextValue = {
  showAlert: (title: string, message?: string, buttons?: ThemedAlertButton[]) => void;
};

const ThemedAlertContext = createContext<ThemedAlertContextValue | null>(null);

function mapButtons(buttons: ThemedAlertButton[], hide: () => void): ConfirmDialogButton[] {
  return buttons.map((button) => ({
    title: button.text,
    variant:
      button.style === 'destructive'
        ? 'destructive'
        : button.style === 'cancel'
          ? 'outlined'
          : 'primary',
    onPress: () => {
      hide();
      button.onPress?.();
    },
  }));
}

export function ThemedAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<ThemedAlertState | null>(null);

  const hide = useCallback(() => {
    setAlert(null);
  }, []);

  const showAlert = useCallback(
    (title: string, message = '', buttons?: ThemedAlertButton[]) => {
      const resolvedButtons = buttons?.length
        ? mapButtons(buttons, hide)
        : [
            {
              title: 'OK',
              variant: 'primary' as const,
              onPress: hide,
            },
          ];

      setAlert({
        title,
        message,
        buttons: resolvedButtons,
      });
    },
    [hide],
  );

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <ThemedAlertContext.Provider value={value}>
      {children}
      {alert ? (
        <ConfirmDialog
          visible
          title={alert.title}
          message={alert.message}
          buttons={alert.buttons}
          onClose={hide}
        />
      ) : null}
    </ThemedAlertContext.Provider>
  );
}

export function useThemedAlert() {
  const context = useContext(ThemedAlertContext);
  if (!context) {
    throw new Error('useThemedAlert must be used within ThemedAlertProvider');
  }
  return context;
}
