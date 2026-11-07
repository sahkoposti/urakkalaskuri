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

function applyAsteriskMarks(text: string): string {
  let index = 0;
  let out = '';
  while (index < text.length) {
    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end !== -1) {
        out += `<strong>${applyAsteriskMarks(text.slice(index + 2, end))}</strong>`;
        index = end + 2;
        continue;
      }
    }
    if (text[index] === '*' && !text.startsWith('**', index)) {
      const end = text.indexOf('*', index + 1);
      if (end !== -1 && text[end - 1] !== '*' && !text.startsWith('**', end)) {
        out += `<em>${text.slice(index + 1, end)}</em>`;
        index = end + 1;
        continue;
      }
    }
    out += text[index];
    index += 1;
  }
  return out;
}

/**
 * Lisätiedot: vain **lihavointi** ja *kursiivi*.
 * HTML escapetaan ensin, joten tägit ja skriptit eivät päädy tulosteeseen.
 */
export function renderMarkedMultiline(value: string | null | undefined): string {
  const escaped = escapeHtml(value ?? '').replace(/\r\n?/g, '\n');
  return escaped
    .split('\n')
    .map((line) => applyAsteriskMarks(line))
    .join('<br />');
}
