/**
 * Online-palvelimen uusintatoken salatussa säilössä (expo-secure-store).
 * Siirto: vanha token SQLite-asetuksessa `online_refresh_token` siirretään ensimmäisellä
 * lukukerralla salattuun säilöön ja vanha kopio poistetaan.
 */
import type { TokenStore } from './serverClient';

export const SECURE_REFRESH_TOKEN_KEY = 'online_refresh_token';
export const SECURE_LOGOUT_PENDING_KEY = 'online_logout_pending';

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/**
 * Luku, joka ei kaadu: jos salatun säilön arvoa ei saada luettua tai purettua (esim. palautuksen tai
 * laitesiirron jälkeen avain puuttuu), arvo poistetaan ja tulkitaan puuttuvaksi (T-42).
 */
export async function readSecureOrNull(secure: SecureStoreLike, key: string): Promise<string | null> {
  try {
    return (await secure.getItemAsync(key)) || null;
  } catch {
    try {
      await secure.deleteItemAsync(key);
    } catch {
      // Poistokin epäonnistui: arvo tulkitaan silti puuttuvaksi.
    }
    return null;
  }
}

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
      // Lukuvirhe → ei tokenia → uloskirjautunut.
      const current = await readSecureOrNull(secure, SECURE_REFRESH_TOKEN_KEY);
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
    async getLogoutPending() {
      try {
        return (await secure.getItemAsync(SECURE_LOGOUT_PENDING_KEY)) === '1';
      } catch {
        // Lippua ei saada luettua: ei arvata, että uloskirjautuminen olisi valmis. Poistetaan myös token,
        // jolloin sovellus on uloskirjautunut eikä vanhaa istuntoa käytetä (se vanhenee palvelimella).
        try {
          await secure.deleteItemAsync(SECURE_LOGOUT_PENDING_KEY);
        } catch {
          /* ohitetaan */
        }
        try {
          await secure.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY);
        } catch {
          /* ohitetaan */
        }
        return false;
      }
    },
    async setLogoutPending(pending) {
      if (pending) await secure.setItemAsync(SECURE_LOGOUT_PENDING_KEY, '1');
      else await secure.deleteItemAsync(SECURE_LOGOUT_PENDING_KEY);
    },
  };
}
