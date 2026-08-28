import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { formatCurrency } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function ProductsScreen() {
  const styles = useThemedStyles(createStyles);
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

function createStyles(colors: AppColorPalette) {
  return {
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
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    textWrap: {
      flex: 1,
    },
    name: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    price: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    delete: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    fab: {
      position: 'absolute' as const,
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      elevation: 4,
    },
    fabText: {
      color: colors.secondary,
      fontSize: 28,
      lineHeight: 30,
      fontFamily: 'IBMPlexSans_700Bold',
    },
  };
}
