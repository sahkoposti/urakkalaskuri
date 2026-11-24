/**
 * Online-lähetyksen oikeat riippuvuudet puhelimessa: palvelimen osoite, laitetunniste ja
 * fetch, PDF:n luku base64:ksi. Uusintatoken ja laitetunniste ovat salatussa säilössä (expo-secure-store);
 * vanha SQLite-token siirretään ja poistetaan ensimmäisellä lukukerralla; vanhaa SQLite-laitetunnistetta
 * ei siirretä vaan se poistetaan (palautettu asennus saa uuden tunnisteen).
 */
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { getOnlineSetting, saveOnlineSetting } from '../database/database';
import { createDeviceIdProvider } from './deviceIdStore';
import { createRefreshTokenStore } from './refreshTokenStore';
import { createServerClient, normalizeServerUrl, type FetchLike, type ServerClient } from './serverClient';

const fetchAdapter: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() };
};

let cached: { baseUrl: string; client: ServerClient } | null = null;

const refreshTokens = createRefreshTokenStore(SecureStore, {
  get: () => getOnlineSetting('online_refresh_token'),
  clear: () => saveOnlineSetting('online_refresh_token', null),
});

const deviceId = createDeviceIdProvider(
  SecureStore,
  () => saveOnlineSetting('online_device_id', null),
  () => randomUUID(),
);

export async function getServerUrl(): Promise<string | null> {
  return getOnlineSetting('online_server_url');
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
  return client;
}

export async function readFileBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
