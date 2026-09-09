import { router, Stack } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { ReorderControls } from '@/src/components/ReorderControls';
import type { Product } from '@/src/core/models/types';
import {
  productMarginEur,
  productMarginPercent,
  productPurchasePriceVat0,
  productSalePriceVat0,
} from '@/src/core/product/productPricing';
import { moveProductInList } from '@/src/core/product/productMutations';
import { productStructureIds } from '@/src/core/product/productStructures';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function ProductsScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, products, structures, refreshProducts } = useApp();
  const { showAlert } = useThemedAlert();

  if (!ready) return <ScreenLoading />;

  function structureLabel(product: Product): string {
    const names = productStructureIds(product)
      .map((id) => structures.find((item) => item.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : 'Ei tuoterakennetta';
  }

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

  function handleMove(index: number, direction: -1 | 1) {
    const next = moveProductInList(products, index, direction);
    if (next === products) return;
    void (async () => {
      await db.saveProductOrder(next.map((product) => product.id));
      await refreshProducts();
    })();
  }

  if (products.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Tuotteet' }} />
        <View style={styles.container}>
          <ScreenMessage message="Ei tuotteita. Lisää ensimmäinen tuote." />
          <Pressable style={styles.fab} onPress={() => router.push('/products/new')}>
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Tuotteet' }} />
      <View style={styles.container}>
        <FlatList
          contentContainerStyle={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item, index }: { item: Product; index: number }) => (
            <AppCard>
              <Pressable onPress={() => router.push(`/products/${item.id}`)}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>
                  Osto {formatCurrency(productPurchasePriceVat0(item))} · Myynti{' '}
                  {formatCurrency(productSalePriceVat0(item))} / {item.unit}
                </Text>
                <Text style={styles.margin}>
                  Kate {formatCurrency(productMarginEur(item))} ({formatPercent(productMarginPercent(item))})
                </Text>
                <Text style={styles.structures}>{structureLabel(item)}</Text>
              </Pressable>
              <View style={styles.actions}>
                <ReorderControls
                  index={index}
                  count={products.length}
                  onMove={(direction) => handleMove(index, direction)}
                />
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/products/new', params: { copyFrom: item.id } })
                  }
                >
                  <Text style={styles.copy}>Kopioi</Text>
                </Pressable>
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
    </>
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
    name: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    price: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    margin: {
      marginTop: 2,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
    },
    structures: {
      marginTop: 2,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
    },
    actions: {
      marginTop: 10,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'flex-end' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    copy: {
      color: colors.primary,
      fontFamily: 'IBMPlexSans_600SemiBold',
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
