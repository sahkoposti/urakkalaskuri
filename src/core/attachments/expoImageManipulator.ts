import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ImageManipulateRequest, ImageManipulateResult } from './processAttachmentImage';

/** Uusi JPEG. Laatu ja mitat tulevat kutsujalta. EXIF ei kopioidu uuteen tiedostoon. */
export async function manipulateAttachmentImage(
  request: ImageManipulateRequest,
): Promise<ImageManipulateResult> {
  const context = ImageManipulator.manipulate(request.uri);
  if (request.resize) context.resize(request.resize);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: request.quality,
    format: SaveFormat.JPEG,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
