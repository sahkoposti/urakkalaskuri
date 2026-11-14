import { randomUUID } from 'expo-crypto';

import { defaultAttachmentPdfDeps, listAttachments } from '@/src/features/attachments';
import { readAppVersion } from '../documents/appVersion';
import { removeStoredPdf } from '../documents/documentFiles';
import { insertDocument } from '../documents/documentsRepository';
import {
  assignOfferNumberForCalculation,
  getCalculation,
  getCompanyProfile,
  getOfferCompanySettings,
  getOfferStructureSettings,
  saveCalculation,
  saveManualContractPrices,
} from '../database/database';
import type { PdfExportDeps } from './exportPdf';
import { generatePdf } from './generatePdf';
import { loadPdfLogoDataUri } from './logoDataUri';

/** Oikeat riippuvuudet (SQLite, expo-print, expo-sharing, paketoitu logo). */
export const pdfExportDeps: PdfExportDeps = {
  getCalculation,
  assignOfferNumber: assignOfferNumberForCalculation,
  saveManualContractPrices,
  saveCalculation,
  getCompanyProfile,
  getOfferCompanySettings,
  getOfferStructureSettings,
  loadLogoDataUri: async (logoUri) => {
    try {
      return await loadPdfLogoDataUri(logoUri);
    } catch {
      return null; // logon puuttuminen ei estä PDF:ää
    }
  },
  generatePdf,
  newDocumentId: () => randomUUID(),
  appVersion: () => readAppVersion(),
  insertDocument,
  removeStoredPdf,
  now: () => new Date(),
  listAttachments,
  attachmentPdfDeps: defaultAttachmentPdfDeps(),
};
