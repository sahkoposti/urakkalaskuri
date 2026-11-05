import Constants from 'expo-constants';

export function readAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : null;
}

/** Asetuksissa näkyvä versio. Lähde on `app.json` → `Constants.expoConfig.version`. */
export function formatAppVersionLabel(version: string | null | undefined): string {
  const text = typeof version === 'string' ? version.trim() : '';
  return text ? `Versio ${text}` : 'Versio';
}
