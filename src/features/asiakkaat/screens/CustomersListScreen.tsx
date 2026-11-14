import { router, Stack, type Href } from 'expo-router';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';

import { AppCard, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { telUrlForSavedPhone } from '@/src/core/customer/phoneLink';
import { formatDate } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function CustomersScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, customers, refreshCustomers } = useApp();
  const { showAlert } = useThemedAlert();

  if (!ready) return <ScreenLoading />;

  function handleDelete(id: string) {
    showAlert('Poista asiakas', 'Haluatko poistaa asiakkaan rekisteristä?', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await db.deleteCustomer(id);
            await refreshCustomers();
          })();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Asiakkaat' }} />
      {customers.length === 0 ? (
        <View style={styles.container}>
          <ScreenMessage message="Ei asiakkaita." />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={customers}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <AppCard onPress={() => router.push(`/customers/${item.id}` as Href)}>
              <View style={styles.row}>
                <View style={styles.textWrap}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.postalLocality || item.address || formatDate(item.updatedAt)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {telUrlForSavedPhone(item.phone) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Soita"
                      onPress={() => {
                        const tel = telUrlForSavedPhone(item.phone);
                        if (tel) void Linking.openURL(tel);
                      }}
                      style={styles.action}
                    >
                      <Text style={styles.call}>Soita</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Poista"
                    onPress={() => handleDelete(item.id)}
                    style={styles.action}
                  >
                    <Text style={styles.delete}>Poista</Text>
                  </Pressable>
                </View>
              </View>
            </AppCard>
          )}
        />
      )}
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
      paddingBottom: 40,
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
    meta: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    actions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    action: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center' as const,
      paddingHorizontal: 8,
    },
    call: {
      color: colors.primary,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    delete: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
  };
}
