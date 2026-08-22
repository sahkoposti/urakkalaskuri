import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandLogo, SectionTitle } from '@/src/components/common';
import { AppCard } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function HomeScreen() {
  const { wizardDraft, refreshWizardDraft } = useApp();
  const [newCalcDialogVisible, setNewCalcDialogVisible] = useState(false);

  function handleNewCalculation() {
    if (wizardDraft) {
      setNewCalcDialogVisible(true);
      return;
    }

    router.push('/wizard');
  }

  async function startNewCalculation() {
    await db.clearWizardDraft();
    await refreshWizardDraft();
    setNewCalcDialogVisible(false);
    router.push('/wizard');
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <BrandLogo width={170} />,
          headerTitleAlign: 'center',
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <SectionTitle title="Urakkalaskuri" center />
        </View>

        <NavCard
          title="Uusi laskenta"
          subtitle="Aloita laskenta"
          onPress={handleNewCalculation}
          accent
        />
        <NavCard
          title="Historia"
          subtitle="Aiempien laskelmien lista"
          onPress={() => router.push('/history')}
        />
        <NavCard
          title="Tuotteet"
          subtitle="Materiaalit ja hinnat"
          onPress={() => router.push('/products')}
        />
        <NavCard
          title="Asetukset"
          subtitle="ALV, kate, tuntihinta"
          onPress={() => router.push('/settings' as Href)}
        />
      </ScrollView>

      <ConfirmDialog
        visible={newCalcDialogVisible}
        title="Uusi laskenta"
        message="Kesken jäänyt laskenta poistetaan. Haluatko aloittaa uuden?"
        onClose={() => setNewCalcDialogVisible(false)}
        buttons={[
          {
            title: 'Peruuta',
            variant: 'outlined',
            onPress: () => setNewCalcDialogVisible(false),
          },
          {
            title: 'Aloita uusi',
            variant: 'primary',
            onPress: () => {
              void startNewCalculation();
            },
          },
        ]}
      />
    </>
  );
}

type NavCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
};

function NavCard({ title, subtitle, onPress, accent = false }: NavCardProps) {
  return (
    <AppCard
      onPress={onPress}
      style={[styles.navCard, accent && styles.navCardAccent]}
    >
      <View style={styles.navRow}>
        <View style={styles.navText}>
          <Text style={[styles.navTitle, accent && styles.navTitleAccent]}>
            {title}
          </Text>
          <Text style={[styles.navSubtitle, accent && styles.navSubtitleAccent]}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.chevron, accent && styles.chevronAccent]}>›</Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  navCard: {
    marginBottom: 12,
  },
  navCardAccent: {
    backgroundColor: AppColors.accent,
    borderColor: AppColors.accent,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navText: {
    flex: 1,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
  },
  navTitleAccent: {
    color: AppColors.secondary,
  },
  navSubtitle: {
    marginTop: 4,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  navSubtitleAccent: {
    color: AppColors.secondary,
  },
  chevron: {
    fontSize: 28,
    color: AppColors.text,
    lineHeight: 28,
  },
  chevronAccent: {
    color: AppColors.secondary,
  },
});
