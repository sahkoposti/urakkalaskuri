/**
 * Urakkakortin online-summat: vain tarjoukselle, joka on lähetetty online
 * (formSnapshot.onlineOffer on olemassa). Lähettämätön tarjous käyttää laitteen omaa laskentaa.
 */
import type { AppSettings, CalculationRecord } from '@/src/core/models/types';

import { buildContractOffer } from './contractOffer';
import { onlineCardPrint, type OnlineCardPrint } from './onlinePrint';

export function onlineJobCardForRecord(
  record: CalculationRecord,
  settings: Pick<AppSettings, 'workdayHours'>,
  now: Date = new Date(),
): OnlineCardPrint | null {
  if (!record.formSnapshot?.onlineOffer) return null;
  const built = buildContractOffer({ record, workdayHours: settings.workdayHours, now });
  return built.ok ? onlineCardPrint(built.draft) : null;
}
