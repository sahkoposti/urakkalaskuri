/**
 * Online-palvelimen uusintatoken salatussa säilössä (expo-secure-store).
 * Siirto: vanha token SQLite-asetuksessa `online_refresh_token` siirretään ensimmäisellä
 * lukukerralla salattuun säilöön ja vanha kopio poistetaan.
 */
import type { TokenStore } from './serverClient';

export const SECURE_REFRESH_TOKEN_KEY = 'online_refresh_token';

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type LegacyTokenSetting = {
  get(): Promise<string | null>;
  clear(): Promise<void>;
};

export function createRefreshTokenStore(secure: SecureStoreLike, legacy: LegacyTokenSetting): TokenStore {
  let legacyChecked = false;

  async function migrateLegacy(current: string | null): Promise<string | null> {
    if (legacyChecked) return current;
    const old = await legacy.get();
    if (old) {
      if (!current) {
        await secure.setItemAsync(SECURE_REFRESH_TOKEN_KEY, old);
        current = old;
      }
      await legacy.clear();
    }
    legacyChecked = true;
    return current;
  }

  return {
    async getRefreshToken() {
      const current = (await secure.getItemAsync(SECURE_REFRESH_TOKEN_KEY)) || null;
      return migrateLegacy(current);
    },
    async setRefreshToken(token) {
      if (token) {
        await secure.setItemAsync(SECURE_REFRESH_TOKEN_KEY, token);
      } else {
        await secure.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY);
      }
      // Kirjoitus ohittaa mahdollisen vanhan kopion: siivotaan se aina.
      if (!legacyChecked) {
        await legacy.clear();
        legacyChecked = true;
      }
    },
  };
}
