import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, FlatList, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { customerFromRecord } from '@/src/core/models/types';
import { formatDisplayPrice } from '@/src/core/utils/priceDisplay';
import { formatDate } from '@/src/core/utils/formatters';
import { useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function HistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, calculations } = useApp();

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
        const priceLabel = formatDisplayPrice(
          item.totalPriceVat0,
          item.totalPriceVat,
          customer,
        );
        return (
          <AppCard onPress={() => router.push(`/history/${item.id}`)}>
            <Text style={styles.title}>{customer.name}</Text>
            {customer.phone ? <Text style={styles.subtitle}>{customer.phone}</Text> : null}
            <Text style={styles.price}>{priceLabel}</Text>
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
