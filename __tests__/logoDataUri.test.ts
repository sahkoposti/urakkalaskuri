const mockBase64 = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    constructor(public uri: string) {}
    base64() {
      return mockBase64(this.uri);
    }
  },
}));

import {
  customLogoDataUri,
  imageMimeFromBase64,
  bundledPdfLogoDataUri,
  loadPdfLogoDataUri,
  pngDataUri,
} from '../src/core/pdf/logoDataUri';

describe('logoDataUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBase64.mockResolvedValue('iVBO\nRw0K');
  });

  it('builds a png data uri without whitespace', () => {
    expect(pngDataUri('ab c\nd')).toBe('data:image/png;base64,abcd');
  });

  it('returns the bundled logo without reading any file (works in release APKs)', async () => {
    const bundled = bundledPdfLogoDataUri();
    expect(bundled.startsWith('data:image/png;base64,iVBORw0K')).toBe(true);
    await expect(loadPdfLogoDataUri()).resolves.toBe(bundled);
    await expect(loadPdfLogoDataUri('')).resolves.toBe(bundled);
    await expect(loadPdfLogoDataUri(null)).resolves.toBe(bundled);
    expect(mockBase64).not.toHaveBeenCalled();
  });

  it('uses a saved data or file logo and falls back when it is broken', async () => {
    await expect(customLogoDataUri('data:image/png;base64,abc def')).resolves.toBe('data:image/png;base64,abcdef');
    await expect(loadPdfLogoDataUri('data:image/jpeg;base64,qqqq')).resolves.toBe('data:image/jpeg;base64,qqqq');
    expect(mockBase64).not.toHaveBeenCalled();

    mockBase64.mockImplementation(async (uri: string) => {
      if (uri === 'file:///custom/logo.png') throw new Error('broken');
      return 'iVBORw0K';
    });
    await expect(loadPdfLogoDataUri('file:///custom/logo.png')).resolves.toBe(bundledPdfLogoDataUri());

    mockBase64.mockImplementation(async (uri: string) => {
      if (uri === 'content://media/logo.jpg') return '/9j/FILEDATA';
      if (uri === 'content://media/42') return 'iVBORw0KGgo';
      if (uri === 'content://media/unknown') return 'not-an-image';
      return 'iVBORw0K';
    });
    expect(imageMimeFromBase64('/9j/FILEDATA')).toBe('jpeg');
    expect(imageMimeFromBase64('iVBORw0KGgo')).toBe('png');
    expect(imageMimeFromBase64('UklGRwebp')).toBe('webp');
    expect(imageMimeFromBase64('not-an-image')).toBeNull();
    await expect(loadPdfLogoDataUri('content://media/logo.jpg')).resolves.toBe('data:image/jpeg;base64,/9j/FILEDATA');
    await expect(loadPdfLogoDataUri('content://media/42')).resolves.toBe('data:image/png;base64,iVBORw0KGgo');
    await expect(loadPdfLogoDataUri('content://media/unknown')).resolves.toBe(bundledPdfLogoDataUri());
    await expect(customLogoDataUri('https://example.invalid/logo.png')).resolves.toBeNull();
  });
});
