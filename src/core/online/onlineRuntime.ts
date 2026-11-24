/**
 * Online-lähetyksen oikeat riippuvuudet puhelimessa: palvelimen osoite, laitetunniste ja
 * fetch, PDF:n luku base64:ksi. Uusintatoken ja laitetunniste ovat salatussa säilössä (expo-secure-store);
 * vanhoja SQLite-salaisuuksia (token, laitetunniste) ei siirretä, vaan ne poistetaan käynnistyksessä
 * (tietokannan avaus) ja ensimmäisellä käytöllä; esiversiosta päivittävä kirjautuu kerran uudelleen.
 */
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { getOnlineSetting, purgeLegacyOnlineSecretRows, saveOnlineSetting } from '../database/database';
import { createDeviceIdProvider } from './deviceIdStore';
import { createRefreshTokenStore } from './refreshTokenStore';
import { createServerClient, normalizeServerUrl, type FetchLike, type ServerClient } from './serverClient';

const fetchAdapter: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() };
};

let cached: { baseUrl: string; client: ServerClient } | null = null;

const refreshTokens = createRefreshTokenStore(SecureStore, { clear: purgeLegacyOnlineSecretRows });

const deviceId = createDeviceIdProvider(
  SecureStore,
  purgeLegacyOnlineSecretRows,
  () => randomUUID(),
);

/**
 * Tallennettu osoite tarkistetaan joka lukukerralla uudelleen (B6): vanhalla versiolla, käsin tai
 * palautuksessa tallentunut kelvoton osoite tarkoittaa, ettei palvelinta ole asetettu.
 */
export async function getServerUrl(): Promise<string | null> {
  const stored = await getOnlineSetting('online_server_url');
  return stored == null ? null : normalizeServerUrl(stored);
}

/** Tallentaa osoitteen. Palauttaa false, jos osoite ei kelpaa (vain https). */
export async function setServerUrl(raw: string): Promise<boolean> {
  const url = normalizeServerUrl(raw);
  if (!url) return false;
  if (cached && cached.baseUrl !== url) cached = null;
  await saveOnlineSetting('online_server_url', url);
  return true;
}

/** Asiakas tallennetulla osoitteella. null = osoitetta ei ole asetettu. */
export async function getServerClient(): Promise<ServerClient | null> {
  const baseUrl = await getServerUrl();
  if (!baseUrl) return null;
  if (cached?.baseUrl === baseUrl) return cached.client;
  const client = createServerClient({
    baseUrl,
    deviceId: await deviceId(),
    fetch: fetchAdapter,
    tokens: refreshTokens,
  });
  cached = { baseUrl, client };
  // Kesken jäänyt uloskirjautuminen (T-38): yritetään sulkea palvelimen istunto taustalla.
  void client.retryPendingLogout().catch(() => undefined);
  return client;
}

export async function readFileBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
