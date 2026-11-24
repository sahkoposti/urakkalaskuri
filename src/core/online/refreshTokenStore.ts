/**
 * Online-palvelimen uusintatoken salatussa säilössä (expo-secure-store).
 * Vanhaa SQLite-tokenia (`online_refresh_token`, esiversiot) EI siirretä: se poistetaan käynnistyksessä ja
 * varmuuden vuoksi vielä ensimmäisellä lukukerralla (varmuuskopio on päällä, D1). Seuraus: yksi uusi kirjautuminen.
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

/** Vanhan SQLite-tokenin poisto. Arvoa ei lueta eikä kopioida. */
export type LegacyTokenSetting = {
  clear(): Promise<void>;
};

export function createRefreshTokenStore(secure: SecureStoreLike, legacy: LegacyTokenSetting): TokenStore {
  let legacyChecked = false;

  /** Poistaa vanhan SQLite-kopion kerran; epäonnistuessa yritetään seuraavalla kerralla. Ei kopioi mitään. */
  async function purgeLegacy(): Promise<void> {
    if (legacyChecked) return;
    try {
      await legacy.clear();
      legacyChecked = true;
    } catch {
      /* yritetään uudelleen seuraavalla kerralla */
    }
  }

  return {
    async getRefreshToken() {
      // Lukuvirhe → ei tokenia → uloskirjautunut.
      const current = await readSecureOrNull(secure, SECURE_REFRESH_TOKEN_KEY);
      await purgeLegacy();
      return current;
    },
    async setRefreshToken(token) {
      if (token) {
        await secure.setItemAsync(SECURE_REFRESH_TOKEN_KEY, token);
      } else {
        await secure.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY);
      }
      // Kirjoitus ohittaa mahdollisen vanhan kopion: siivotaan se aina.
      await purgeLegacy();
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
