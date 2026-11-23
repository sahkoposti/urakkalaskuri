/**
 * Online-lähetyksen oikeat riippuvuudet puhelimessa: palvelimen osoite, laitetunniste ja
 * uusintatoken settings-taulussa, fetch, PDF:n luku base64:ksi.
 * Huom: uusintatoken on SQLite-asetuksissa (ei salattua säilöä; expo-secure-store ei ole asennettu).
 */
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { getOnlineSetting, saveOnlineSetting } from '../database/database';
import { createServerClient, normalizeServerUrl, type FetchLike, type ServerClient } from './serverClient';

const fetchAdapter: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() };
};

let cached: { baseUrl: string; client: ServerClient } | null = null;

async function deviceId(): Promise<string> {
  const stored = await getOnlineSetting('online_device_id');
  if (stored && /^[A-Za-z0-9_-]{8,128}$/.test(stored)) return stored;
  const id = randomUUID().replace(/[^A-Za-z0-9_-]/g, '');
  await saveOnlineSetting('online_device_id', id);
  return id;
}

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
    tokens: {
      getRefreshToken: () => getOnlineSetting('online_refresh_token'),
      setRefreshToken: (token) => saveOnlineSetting('online_refresh_token', token),
    },
  });
  cached = { baseUrl, client };
  return client;
}

export async function readFileBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
