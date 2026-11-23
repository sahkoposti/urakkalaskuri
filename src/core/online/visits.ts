import type { Visit } from './serverClient';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "ti 24.11.2026 klo 9.00–10.30" puhelimen aikavyöhykkeessä. */
export function formatVisitTime(visit: Pick<Visit, 'starts_at' | 'ends_at'>): string {
  const days = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
  const start = new Date(visit.starts_at);
  const end = new Date(visit.ends_at);
  if (!Number.isFinite(start.getTime())) return '';
  const date = `${days[start.getDay()]} ${start.getDate()}.${start.getMonth() + 1}.${start.getFullYear()}`;
  const time = (d: Date) => `${d.getHours()}.${pad2(d.getMinutes())}`;
  return Number.isFinite(end.getTime()) ? `${date} klo ${time(start)}–${time(end)}` : `${date} klo ${time(start)}`;
}

export function visitAddress(visit: Pick<Visit, 'site'>): string {
  const site = visit.site ?? { site_id: null };
  const postal = [site.postcode, site.city].filter((v) => typeof v === 'string' && v.trim()).join(' ');
  return [site.address, postal].filter((v) => typeof v === 'string' && v.trim()).join(', ');
}
