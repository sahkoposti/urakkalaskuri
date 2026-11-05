import Constants from 'expo-constants';

export function readAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : null;
}
