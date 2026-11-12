export const ATTACHMENT_CAPTION_MAX = 120;

export type AttachmentKind = 'image' | 'pdf';

/** Oletus uudelle liitteelle on none (Ei kumpaankaan). */
export type AttachmentDestination = 'offer' | 'card' | 'both' | 'none';

export type Attachment = {
  id: string;
  calculationId: string;
  kind: AttachmentKind;
  destination: AttachmentDestination;
  caption: string;
  fileRelPath: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
};

export type NewAttachmentInput = {
  id: string;
  calculationId: string;
  kind: AttachmentKind;
  /** Puuttuva arvo on none. */
  destination?: AttachmentDestination;
  caption?: string;
  fileRelPath: string;
  mime: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  createdAt?: string;
};

export type AttachmentCopyFailure = {
  sourceId: string;
  message: string;
};
