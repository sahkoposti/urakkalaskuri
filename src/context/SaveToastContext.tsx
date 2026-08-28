import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

const TOAST_DURATION_MS = 2000;

type SaveToastContextValue = {
  showSaved: (message?: string) => void;
};

const SaveToastContext = createContext<SaveToastContextValue | null>(null);

export function SaveToastProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Tallennettu');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [opacity, translateY]);

  const showSaved = useCallback(
    (nextMessage = 'Tallennettu') => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      setMessage(nextMessage);
      setVisible(true);
      opacity.setValue(0);
      translateY.setValue(-12);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      hideTimerRef.current = setTimeout(hide, TOAST_DURATION_MS);
    },
    [hide, opacity, translateY],
  );

  const value = useMemo(() => ({ showSaved }), [showSaved]);

  return (
    <SaveToastContext.Provider value={value}>
      {children}
      {visible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + 8,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      ) : null}
    </SaveToastContext.Provider>
  );
}

export function useSaveToast() {
  const context = useContext(SaveToastContext);
  if (!context) {
    throw new Error('useSaveToast must be used within SaveToastProvider');
  }
  return context;
}

function createStyles(colors: AppColorPalette) {
  return {
    toast: {
      position: 'absolute' as const,
      alignSelf: 'center' as const,
      zIndex: 300,
      elevation: 300,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    toastText: {
      color: colors.secondary,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
    },
  };
}
