import { router, Stack, type Href } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { OutlinedButton, SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function ProductStructuresScreen() {
  const styles = useThemedStyles(createStyles);
  const { structures } = useApp();

  return (
    <>
      <Stack.Screen options={{ title: 'Tuoterakenteet' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Tuoterakenteet" />
        {structures.map((structure) => (
          <SettingsNavCard
            key={structure.id}
            title={structure.name}
            subtitle={`Palkkio ${structure.commissionPercent} %`}
            onPress={() => router.push(`/settings/structures/${structure.id}` as Href)}
          />
        ))}
        <OutlinedButton
          title="Lisää tuoterakenne"
          onPress={() => router.push('/settings/structures/new' as Href)}
        />
        {structures.length === 0 ? (
          <Text style={styles.empty}>Ei tuoterakenteita.</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 10,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
  };
}
