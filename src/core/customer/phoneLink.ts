/** Soita-painike. Kelvoton tai tyhjä numero ei palauta linkkiä eikä avaa soittoa. */
export function telUrlForSavedPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== 'string') return null;
  const compact = phone.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{5,15}$/.test(compact)) return null;
  return `tel:${compact}`;
}
