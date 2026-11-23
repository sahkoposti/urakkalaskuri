import { File } from 'expo-file-system';

import { PDF_LOGO_PNG_BASE64 } from './pdfLogoPng';

export function pngDataUri(base64: string): string {
  return `data:image/png;base64,${base64.replace(/\s+/g, '')}`;
}

const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp);base64,([a-zA-Z0-9+/=\s]+)$/i;

function imageDataUri(mime: string, base64: string): string {
  const normalized = mime.toLowerCase() === 'jpg' ? 'jpeg' : mime.toLowerCase();
  return `data:image/${normalized};base64,${base64.replace(/\s+/g, '')}`;
}

/** Tiedostopääte ei kerro content-URI:n tyyppiä. Tuntematon tavujono hylätään. */
export function imageMimeFromBase64(base64: string): 'png' | 'jpeg' | 'webp' | null {
  const compact = base64.replace(/\s+/g, '');
  if (compact.startsWith('iVBORw0K')) return 'png';
  if (compact.startsWith('/9j/')) return 'jpeg';
  if (compact.startsWith('UklGR')) return 'webp';
  return null;
}

/** data:, file: tai content: -URI. Kelvoton tai rikki → null, ei heitä. */
export async function customLogoDataUri(uri: string | null | undefined): Promise<string | null> {
  const trimmed = uri?.trim() ?? '';
  if (!trimmed) return null;
  const data = DATA_IMAGE.exec(trimmed);
  if (data) return imageDataUri(data[1], data[2]);
  const readable = /^(file|content):/i.test(trimmed) || trimmed.startsWith('/');
  if (!readable) return null;
  try {
    const bytes = (await new File(trimmed).base64()) ?? '';
    const mime = imageMimeFromBase64(bytes);
    if (!mime) return null;
    return imageDataUri(mime, bytes);
  } catch {
    return null;
  }
}

/**
 * PDF:n logo. Oma tallennettu URI ensin, sitten paketoitu ColoRajaton-logo
 * (pienennetty 1000 px kopio, upotettu vakiona: ks. pdfLogoPng.ts). Ei heitä.
 */
export async function loadPdfLogoDataUri(customUri?: string | null): Promise<string> {
  const custom = await customLogoDataUri(customUri);
  if (custom) return custom;
  return bundledPdfLogoDataUri();
}

/** Paketoitu ColoRajaton-logo data-URI:na. Ei lue tiedostoja. */
export function bundledPdfLogoDataUri(): string {
  return pngDataUri(PDF_LOGO_PNG_BASE64);
}
