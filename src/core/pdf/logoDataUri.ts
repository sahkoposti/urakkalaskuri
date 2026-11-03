import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

/**
 * PDF:n logo: pienennetty kopio (1000 px leveä, ~30 KB) brändilogosta.
 * Alkuperäinen logo-colorajaton.png on 20077 px leveä / 661 KB, liian raskas
 * base64-upotukseen jokaiseen PDF:ään.
 */
const PDF_LOGO_MODULE = require('../../../assets/images/logo-colorajaton-pdf.png');

export function pngDataUri(base64: string): string {
  return `data:image/png;base64,${base64.replace(/\s+/g, '')}`;
}

let cached: string | null = null;

/** Lataa paketoidun logon ja palauttaa sen data-URI:na (välimuistitettu). */
export async function loadPdfLogoDataUri(): Promise<string> {
  if (cached) return cached;
  const asset = Asset.fromModule(PDF_LOGO_MODULE);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('PDF-logon polkua ei löytynyt');
  const base64 = await new File(uri).base64();
  cached = pngDataUri(base64);
  return cached;
}

/** Vain testejä varten. */
export function resetPdfLogoCache(): void {
  cached = null;
}
