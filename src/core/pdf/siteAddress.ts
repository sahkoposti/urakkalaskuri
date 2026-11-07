import type { CustomerInfo, FormSnapshot } from '@/src/core/models/types';

export const SITE_ADDRESS_KEY = 'siteAddress';
export const SITE_ADDRESS_TOUCHED_KEY = 'siteAddressTouched';

function snapshotRecord(snapshot: FormSnapshot): Record<string, unknown> {
  return snapshot as unknown as Record<string, unknown>;
}

/** Katu ja postiosoite yhdellä rivillä. Tyhjä, jos asiakkaalla ei ole osoitetta. */
export function formatCustomerAddress(
  customer: Pick<CustomerInfo, 'address' | 'postalCode' | 'postalLocality'>,
): string {
  const street = customer.address?.trim() ?? '';
  const postal = [customer.postalCode, customer.postalLocality]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  return [street, postal].filter((part) => part.length > 0).join(', ');
}

export type SiteAddressState = {
  /** Puuttuva avain. Vanha laskelma käyttää asiakkaan osoitetta. */
  missing: boolean;
  /** Käyttäjä on muokannut tai tyhjentänyt kentän. */
  touched: boolean;
  text: string;
};

export function readSiteAddressState(snapshot: FormSnapshot | null | undefined): SiteAddressState {
  if (!snapshot || !Object.prototype.hasOwnProperty.call(snapshot, SITE_ADDRESS_KEY)) {
    return { missing: true, touched: false, text: '' };
  }
  const raw = snapshotRecord(snapshot)[SITE_ADDRESS_KEY];
  const text = typeof raw === 'string' ? raw : '';
  const touched = snapshotRecord(snapshot)[SITE_ADDRESS_TOUCHED_KEY] === true;
  return { missing: false, touched, text };
}

/**
 * Tulosteen osoite.
 * Puuttuva avain = laskelmaan tallennettu asiakasosoite.
 * Koskettu tyhjä merkkijono pysyy tyhjänä.
 */
export function documentSiteAddress(
  customer: Pick<CustomerInfo, 'address' | 'postalCode' | 'postalLocality'>,
  snapshot: FormSnapshot | null | undefined,
): string {
  const state = readSiteAddressState(snapshot);
  if (state.missing) return formatCustomerAddress(customer);
  return state.text.trim();
}

export function siteAddressSnapshotPatch(
  text: string,
  touched: boolean,
): Pick<FormSnapshot, 'siteAddress' | 'siteAddressTouched'> {
  return {
    siteAddress: text,
    siteAddressTouched: touched,
  };
}

/** Kirjoittaa tai poistaa kohteen osoitteen. Koskematon kenttä ei tallenna avainta. */
export function applySiteAddressSnapshot<T extends { formSnapshot?: FormSnapshot }>(
  record: T,
  text: string,
  touched: boolean,
): T {
  const snapshot: FormSnapshot = {
    ...(record.formSnapshot ?? { formId: 'wizard-draft', formVersion: 0, fields: [] }),
  };
  if (!touched) {
    delete snapshot.siteAddress;
    delete snapshot.siteAddressTouched;
  } else {
    snapshot.siteAddress = text;
    snapshot.siteAddressTouched = true;
  }
  return { ...record, formSnapshot: snapshot };
}
