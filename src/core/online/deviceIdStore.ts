/**
 * Laitetunniste online-palvelimelle salatussa säilössä (expo-secure-store), ei SQLite-tietokannassa.
 * Salattu säilö on rajattu pois Android-varmuuskopiosta ja laitesiirrosta (D1), eikä sen avain siirry,
 * joten palautettu tai kopioitu asennus saa aina uuden tunnisteen (T-36).
 * Vanhaa SQLite-tunnistetta ei siirretä (se olisi voinut tulla palautuksesta); se poistetaan.
 */
import { readSecureOrNull, type SecureStoreLike } from './refreshTokenStore';

export const SECURE_DEVICE_ID_KEY = 'online_device_id';
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function createDeviceIdProvider(
  secure: SecureStoreLike,
  clearLegacy: () => Promise<void>,
  generate: () => string,
): () => Promise<string> {
  let pending: Promise<string> | null = null;

  async function load(): Promise<string> {
    // Luku- tai purkuvirhe (esim. palautuksen jälkeen) → arvo poistetaan ja tehdään uusi tunniste (T-42).
    const stored = await readSecureOrNull(secure, SECURE_DEVICE_ID_KEY);
    if (stored && DEVICE_ID_RE.test(stored)) return stored;
    const id = generate().replace(/[^A-Za-z0-9_-]/g, '');
    if (!DEVICE_ID_RE.test(id)) throw new Error('Laitetunnisteen luonti epäonnistui.');
    try {
      await secure.setItemAsync(SECURE_DEVICE_ID_KEY, id);
    } catch {
      // Tallennus ei onnistu: tunniste pysyy tämän käynnistyksen ajan muistissa, ei kaatumista.
    }
    try {
      await clearLegacy();
    } catch {
      /* vanhan arvon poisto yritetään seuraavalla kerralla uudelleen */
    }
    return id;
  }

  return () => {
    if (!pending) {
      pending = load().catch((e) => {
        pending = null;
        throw e;
      });
    }
    return pending;
  };
}
