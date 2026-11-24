/**
 * Vanhat online-salaisuudet SQLite-asetuksissa (esiversiot): uusintatoken ja laitetunniste.
 * Niitä ei siirretä salattuun säilöön, vaan rivit poistetaan käynnistyksessä (tietokannan avauksessa).
 * Android-varmuuskopio on päällä (D1), ja tietokanta on mukana varmuuskopiossa, joten vanha token ei saa
 * palautuksesta päätyä käyttöön. Seuraus: esiversiosta päivittävä kirjautuu kerran uudelleen.
 * Palvelimen osoite ja käyttäjätunnus ovat omia rivejään eivätkä ole salaisuuksia; ne säilyvät.
 */
import type * as SQLite from 'expo-sqlite';

export const LEGACY_ONLINE_SECRET_KEYS = ['online_refresh_token', 'online_device_id'] as const;

type RunDb = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

export async function purgeLegacyOnlineSecrets(db: RunDb): Promise<void> {
  await db.runAsync(
    `DELETE FROM settings WHERE key IN (${LEGACY_ONLINE_SECRET_KEYS.map(() => '?').join(', ')})`,
    ...LEGACY_ONLINE_SECRET_KEYS,
  );
}
