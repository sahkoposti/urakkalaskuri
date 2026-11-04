import { shareDocumentFileName } from '../src/core/documents/documentShare';
import {
  PHONE_FOLDER_CHANGE,
  PHONE_FOLDER_EXPLANATION,
  PHONE_SAVE_RETRY,
  PHONE_SAVE_TO_PHONE,
  PHONE_STATUS_FAILED,
  PHONE_STATUS_OK,
  PHONE_STATUS_SKIPPED,
  phoneFolderDisplayName,
  phoneFolderRowLabel,
  phoneSaveActionLabel,
  phoneStatusLabel,
} from '../src/core/documents/documentLabels';
import {
  PHONE_FOLDER_NOT_CHOSEN,
  PHONE_FOLDER_PERMISSION,
  copyPdfIntoDirectory,
  savePdfToPhoneFolder,
  uniquePhoneFileName,
  wrapPhoneDirectory,
  type PhoneDirectory,
  type PhoneSaveDeps,
} from '../src/core/documents/phoneSave';

const bytes = Uint8Array.from([1, 2, 3]);
const shareName = shareDocumentFileName({
  kind: 'tarjous',
  offerNumber: 10285,
  version: 2,
  createdAt: new Date(2026, 10, 3, 14, 5),
});

function fakeDirectory(uri: string, names: string[]): PhoneDirectory & { created: string[] } {
  const created: string[] = [];
  return {
    uri,
    created,
    listNames: () => [...names],
    createFile(name) {
      created.push(name);
      if (names.includes(name)) throw new Error('exists');
      return {
        uri: `${uri}${name}`,
        write(content) {
          if (content !== bytes) throw new Error('wrong bytes');
          names.push(name);
        },
      };
    },
  };
}

function deps(overrides: Partial<PhoneSaveDeps> = {}): PhoneSaveDeps & { folder: string | null; picks: number } {
  const state = { folder: 'content://tree/primary:Urakkalaskuri/' as string | null, picks: 0 };
  const directory = fakeDirectory(state.folder ?? 'content://picked/', ['Tarjous.pdf']);
  const base: PhoneSaveDeps = {
    platform: 'android',
    fileName: shareName,
    readBytes: () => bytes,
    getFolderUri: () => state.folder,
    setFolderUri: (uri) => {
      state.folder = uri;
    },
    openDirectory: () => directory,
    pickDirectory: async () => {
      state.picks += 1;
      return fakeDirectory('content://tree/primary:Urakkalaskuri/', []);
    },
    ...overrides,
  };
  return Object.assign(base, {
    get folder() {
      return state.folder;
    },
    get picks() {
      return state.picks;
    },
  });
}

describe('uniquePhoneFileName', () => {
  it('keeps a free name and suffixes the next free number without replacing the original', () => {
    expect(uniquePhoneFileName(shareName, [])).toBe('Tarjous_10285_v2_2026-11-03_1405.pdf');
    expect(uniquePhoneFileName(shareName, [shareName])).toBe('Tarjous_10285_v2_2026-11-03_1405 (2).pdf');
    expect(uniquePhoneFileName(shareName, [shareName, 'Tarjous_10285_v2_2026-11-03_1405 (2).pdf'])).toBe(
      'Tarjous_10285_v2_2026-11-03_1405 (3).pdf',
    );
    expect(uniquePhoneFileName('Urakkakortti_v1_2026-11-03_1405.pdf', [shareName])).toBe(
      'Urakkakortti_v1_2026-11-03_1405.pdf',
    );
  });
});

describe('copyPdfIntoDirectory', () => {
  it('does not overwrite an existing phone file, including a trailing-slash listing', () => {
    const names = [shareName];
    const directory = fakeDirectory('content://folder/', names);
    const placed = copyPdfIntoDirectory(shareName, bytes, directory);
    expect(directory.created).toEqual(['Tarjous_10285_v2_2026-11-03_1405 (2).pdf']);
    expect(placed.storedName).toBe('Tarjous_10285_v2_2026-11-03_1405 (2).pdf');
    expect(names).toEqual([shareName, 'Tarjous_10285_v2_2026-11-03_1405 (2).pdf']);

    const created: string[] = [];
    const wrapped = wrapPhoneDirectory({
      uri: 'content://tree/primary:Urakkalaskuri/',
      list: () => [{ uri: `content://tree/document/primary:Urakkalaskuri/${shareName}/` }],
      createFile(name) {
        created.push(name);
        return {
          uri: `content://tree/document/primary:Urakkalaskuri/${name}`,
          write() {
            return undefined;
          },
        };
      },
    });
    expect(wrapped.listNames()).toEqual([shareName]);
    const again = copyPdfIntoDirectory(shareName, bytes, wrapped);
    expect(created).toEqual(['Tarjous_10285_v2_2026-11-03_1405 (2).pdf']);
    expect(again.storedName).not.toBe(shareName);
  });
});

describe('savePdfToPhoneFolder', () => {
  it('copies on Android and returns ok', async () => {
    const directory = fakeDirectory('content://tree/primary:Urakkalaskuri/', []);
    const input = deps({
      openDirectory: () => directory,
      pickDirectory: async () => {
        throw new Error('picker should stay closed');
      },
    });
    const outcome = await savePdfToPhoneFolder(input);
    expect(outcome).toEqual({
      status: 'ok',
      phoneUri: `content://tree/primary:Urakkalaskuri/${shareName}`,
      error: null,
    });
    expect(input.picks).toBe(0);
    expect(directory.created).toEqual([shareName]);
  });

  it('returns failed when the write fails and leaves the app bytes in place', async () => {
    const source = { bytes, deleted: false };
    const names = [shareName];
    const directory = fakeDirectory('content://tree/primary:Urakkalaskuri/', names);
    directory.createFile = () => ({
      uri: 'content://new',
      write() {
        throw new Error('disk full');
      },
    });
    const outcome = await savePdfToPhoneFolder(
      deps({
        readBytes: () => {
          if (source.deleted) throw new Error('app copy missing');
          return source.bytes;
        },
        openDirectory: () => directory,
      }),
    );
    expect(outcome).toEqual({ status: 'failed', phoneUri: null, error: 'disk full' });
    expect(source.deleted).toBe(false);
    expect(source.bytes).toEqual(bytes);
    expect(names).toEqual([shareName]);
  });

  it('retries a failed copy into the same folder', async () => {
    const names: string[] = [];
    let fail = true;
    const directory = fakeDirectory('content://tree/primary:Urakkalaskuri/', names);
    const original = directory.createFile.bind(directory);
    directory.createFile = (name, mime) => {
      const file = original(name, mime);
      return {
        ...file,
        write(content) {
          if (fail) throw new Error('disk full');
          file.write(content);
        },
      };
    };
    const input = deps({ openDirectory: () => directory });
    const first = await savePdfToPhoneFolder(input);
    expect(first.status).toBe('failed');
    expect(first.error).toBe('disk full');
    fail = false;
    const second = await savePdfToPhoneFolder(input);
    expect(second).toEqual({
      status: 'ok',
      phoneUri: `content://tree/primary:Urakkalaskuri/${shareName}`,
      error: null,
    });
    expect(input.folder).toBe('content://tree/primary:Urakkalaskuri/');
  });

  it('asks for a folder when none is stored', async () => {
    const picked = fakeDirectory('content://tree/primary:Uusi/', []);
    let stored: string | null = null;
    const outcome = await savePdfToPhoneFolder(
      deps({
        getFolderUri: () => stored,
        setFolderUri: (uri) => {
          stored = uri;
        },
        pickDirectory: async () => picked,
      }),
    );
    expect(outcome.status).toBe('ok');
    expect(outcome.phoneUri).toBe(`content://tree/primary:Uusi/${shareName}`);
    expect(stored).toBe('content://tree/primary:Uusi/');
  });

  it('fails without a phone file when the user dismisses the folder picker', async () => {
    const outcome = await savePdfToPhoneFolder(
      deps({
        getFolderUri: () => null,
        pickDirectory: async () => null,
      }),
    );
    expect(outcome).toEqual({ status: 'failed', phoneUri: null, error: PHONE_FOLDER_NOT_CHOSEN });
  });

  it('clears a lost folder permission and asks for the folder again', async () => {
    const picked = fakeDirectory('content://tree/primary:Uusi/', []);
    const sets: Array<string | null> = [];
    let picks = 0;
    const outcome = await savePdfToPhoneFolder(
      deps({
        openDirectory: () => {
          throw new Error('Permission denied');
        },
        setFolderUri: (uri) => {
          sets.push(uri);
        },
        pickDirectory: async () => {
          picks += 1;
          return picked;
        },
      }),
    );
    expect(sets[0]).toBeNull();
    expect(picks).toBe(1);
    expect(outcome).toEqual({
      status: 'ok',
      phoneUri: `content://tree/primary:Uusi/${shareName}`,
      error: null,
    });
    expect(sets).toEqual([null, 'content://tree/primary:Uusi/']);
  });

  it('stays failed when permission is lost and the user does not pick a new folder', async () => {
    let stored: string | null = 'content://tree/primary:Vanha/';
    const outcome = await savePdfToPhoneFolder(
      deps({
        getFolderUri: () => stored,
        setFolderUri: (uri) => {
          stored = uri;
        },
        openDirectory: () => {
          throw new Error('SecurityException: no access');
        },
        pickDirectory: async () => null,
      }),
    );
    expect(outcome).toEqual({ status: 'failed', phoneUri: null, error: PHONE_FOLDER_PERMISSION });
    expect(stored).toBeNull();
  });

  it('skips the phone copy on iOS without opening the picker', async () => {
    let picked = false;
    let read = false;
    const outcome = await savePdfToPhoneFolder(
      deps({
        platform: 'ios',
        readBytes: () => {
          read = true;
          return bytes;
        },
        pickDirectory: async () => {
          picked = true;
          return null;
        },
      }),
    );
    expect(outcome).toEqual({ status: 'skipped', phoneUri: null, error: null });
    expect(picked).toBe(false);
    expect(read).toBe(false);
  });
});

describe('phone status labels', () => {
  it('names the row status, the retry action and the settings row', () => {
    expect(phoneStatusLabel('ok')).toBe(PHONE_STATUS_OK);
    expect(phoneStatusLabel('ok')).toBe('Puhelimessa');
    expect(phoneStatusLabel('skipped')).toBe(PHONE_STATUS_SKIPPED);
    expect(phoneStatusLabel('skipped')).toBe('Ei puhelimessa');
    expect(phoneStatusLabel('failed')).toBe(PHONE_STATUS_FAILED);
    expect(phoneStatusLabel('failed')).toBe('Puhelimeen tallennus epäonnistui');
    expect(phoneSaveActionLabel('ok', 'android')).toBeNull();
    expect(phoneSaveActionLabel('skipped', 'android')).toBe(PHONE_SAVE_TO_PHONE);
    expect(phoneSaveActionLabel('skipped', 'android')).toBe('Tallenna puhelimeen');
    expect(phoneSaveActionLabel('failed', 'android')).toBe(PHONE_SAVE_RETRY);
    expect(phoneSaveActionLabel('failed', 'android')).toBe('Yritä uudelleen');
    expect(phoneSaveActionLabel('skipped', 'ios')).toBeNull();
    expect(phoneSaveActionLabel('failed', 'ios')).toBeNull();
    expect(PHONE_FOLDER_EXPLANATION).toContain('Urakkalaskuri');
    expect(phoneFolderDisplayName(null)).toBe('ei valittu');
    expect(
      phoneFolderDisplayName(
        'content://com.android.externalstorage.documents/tree/primary%3AUrakkalaskuri/',
      ),
    ).toBe('Urakkalaskuri');
    expect(phoneFolderRowLabel(null)).toBe('Puhelimen kansio: ei valittu');
    expect(PHONE_FOLDER_CHANGE).toBe('Vaihda');
  });
});
