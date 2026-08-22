import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { OutlinedButton, SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { createCladdingFormDefinition } from '@/src/core/form/claddingFormDefinition';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function CalculationSettingsScreen() {
  const { refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();

  function handleReset() {
    showAlert(
      'Palauta oletuslomake',
      'Nykyiset sivut, kentät ja kaavat korvataan v1 Peruslaskenta -pohjalla.',
      [
        { text: 'Peruuta', style: 'cancel' },
        {
          text: 'Palauta',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await db.saveFormDefinition(createDefaultFormDefinition());
              await refreshFormSettings();
            })();
          },
        },
      ],
    );
  }

  function handleCladding() {
    showAlert(
      'Asenna Ulkoverhous-pohja',
      'Nykyinen lomake korvataan PDF:n mukaisella ulkoverhouspohjalla (pinta-alat, räystäs, maali, työvaiheet).',
      [
        { text: 'Peruuta', style: 'cancel' },
        {
          text: 'Asenna',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await db.saveFormDefinition(createCladdingFormDefinition());
              await refreshFormSettings();
            })();
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Lomakeasetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakeasetukset" />
        <SettingsNavCard
          title="Lomakepohja"
          subtitle="Sivut, järjestys, lisäys ja poisto"
          onPress={() => router.push('/settings/calculation/pages' as Href)}
        />
        <SettingsNavCard
          title="Kentät"
          subtitle="Lomakekentät, kaavat, valinnat ja vaikutukset"
          onPress={() => router.push('/settings/calculation/fields' as Href)}
        />
        <SettingsNavCard
          title="Oletusarvot"
          subtitle="Ikkuna, ovi, räystäs – kaavojen defaults.*"
          onPress={() => router.push('/settings/calculation/defaults' as Href)}
        />
        <SettingsNavCard
          title="Debug"
          subtitle="Live-laskenta kaavojen kalibrointiin"
          onPress={() => router.push('/settings/calculation/debug')}
        />
        <SettingsNavCard
          title="Lomakeohje"
          subtitle="Lyhyt ohje sivuihin, kaavoihin ja tuotteisiin"
          onPress={() => router.push('/settings/calculation/help' as Href)}
        />
        <OutlinedButton title="Asenna Ulkoverhous-pohja" onPress={handleCladding} />
        <OutlinedButton title="Palauta oletuslomake" onPress={handleReset} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
});
