import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppCard, SectionTitle } from '@/src/components/common';
import { AppColors } from '@/src/theme/colors';

export default function FormHelpScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Lomakeohje' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomake-editori" />
        <AppCard style={styles.card}>
          <Text style={styles.body}>
            Uusi laskenta käyttää Asetukset → Lomakeasetukset -pohjaa. Sivut ja kentät määräytyvät
            lomakepohjasta, ei enää kiinteästä wizardista.
          </Text>
        </AppCard>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Sivut ja kentät</Text>
          <Text style={styles.body}>
            Lisää sivu Lomakepohjassa ja kenttiä sivulle. Muuttujanimi (key) on kaavojen nimi, esim.
            pinta_ala. Valinnassa voit viedä kertoimen muuttujaan (laudoituskerroin) ja asettaa
            työ- tai materiaalikertoimen.
          </Text>
        </AppCard>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Kaavat ja tuotteet</Text>
          <Text style={styles.body}>
            Laskettu kenttä käyttää kaavaa, esim. pinta_ala / kautettavamaali.consumption. Valitse
            ensin tuotevalinta-kenttä, aseta tuotteelle menekki Tuotteet-näkymässä, ja lisää
            vaikutus „Lisää materiaalirivi”. Funktiot: min(), max(), round(). Desimaali kaavassa
            pisteellä.
          </Text>
        </AppCard>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Debug</Text>
          <Text style={styles.body}>
            Ota debug päälle ja syötä esimerkkiarvo kullekin kentälle. Computed-kenttä näyttää
            live-sijoituksen. Ulkoverhous-pohjan voi asentaa Lomakeasetuksista.
          </Text>
        </AppCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    marginTop: 0,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 22,
  },
});
