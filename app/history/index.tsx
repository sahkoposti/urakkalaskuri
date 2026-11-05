import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, FlatList, Pressable, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { customerFromRecord } from '@/src/core/models/types';
import { formatPrintedDisplayPrice } from '@/src/core/pdf/buildPdfContext';
import { formatDate } from '@/src/core/utils/formatters';
import { isDraftCalculation } from '@/src/core/wizard/draftCalculation';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function HistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { showAlert } = useThemedAlert();
  const { ready, calculations, refreshCalculations } = useApp();

  function confirmDeleteDraft(id: string) {
    showAlert('Poista laskelma?', 'Keskeneräinen laskelma ja sen liitteet poistetaan.', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await db.deleteCalculation(id);
            await refreshCalculations();
          })();
        },
      },
    ]);
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      router.replace('/');
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (!ready) return <ScreenLoading />;
  if (calculations.length === 0) {
    return <ScreenMessage message="Ei tallennettuja laskelmia." />;
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={calculations}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const customer = customerFromRecord(item);
        const draft = isDraftCalculation(item);
        const priceLabel = draft ? null : formatPrintedDisplayPrice(item, customer);
        return (
          <AppCard
            onPress={() => {
              if (draft) {
                router.push({ pathname: '/wizard', params: { editId: item.id } });
                return;
              }
              router.push(`/history/${item.id}`);
            }}
          >
            <Text style={styles.title}>{customer.name}</Text>
            {draft ? <Text style={styles.badge}>Keskeneräinen</Text> : null}
            {draft ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDeleteDraft(item.id)}
                style={styles.delete}
              >
                <Text style={styles.deleteText}>Poista</Text>
              </Pressable>
            ) : null}
            {customer.phone ? <Text style={styles.subtitle}>{customer.phone}</Text> : null}
            {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </AppCard>
        );
      }}
    />
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    list: {
      padding: 16,
    },
    separator: {
      height: 8,
    },
    title: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    badge: {
      alignSelf: 'flex-start' as const,
      marginTop: 6,
      color: '#C90000',
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 13,
    },
    delete: {
      alignSelf: 'flex-start' as const,
      marginTop: 8,
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center' as const,
      paddingHorizontal: 12,
    },
    deleteText: {
      color: '#C90000',
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
    },
    subtitle: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    price: {
      marginTop: 8,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
    },
    date: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
  };
}
