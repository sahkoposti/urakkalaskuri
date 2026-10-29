/** Tarjouksen päättymispäivä: päiväys + voimassaolo kalenteripäivinä (paikallinen aika). */
export function validUntil(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const add = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;
  result.setDate(result.getDate() + add);
  return result;
}

/** Suomalainen päiväys `d.M.yyyy`, esim. 10.10.2026. */
export function formatFinnishDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}
