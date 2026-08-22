function slugifyCore(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Muodostaa keyn labelista; tyhjä label → `kentta`. */
export function slugifyKey(label: string): string {
  return slugifyCore(label) || 'kentta';
}

/** Muuttuja-kentän live-syöte: sallii tyhjän arvon ja alaviivat kirjoituksen aikana. */
export function sanitizeKeyInput(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9_]/g, '');
}
