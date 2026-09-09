import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BrandLogo, SectionTitle } from '@/src/components/common';
import { AppCard } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { db, useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles);
  const { wizardDraft, refreshWizardDraft, setWizardSession } = useApp();
  const [newCalcDialogVisible, setNewCalcDialogVisible] = useState(false);

  function handleNewCalculation() {
    if (wizardDraft) {
      setNewCalcDialogVisible(true);
      return;
    }

    setWizardSession(null);
    router.push('/wizard');
  }

  async function startNewCalculation() {
    setWizardSession(null);
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
  const styles = useThemedStyles(createStyles);
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

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    hero: {
      alignItems: 'center' as const,
      marginBottom: 24,
      gap: 8,
    },
    navCard: {
      marginBottom: 12,
    },
    navCardAccent: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    navRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    navText: {
      flex: 1,
    },
    navTitle: {
      fontSize: 17,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    navTitleAccent: {
      color: colors.secondary,
    },
    navSubtitle: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    navSubtitleAccent: {
      color: colors.secondary,
    },
    chevron: {
      fontSize: 28,
      color: colors.text,
      lineHeight: 28,
    },
    chevronAccent: {
      color: colors.secondary,
    },
  };
}
