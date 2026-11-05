import { fileSystemEntryName } from './documentStorage';
import type { PhoneSaveStatus } from './types';

export const PHONE_FOLDER_NOT_CHOSEN = 'Kansiota ei valittu.';
export const PHONE_FOLDER_PERMISSION = 'Kansion käyttöoikeus puuttuu.';
export const PHONE_FOLDER_MISSING = 'Kansiota ei löytynyt. Valitse kansio uudelleen.';
export const PHONE_NOT_SAVED_ON_PHONE = 'Ei tallennettu puhelimeen';
export const PHONE_SAVE_FAILED = 'Puhelimeen tallennus epäonnistui.';
export const PHONE_DOWNLOAD_SAVED = 'Dokumentti tallennettiin puhelimen kansioon.';
export const PHONE_FOLDER_TEMPORARY_NOTE =
  'Tämä on väliaikainen ja poistuu versiossa 1.4. Dokumentit ladataan silloin puhelimeen.';

export function phoneDownloadNotice(outcome: {
  status: string;
  error?: string | null;
}): { kind: 'success' | 'error'; message: string } {
  if (outcome.status === 'ok') return { kind: 'success', message: PHONE_DOWNLOAD_SAVED };
  return { kind: 'error', message: phoneSaveErrorText(outcome.error) ?? PHONE_SAVE_FAILED };
}

/** Tietokantaan tallennettava syy. Suomenkielinen teksti tulee näyttövaiheessa. */
export const PHONE_SAVE_ERROR_CODES = [
  'no_folder',
  'cancelled',
  'permission',
  'folder_missing',
  'write_failed',
  'unknown',
] as const;

export type PhoneSaveErrorCode = (typeof PHONE_SAVE_ERROR_CODES)[number];

const PHONE_SAVE_ERROR_TEXT: Record<PhoneSaveErrorCode, string> = {
  no_folder: PHONE_FOLDER_NOT_CHOSEN,
  cancelled: PHONE_NOT_SAVED_ON_PHONE,
  permission: PHONE_FOLDER_PERMISSION,
  folder_missing: PHONE_FOLDER_MISSING,
  write_failed: PHONE_SAVE_FAILED,
  unknown: PHONE_SAVE_FAILED,
};

export function isPhoneSaveErrorCode(value: string): value is PhoneSaveErrorCode {
  return (PHONE_SAVE_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Koodi näytetään suomeksi. Vanha vapaa teksti ei ole koodi: yleinen suomenkielinen virhe.
 */
export function phoneSaveErrorText(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  if (isPhoneSaveErrorCode(stored)) return PHONE_SAVE_ERROR_TEXT[stored];
  return PHONE_SAVE_FAILED;
}

/** Istunnon muisti: käyttäjä peruutti kansiovalinnan. Ei tallennu tietokantaan. */
let phoneFolderChoiceDeclined = false;

export function phoneFolderChoiceWasDeclined(): boolean {
  return phoneFolderChoiceDeclined;
}

export function resetPhoneFolderChoice(): void {
  phoneFolderChoiceDeclined = false;
}

export type PhonePlatform = 'android' | 'ios';

export type PhoneFile = {
  uri: string;
  write(bytes: Uint8Array): void;
};

/** Kansio, johon testi tai SAF-sovitin kirjoittaa. Ei ylikirjoita olemassa olevaa nimeä. */
export type PhoneDirectory = {
  uri: string;
  listNames(): string[];
  createFile(name: string, mimeType: string): PhoneFile;
};

export type PhoneSaveOutcome = {
  status: PhoneSaveStatus;
  phoneUri: string | null;
  error: string | null;
};

export type PhoneSaveDeps = {
  platform: PhonePlatform;
  fileName: string;
  readBytes(): Uint8Array;
  getFolderUri(): Promise<string | null> | string | null;
  setFolderUri(uri: string | null): Promise<void> | void;
  openDirectory(uri: string): PhoneDirectory;
  pickDirectory(): Promise<PhoneDirectory | null>;
};

export type PhoneSaveOptions = {
  /** Käyttäjän Tallenna puhelimeen -painike avaa valitsimen, vaikka valinta olisi peruttu. */
  manual?: boolean;
};

const PERMISSION_ERROR = /permission|securityexception|not granted|access denied|eacces/i;

export function isPhoneFolderPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return PERMISSION_ERROR.test(message);
}

export function phoneSaveErrorCode(error: unknown): PhoneSaveErrorCode {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message === 'folder_missing' || /enoent|no such file|does not exist/i.test(message)) {
    return 'folder_missing';
  }
  if (isPhoneFolderPermissionError(error)) return 'permission';
  if (!message.trim()) return 'unknown';
  return 'write_failed';
}

/** Puuttuva kansio ei ole käyttöoikeusvirhe. Sovitin heittää tämän, kun exists on epätosi. */
export function missingPhoneFolderError(): Error {
  return new Error('folder_missing');
}

/** `Tarjous.pdf` on jo kansiossa → `Tarjous (2).pdf`. Alkuperäistä nimeä ei korvata. */
export function uniquePhoneFileName(fileName: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(fileName)) return fileName;
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  let number = 2;
  let candidate = `${base} (${number})${ext}`;
  while (taken.has(candidate)) {
    number += 1;
    candidate = `${base} (${number})${ext}`;
  }
  return candidate;
}

type PhoneDirectoryLike = {
  uri: string;
  list(): readonly { uri: string }[];
  createFile(name: string, mimeType: string | null): {
    uri: string;
    write(content: string | Uint8Array): void;
  };
};

/**
 * SAF-listauksen nimet. expo-file-system 19.0.24 lisää hakemiston ja
 * Android-listauksen URI:in loppuun `/`, joten nimi luetaan ilman sitä.
 */
export function wrapPhoneDirectory(dir: PhoneDirectoryLike): PhoneDirectory {
  return {
    uri: dir.uri,
    listNames() {
      return dir.list().map((entry) => fileSystemEntryName(entry.uri));
    },
    createFile(name, mimeType) {
      const file = dir.createFile(name, mimeType);
      return {
        uri: file.uri,
        write(bytes) {
          file.write(bytes);
        },
      };
    },
  };
}

export function copyPdfIntoDirectory(
  fileName: string,
  bytes: Uint8Array,
  directory: PhoneDirectory,
): { phoneUri: string; storedName: string } {
  const storedName = uniquePhoneFileName(fileName, directory.listNames());
  const file = directory.createFile(storedName, 'application/pdf');
  file.write(bytes);
  return { phoneUri: file.uri, storedName };
}

function declinedChoice(): PhoneSaveOutcome {
  phoneFolderChoiceDeclined = true;
  return { status: 'skipped', phoneUri: null, error: 'cancelled' };
}

async function directoryFromStoredUri(
  deps: PhoneSaveDeps,
  uri: string,
): Promise<PhoneDirectory | PhoneSaveOutcome> {
  try {
    return deps.openDirectory(uri);
  } catch (error) {
    const code = phoneSaveErrorCode(error);
    if (code !== 'permission' && code !== 'folder_missing') {
      return { status: 'failed', phoneUri: null, error: code };
    }
    return askAgain(deps, code);
  }
}

async function askAgain(
  deps: PhoneSaveDeps,
  code: 'permission' | 'folder_missing',
): Promise<PhoneDirectory | PhoneSaveOutcome> {
  await deps.setFolderUri(null);
  const picked = await deps.pickDirectory();
  if (!picked) {
    phoneFolderChoiceDeclined = true;
    return { status: 'failed', phoneUri: null, error: code };
  }
  phoneFolderChoiceDeclined = false;
  await deps.setFolderUri(picked.uri);
  return picked;
}

function failedOutcome(error: unknown): PhoneSaveOutcome {
  return { status: 'failed', phoneUri: null, error: phoneSaveErrorCode(error) };
}

/**
 * Kopioi sovellukseen jo tallennetun PDF:n puhelimen kansioon.
 * Ei poista lähdettä. Virhe palautetaan tilana, ei heitetä.
 * iOS ohitetaan ilman kansiovalintaa.
 */
export async function savePdfToPhoneFolder(
  deps: PhoneSaveDeps,
  options: PhoneSaveOptions = {},
): Promise<PhoneSaveOutcome> {
  if (deps.platform !== 'android') {
    return { status: 'skipped', phoneUri: null, error: null };
  }

  let bytes: Uint8Array;
  try {
    bytes = deps.readBytes();
  } catch (error) {
    return failedOutcome(error);
  }

  let directory: PhoneDirectory;
  const stored = await deps.getFolderUri();
  if (!stored) {
    if (!options.manual && phoneFolderChoiceDeclined) return declinedChoice();
    const picked = await deps.pickDirectory();
    if (!picked) return declinedChoice();
    phoneFolderChoiceDeclined = false;
    await deps.setFolderUri(picked.uri);
    directory = picked;
  } else {
    const opened = await directoryFromStoredUri(deps, stored);
    if (!('listNames' in opened)) return opened;
    directory = opened;
  }

  try {
    const placed = copyPdfIntoDirectory(deps.fileName, bytes, directory);
    return { status: 'ok', phoneUri: placed.phoneUri, error: null };
  } catch (error) {
    const code = phoneSaveErrorCode(error);
    if (code !== 'permission' && code !== 'folder_missing') return failedOutcome(error);
    const again = await askAgain(deps, code);
    if (!('listNames' in again)) return again;
    try {
      const placed = copyPdfIntoDirectory(deps.fileName, bytes, again);
      return { status: 'ok', phoneUri: placed.phoneUri, error: null };
    } catch (retryError) {
      return failedOutcome(retryError);
    }
  }
}
