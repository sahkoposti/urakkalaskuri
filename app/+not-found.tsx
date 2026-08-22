import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/src/theme/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sivua ei löydy' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Sivua ei löydy.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Takaisin etusivulle</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: AppColors.surface,
  },
  title: {
    fontSize: 20,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
});
