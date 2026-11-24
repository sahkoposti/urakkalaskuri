/**
 * Vanhat online-salaisuudet SQLite-asetuksissa (esiversiot): uusintatoken ja laitetunniste.
 * Niitä ei siirretä salattuun säilöön, vaan rivit poistetaan käynnistyksessä (tietokannan avauksessa).
 * Android-varmuuskopio on päällä (D1), ja tietokanta on mukana varmuuskopiossa, joten vanha token ei saa
 * palautuksesta päätyä käyttöön. Seuraus: esiversiosta päivittävä kirjautuu kerran uudelleen.
 * Palvelimen osoite ja käyttäjätunnus ovat omia rivejään eivätkä ole salaisuuksia; ne säilyvät.
 *
 * Jäljettömyys (QA P2): poisto tehdään PRAGMA secure_delete = ON -tilassa (vapautuneet sivut nollataan).
 * Kun vanha rivi oikeasti poistui, ajetaan kerran WAL-checkpoint ja VACUUM, jotta vanhaa sisältöä ei jää
 * WAL-tiedostoon tai vapaille sivuille. Kerran ajo merkitään asetukseen; virhe ei estä käynnistystä.
 */
import type * as SQLite from 'expo-sqlite';

export const LEGACY_ONLINE_SECRET_KEYS = ['online_refresh_token', 'online_device_id'] as const;
/** Asetus, joka merkitsee kertaluonteisen checkpoint + VACUUM -siivouksen tehdyksi. */
export const LEGACY_SECRETS_VACUUM_DONE_KEY = 'legacy_online_secrets_vacuumed';

type PurgeDb = Pick<SQLite.SQLiteDatabase, 'runAsync' | 'execAsync' | 'getFirstAsync'>;

async function vacuumOnce(db: PurgeDb): Promise<void> {
  try {
    const done = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      LEGACY_SECRETS_VACUUM_DONE_KEY,
    );
    if (done?.value === '1') return;
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    await db.execAsync('VACUUM');
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      LEGACY_SECRETS_VACUUM_DONE_KEY,
      '1',
    );
  } catch {
    // Ei estä käynnistystä; rivit on jo poistettu secure_delete-tilassa. Yritetään uudelleen seuraavalla kerralla.
  }
}

export async function purgeLegacyOnlineSecrets(db: PurgeDb): Promise<void> {
  await db.execAsync('PRAGMA secure_delete = ON');
  const result = await db.runAsync(
    `DELETE FROM settings WHERE key IN (${LEGACY_ONLINE_SECRET_KEYS.map(() => '?').join(', ')})`,
    ...LEGACY_ONLINE_SECRET_KEYS,
  );
  if ((result?.changes ?? 0) > 0) await vacuumOnce(db);
}
