import { ATTACHMENT_CAPTION_MAX } from './types';

/** Rajaa kuvateksti merkkimäärään ennen tallennusta. Laskee Unicode-merkkejä. */
export function clampCaption(value: string): string {
  const chars = [...value];
  return chars.length <= ATTACHMENT_CAPTION_MAX ? value : chars.slice(0, ATTACHMENT_CAPTION_MAX).join('');
}
