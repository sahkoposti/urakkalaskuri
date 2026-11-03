/** HTML-escape kaikelle käyttäjän tekstille (asiakas, lomakkeen otsikot, lisätiedot). */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Monirivinen teksti: escape + rivinvaihdot <br />:ksi. */
export function escapeMultiline(value: string | null | undefined): string {
  return escapeHtml(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .join('<br />');
}
