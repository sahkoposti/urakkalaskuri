import { fileSystemEntryName } from './documentStorage';
import type { PhoneSaveStatus } from './types';

export const PHONE_FOLDER_NOT_CHOSEN = 'Kansiota ei valittu.';
export const PHONE_FOLDER_PERMISSION = 'Kansion käyttöoikeus puuttuu.';
export const PHONE_SAVE_FAILED = 'Puhelimeen tallennus epäonnistui.';

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

const PERMISSION_ERROR = /permission|securityexception|not granted|access denied|eacces/i;

export function isPhoneFolderPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return PERMISSION_ERROR.test(message);
}

function shortReason(error: unknown): string {
  if (isPhoneFolderPermissionError(error)) return PHONE_FOLDER_PERMISSION;
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return PHONE_SAVE_FAILED;
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
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

async function directoryFromStoredUri(
  deps: PhoneSaveDeps,
  uri: string,
): Promise<PhoneDirectory | PhoneSaveOutcome> {
  try {
    return deps.openDirectory(uri);
  } catch (error) {
    if (!isPhoneFolderPermissionError(error)) {
      return { status: 'failed', phoneUri: null, error: shortReason(error) };
    }
    return askAgain(deps);
  }
}

async function askAgain(deps: PhoneSaveDeps): Promise<PhoneDirectory | PhoneSaveOutcome> {
  await deps.setFolderUri(null);
  const picked = await deps.pickDirectory();
  if (!picked) return { status: 'failed', phoneUri: null, error: PHONE_FOLDER_PERMISSION };
  await deps.setFolderUri(picked.uri);
  return picked;
}

function failedOutcome(error: unknown): PhoneSaveOutcome {
  return { status: 'failed', phoneUri: null, error: shortReason(error) };
}

/**
 * Kopioi sovellukseen jo tallennetun PDF:n puhelimen kansioon.
 * Ei poista lähdettä. Virhe palautetaan tilana, ei heitetä.
 * iOS ohitetaan ilman kansiovalintaa.
 */
export async function savePdfToPhoneFolder(deps: PhoneSaveDeps): Promise<PhoneSaveOutcome> {
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
    const picked = await deps.pickDirectory();
    if (!picked) return { status: 'failed', phoneUri: null, error: PHONE_FOLDER_NOT_CHOSEN };
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
    if (!isPhoneFolderPermissionError(error)) return failedOutcome(error);
    const again = await askAgain(deps);
    if (!('listNames' in again)) return again;
    try {
      const placed = copyPdfIntoDirectory(deps.fileName, bytes, again);
      return { status: 'ok', phoneUri: placed.phoneUri, error: null };
    } catch (retryError) {
      return failedOutcome(retryError);
    }
  }
}
