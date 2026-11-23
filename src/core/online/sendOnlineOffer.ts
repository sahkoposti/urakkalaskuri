/**
 * Tarjouksen online-lähetys: luonnos → valmistelu (numero ja versio palvelimelta) → PDF palvelimen
 * numerolla ja kokonaissenttisummilla → lähetys → tila laskelmalle.
 * Ristiriidassa (409) yritetään kerran alusta uudella valmistelulla. Vanhat tarjoukset pysyvät puhelimessa.
 */
import type { CalculationRecord } from '@/src/core/models/types';
import type { ExportedDocument } from '@/src/core/documents/types';

import { buildContractOffer, contractProblemLines, type ContractOfferDraft } from './contractOffer';
import type { OnlineOfferPrint } from './onlinePrint';
import { OnlineServerError, type ServerClient } from './serverClient';
import { localOfferNumber } from '@/src/core/pdf/exportPdf';

export type SendOnlineOfferDeps = {
  client: Pick<ServerClient, 'prepare' | 'send'>;
  getCalculation: (id: string) => Promise<CalculationRecord | null>;
  saveCalculation: (record: CalculationRecord) => Promise<void>;
  /** Tekee tarjous-PDF:n palvelimen numerolla ja summilla (exportTarjousPdf online-tilassa). */
  exportOffer: (calculationId: string, online: OnlineOfferPrint) => Promise<ExportedDocument>;
  readFileBase64: (path: string) => Promise<string>;
  workdayHours: number;
  companyOfferValidDays?: number;
  sellerName?: string;
  now: () => Date;
};

export type SendOnlineOfferResult = {
  offerNumber: string;
  version: number;
  document: ExportedDocument;
  replay: boolean;
};

const PDF_BASE64_PREFIX = 'JVBERi0'; // "%PDF-"

function sameTotals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function attempt(calculationId: string, deps: SendOnlineOfferDeps): Promise<SendOnlineOfferResult> {
  const record = await deps.getCalculation(calculationId);
  if (!record) throw new Error('Laskelmaa ei löytynyt.');
  const built = buildContractOffer({
    record,
    workdayHours: deps.workdayHours,
    now: deps.now(),
    companyOfferValidDays: deps.companyOfferValidDays,
    sellerName: deps.sellerName,
  });
  if (!built.ok) throw new Error(contractProblemLines(built.problems).join('\n'));
  const draft: ContractOfferDraft = built.draft;
  const prepared = await deps.client.prepare(draft);
  if (!sameTotals(prepared.totals, draft.totals)) {
    throw new Error('Palvelimen summat eivät täsmää puhelimen summiin. Tarjousta ei lähetetty.');
  }
  const document = await deps.exportOffer(calculationId, {
    offerNumber: prepared.offer_number,
    version: prepared.version,
    totals: draft.totals,
  });
  const data = await deps.readFileBase64(document.path);
  if (!data.startsWith(PDF_BASE64_PREFIX)) throw new Error('Tarjous-PDF:n luku epäonnistui. Tarjousta ei lähetetty.');
  const sent = await deps.client.send(
    draft,
    { offer_number: prepared.offer_number, version: prepared.version },
    [
      {
        file_id: `pdf-v${prepared.version}`,
        kind: 'offer_pdf',
        name: document.fileName.slice(0, 200) || 'tarjous.pdf',
        content_type: 'application/pdf',
        data_base64: data,
      },
    ],
  );
  const latest = (await deps.getCalculation(calculationId)) ?? record;
  const offerNumber = localOfferNumber(sent.offer_number);
  const next: CalculationRecord = {
    ...latest,
    ...(offerNumber != null ? { offerNumber } : {}),
    ...(latest.formSnapshot
      ? {
          formSnapshot: {
            ...latest.formSnapshot,
            onlineOffer: {
              offerId: sent.offer_id,
              offerNumber: sent.offer_number,
              version: sent.version,
              sentAt: typeof sent.sent_at === 'number' ? sent.sent_at : deps.now().getTime(),
            },
          },
        }
      : {}),
  };
  await deps.saveCalculation(next);
  return {
    offerNumber: sent.offer_number,
    version: sent.version,
    document,
    replay: (sent as { replay?: boolean }).replay === true,
  };
}

export async function sendOnlineOffer(calculationId: string, deps: SendOnlineOfferDeps): Promise<SendOnlineOfferResult> {
  try {
    return await attempt(calculationId, deps);
  } catch (error) {
    if (error instanceof OnlineServerError && error.code === 'conflict') {
      return attempt(calculationId, deps);
    }
    throw error;
  }
}

/** Käyttäjälle näytettävä virhe ilman teknisiä tunnisteita tai salaisuuksia. */
export function onlineSendErrorMessage(error: unknown): string {
  if (error instanceof OnlineServerError) {
    if (error.code === 'invalid_offer' && error.fields?.length) {
      return `${error.message} (${error.fields.map((f) => f.field).slice(0, 5).join(', ')})`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Lähetys epäonnistui.';
}
