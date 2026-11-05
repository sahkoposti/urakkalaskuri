export type DocumentKind = 'tarjous' | 'urakkakortti';

export type PhoneSaveStatus = 'ok' | 'failed' | 'skipped';

export type DocumentSummary = {
  total: number | null;
  pages: number;
};

export type TarjousDocumentInputs = {
  offerValidDays: number;
  ktvPersons: number;
  ktvPageIncluded: boolean;
  businessVatMode: 'alv0' | 'sis';
};

export type UrakkakorttiDocumentInputs = {
  urakkakorttiMode: 'alihankkija' | 'tyontekija';
  urakkakorttiHidePrices: boolean;
  urakkakorttiHuomioitavaa: string;
  urakkakorttiRivihinnat: Record<string, number>;
};

export type DocumentInputs = TarjousDocumentInputs | UrakkakorttiDocumentInputs;

export type SavedDocument = {
  id: string;
  calculationId: string;
  kind: DocumentKind;
  offerNumber: number | null;
  version: number;
  fileRelPath: string;
  fileName: string;
  inputs: DocumentInputs | null;
  summary: DocumentSummary | null;
  appVersion: string | null;
  createdAt: string;
  phoneSaveStatus: PhoneSaveStatus;
  phoneUri: string | null;
  /** Lyhyt syy, kun phoneSaveStatus on failed. Ei näytetä onnistuneella rivillä. */
  phoneSaveError: string | null;
};

export type NewDocumentInput = {
  id: string;
  calculationId: string;
  kind: DocumentKind;
  offerNumber: number | null;
  fileRelPath: string;
  fileName: string;
  inputs: DocumentInputs;
  summary: DocumentSummary;
  appVersion: string | null;
  createdAt: string;
};

/** Luo tarjous / Luo urakkakortti palauttaa tämän. Jako ei käynnisty automaattisesti. */
export type ExportedDocument = {
  id: string;
  path: string;
  fileName: string;
  numberOfPages: number;
  kind: DocumentKind;
  offerNumber: number | null;
};
