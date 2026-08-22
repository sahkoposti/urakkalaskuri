import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/src/components/common';
import { AppColors } from '@/src/theme/colors';

export default function VariablesSettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Muuttujat' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <Text style={styles.title}>Omat muuttujat ja kaavat</Text>
          <Text style={styles.body}>
            Tähän tulee myöhemmin mahdollisuus luoda omia kenttiä, muuttujia ja kaavoja, jotka
            vaikuttavat laskentaan (esim. materiaalikerroin tai lisätyöaika).
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Tulossa v1.1</Text>
          </View>
        </AppCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 17,
    color: AppColors.primary,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.accent,
    fontSize: 13,
  },
});
