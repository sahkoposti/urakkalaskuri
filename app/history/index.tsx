import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { formatCurrency, formatDate } from '@/src/core/utils/formatters';
import { useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function HistoryScreen() {
  const { ready, calculations } = useApp();

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
      renderItem={({ item }) => (
        <AppCard onPress={() => router.push(`/history/${item.id}`)}>
          <Text style={styles.title}>{item.projectName}</Text>
          {item.customer ? <Text style={styles.customer}>{item.customer}</Text> : null}
          <Text style={styles.price}>{formatCurrency(item.totalPriceVat0)}</Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </AppCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 16,
    color: AppColors.primary,
  },
  customer: {
    marginTop: 4,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  price: {
    marginTop: 8,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
  },
  date: {
    marginTop: 4,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
});
