const currencyFormatter = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Debug-laskenta: summat/määrät enintään 2 desimaalia (vain näyttö). */
const debugDecimalFormatter = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}

export function formatDebugDecimal(value: number): string {
  return debugDecimalFormatter.format(value);
}

/**
 * Tulosteen määrä ilman tuhaterotinta.
 * Kokonaisluku ilman desimaaleja (`12`, `100000`). Muu luku enintään kahdella desimaalilla (`2,5`, `2,50` ei synny tästä).
 */
export function formatPrintedQuantity(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const [intPart, fracPart] = Math.abs(rounded).toFixed(2).split('.');
  const decimals = fracPart.replace(/0+$/, '');
  return decimals ? `${sign}${intPart},${decimals}` : `${sign}${intPart}`;
}

/**
 * Poistaa tulostetusta tekstistä desimaaliosan, jos se on pelkkiä nollia (`120,0 m²` → `120 m²`, `14,00 kpl` → `14 kpl`).
 * `2,5` ja `2,50` säilyvät. €-merkkijonoa ei muuteta. Tuhaterotinta ei lisätä.
 */
export function stripTrailingZeroDecimals(text: string): string {
  if (!text || text.includes('€')) return text;
  return text.replace(
    /(^|[^\d])(-?\d{1,3}(?:[ \u00a0\u202f]\d{3})*|-?\d+)[.,]0+(?!\d)/g,
    '$1$2',
  );
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)} %`;
}

export function formatVatRate(vatPercent: number): string {
  return percentFormatter.format(vatPercent);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('fi-FI');
}

export function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100 + Number.EPSILON) / 100;
}

export function formatFixed2(value: number): string {
  if (!Number.isFinite(value)) return '';
  return roundToCents(value).toFixed(2).replace('.', ',');
}

/** Rajaa syötteen enintään `maxDecimals` desimaaliin (pilkku tai piste). */
export function limitDecimalInput(raw: string, maxDecimals = 2): string {
  const normalized = raw.replace('.', ',');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const commaIndex = unsigned.indexOf(',');
  if (commaIndex < 0) {
    return `${negative ? '-' : ''}${unsigned.replace(/[^\d]/g, '')}`;
  }
  const intPart = unsigned.slice(0, commaIndex).replace(/[^\d]/g, '');
  const fracPart = unsigned.slice(commaIndex + 1).replace(/[^\d]/g, '').slice(0, maxDecimals);
  return `${negative ? '-' : ''}${intPart},${fracPart}`;
}

/** Yhteenveto: työn kesto tasapäivinä, aina ylöspäin (1.1 → 2). */
export function ceilWorkDurationDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.max(1, Math.ceil(days - 1e-9));
}

/** Yhteenvedon arvioitu kesto: säävarauskerroin ennen ylöspäin pyöristystä. */
export function estimateWorkDurationDays(days: number, weatherReserveFactor = 1): number {
  const factor =
    Number.isFinite(weatherReserveFactor) && weatherReserveFactor > 0 ? weatherReserveFactor : 1;
  return ceilWorkDurationDays(days * factor);
}

export function formatWorkDurationDays(days: number, weatherReserveFactor = 1): string {
  return String(estimateWorkDurationDays(days, weatherReserveFactor));
}

export function isWorkDurationDaysKey(key: string | undefined): boolean {
  return key === 'tyoryhma_kesto_pv';
}

/** Vanha nimi tulosteissa ja lomaketeksteissä. */
export function displayWorkDurationText(text: string): string {
  return text
    .replaceAll('Työryhmän keston', 'Työn keston')
    .replaceAll('Työryhmän arvioitu kesto', 'Työn arvioitu kesto')
    .replaceAll('Työryhmän kesto', 'Työn arvioitu kesto')
    .replace(/Työn kesto(?!n)/g, 'Työn arvioitu kesto');
}
