/** Valitun tiedoston laji mime-tyypistä tai nimestä. Muu tiedosto hylätään. */
export function pickedFileKind(mime: string, name: string): 'image' | 'pdf' | null {
  const type = mime.trim().toLowerCase();
  const fileName = name.trim().toLowerCase();
  if (type === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(fileName)) return 'image';
  return null;
}
