import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { formatCurrency } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function ProductsScreen() {
  const { ready, products, refreshProducts } = useApp();
  const { showAlert } = useThemedAlert();

  if (!ready) return <ScreenLoading />;

  function handleDelete(id: string) {
    showAlert('Poista tuote', 'Haluatko varmasti poistaa tuotteen?', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await db.deleteProduct(id);
            await refreshProducts();
          })();
        },
      },
    ]);
  }

  if (products.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenMessage message="Ei tuotteita. Lisää ensimmäinen tuote." />
        <Pressable style={styles.fab} onPress={() => router.push('/products/new')}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.list}
        data={products}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <AppCard onPress={() => router.push(`/products/${item.id}`)}>
            <View style={styles.row}>
              <View style={styles.textWrap}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>
                  {formatCurrency(item.unitPriceVat0)} / {item.unit}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)}>
                <Text style={styles.delete}>Poista</Text>
              </Pressable>
            </View>
          </AppCard>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/products/new')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingBottom: 96,
  },
  separator: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
  },
  price: {
    marginTop: 4,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  delete: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: {
    color: AppColors.secondary,
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'IBMPlexSans_700Bold',
  },
});
