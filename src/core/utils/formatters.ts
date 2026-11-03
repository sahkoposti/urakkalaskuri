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

const PURE_ZERO_FRACTION = /^(-?\d+),0+$/;

/**
 * Kokonaisluvuksi vain, kun koko merkkijono on sovelluksen muotoilema luku (`2,0` → `2`, `14,0` → `14`).
 * Jos `unit` on annettu, sama luku ja täsmälleen se yksikkö kelpaa (`120,0 m²` kun yksikkö on `m²`).
 * Vapaata tekstiä ei muuteta (`1.000 m²`, `klo 8.00`). `2,5` ja `2,50` säilyvät.
 */
export function stripTrailingZeroDecimals(text: string, unit?: string): string {
  const trimmed = text.trim();
  const pure = PURE_ZERO_FRACTION.exec(trimmed);
  if (pure) return pure[1];
  const normalizedUnit = unit?.trim();
  if (!normalizedUnit) return text;
  const suffix = ` ${normalizedUnit}`;
  if (!trimmed.endsWith(suffix)) return text;
  const head = PURE_ZERO_FRACTION.exec(trimmed.slice(0, -suffix.length));
  return head ? `${head[1]}${suffix}` : text;
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
