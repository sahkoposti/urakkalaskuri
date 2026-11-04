import { Directory, File } from 'expo-file-system';

import {
  getPhoneDocumentsDirectoryUri,
  savePhoneDocumentsDirectoryUri,
} from '@/src/core/database/database';

import {
  PHONE_SAVE_FAILED,
  savePdfToPhoneFolder,
  wrapPhoneDirectory,
  type PhoneDirectory,
  type PhonePlatform,
  type PhoneSaveOutcome,
} from './phoneSave';

/**
 * Lukee tallennetun kansion settings-taulusta ja kopioi PDF:n.
 * Androidin SAF-kutsut ovat tässä ohuessa sovittimessa.
 * Lähdetiedostoa ei poisteta.
 */
export async function copySavedPdfToPhone(input: {
  platform: PhonePlatform;
  fileName: string;
  appFileUri: string;
  pickDirectory: () => Promise<PhoneDirectory | null>;
}): Promise<PhoneSaveOutcome> {
  try {
    return await savePdfToPhoneFolder({
      platform: input.platform,
      fileName: input.fileName,
      readBytes: () => new File(input.appFileUri).bytesSync(),
      getFolderUri: () => getPhoneDocumentsDirectoryUri(),
      setFolderUri: (uri) => savePhoneDocumentsDirectoryUri(uri),
      openDirectory: (uri) => {
        const dir = new Directory(uri);
        if (!dir.exists) throw new Error('Permission denied');
        return wrapPhoneDirectory(dir);
      },
      pickDirectory: input.pickDirectory,
    });
  } catch (error) {
    console.error(error);
    return { status: 'failed', phoneUri: null, error: PHONE_SAVE_FAILED };
  }
}

export async function pickPhoneDirectory(): Promise<PhoneDirectory | null> {
  try {
    return wrapPhoneDirectory(await Directory.pickDirectoryAsync());
  } catch (error) {
    console.error(error);
    return null;
  }
}
