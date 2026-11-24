/**
 * Laitetunniste online-palvelimelle salatussa säilössä (expo-secure-store), ei SQLite-tietokannassa.
 * Android-varmuuskopio on pois päältä, eikä salatun säilön avain siirry palautuksessa toiseen laitteeseen,
 * joten palautettu tai kopioitu asennus saa aina uuden tunnisteen (T-36).
 * Vanhaa SQLite-tunnistetta ei siirretä (se olisi voinut tulla palautuksesta); se poistetaan.
 */
import type { SecureStoreLike } from './refreshTokenStore';

export const SECURE_DEVICE_ID_KEY = 'online_device_id';
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function createDeviceIdProvider(
  secure: SecureStoreLike,
  clearLegacy: () => Promise<void>,
  generate: () => string,
): () => Promise<string> {
  let pending: Promise<string> | null = null;

  async function load(): Promise<string> {
    const stored = await secure.getItemAsync(SECURE_DEVICE_ID_KEY);
    if (stored && DEVICE_ID_RE.test(stored)) return stored;
    const id = generate().replace(/[^A-Za-z0-9_-]/g, '');
    if (!DEVICE_ID_RE.test(id)) throw new Error('Laitetunnisteen luonti epäonnistui.');
    await secure.setItemAsync(SECURE_DEVICE_ID_KEY, id);
    await clearLegacy();
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
