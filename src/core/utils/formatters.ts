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

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)} %`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('fi-FI');
}

export function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Yhteenveto: työn kesto tasapäivinä, aina ylöspäin (1.1 → 2). */
export function ceilWorkDurationDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.max(1, Math.ceil(days - 1e-9));
}

export function formatWorkDurationDays(days: number): string {
  return String(ceilWorkDurationDays(days));
}

export function isWorkDurationDaysKey(key: string | undefined): boolean {
  return key === 'tyoryhma_kesto_pv';
}

/** Vanha nimi tulosteissa ja lomaketeksteissä. */
export function displayWorkDurationText(text: string): string {
  if (text === 'Työryhmän arvioitu kesto (pv)') {
    return 'Työn kesto (pv)';
  }
  return text
    .replaceAll('Työryhmän kesto', 'Työn kesto')
    .replaceAll('Työryhmän arvioitu kesto', 'Työn arvioitu kesto')
    .replaceAll('Työryhmän keston', 'Työn keston');
}
