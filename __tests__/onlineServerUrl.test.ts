/** B6: the stored server URL is re-validated with normalizeServerUrl on every read. */
const mockSettings = new Map<string, string>();
jest.mock('../src/core/database/database', () => ({
  getOnlineSetting: jest.fn(async (key: string) => mockSettings.get(key) ?? null),
  saveOnlineSetting: jest.fn(async (key: string, value: string | null) => {
    if (value == null) mockSettings.delete(key);
    else mockSettings.set(key, value);
  }),
}));

import { getServerClient, getServerUrl, setServerUrl } from '../src/core/online/onlineRuntime';

beforeEach(() => mockSettings.clear());

describe('stored server URL is re-validated on read (B6)', () => {
  it('returns a valid stored https URL in normalized form', async () => {
    mockSettings.set('online_server_url', 'https://Palvelin.Example.invalid/api/');
    expect(await getServerUrl()).toBe('https://palvelin.example.invalid/api');
  });

  it.each([
    'http://palvelin.example.invalid',
    'https://user:pw@palvelin.example.invalid',
    'ftp://palvelin.example.invalid',
    'not a url',
    'https://palvelin.example.invalid/?q=1',
    'https://palvelin.example.invalid:99999',
  ])('treats an invalid stored value %p as not configured', async (bad) => {
    mockSettings.set('online_server_url', bad);
    expect(await getServerUrl()).toBeNull();
    expect(await getServerClient()).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await getServerUrl()).toBeNull();
    expect(await getServerClient()).toBeNull();
  });

  it('setServerUrl still refuses an invalid URL and stores a valid one normalized', async () => {
    expect(await setServerUrl('http://palvelin.example.invalid')).toBe(false);
    expect(mockSettings.has('online_server_url')).toBe(false);
    expect(await setServerUrl(' https://palvelin.example.invalid/ ')).toBe(true);
    expect(await getServerUrl()).toBe('https://palvelin.example.invalid');
  });
});
