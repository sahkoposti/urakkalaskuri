/**
 * Rakenteen Määrä on kappalemäärä.
 * Tämä on ainoa paikka, jossa määrä kertoo yksikköhinnan, urakan,
 * materiaalien eurot ja määrät sekä työtunnit.
 * Kuluttajat kutsuvat näitä funktioita eivätkä kerro määrällä itse.
 */

/**
 * Kerroin.
 * Puuttuva määrä on yksi kappale (vanha rivi ilman kenttää).
 * Tasan 0, negatiivinen ja ei-luku eivät kerrytä — sama sääntö kuin myyntihinnalla.
 */
export function lineQuantityMultiplier(quantity: number | null | undefined): number {
  if (quantity == null) return 1;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return quantity;
}

/** Ainoa kertolasku. Ei-lukuinen summa on 0. */
export function scaleByLineQuantity(amount: number, quantity: number | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  return amount * lineQuantityMultiplier(quantity);
}

export type ScaledWorkDuration = {
  /** Yksikön tunnit × määrä. */
  hours: number;
  /** Kokonaistunnit / työpäivän pituus. Ei päiviä × määrä. */
  days: number;
};

/**
 * Rivin `workDurationDays` on yksikön työpäiviä: tunnit / asetukset.tyopaivan_pituus
 * (`settings.workdayHours`).
 * Määrä kertoo tunnit. Päivät johdetaan kokonaistunneista samalla pituudella.
 * Esim. 6 h, määrä 3 ja työpäivä 8 h → 18 h ja 2,25 pv.
 * Kelvoton pituus ei keksi muunnosta: päivät jäävät yksikön päiviksi.
 */
export function scaleWorkDuration(
  workDurationDays: number,
  quantity: number | null | undefined,
  workdayHours: number,
): ScaledWorkDuration {
  const storedDays = Number.isFinite(workDurationDays) && workDurationDays > 0 ? workDurationDays : 0;
  const dayLength = Number.isFinite(workdayHours) && workdayHours > 0 ? workdayHours : 0;
  if (dayLength === 0) return { hours: 0, days: storedDays };
  const unitHours = storedDays * dayLength;
  const hours = scaleByLineQuantity(unitHours, quantity);
  return { hours, days: hours / dayLength };
}
