const mockDownload = jest.fn();
const mockBase64 = jest.fn();

jest.mock('../assets/images/logo-colorajaton-pdf.png', () => 1);
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({
      downloadAsync: mockDownload,
      localUri: 'file:///assets/logo.png',
      uri: 'asset:/logo.png',
    }),
  },
}));
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
  loadPdfLogoDataUri,
  pngDataUri,
  resetPdfLogoCache,
} from '../src/core/pdf/logoDataUri';

describe('logoDataUri', () => {
  beforeEach(() => {
    resetPdfLogoCache();
    jest.clearAllMocks();
    mockBase64.mockResolvedValue('iVBO\nRw0K');
  });

  it('builds a png data uri without whitespace', () => {
    expect(pngDataUri('ab c\nd')).toBe('data:image/png;base64,abcd');
  });

  it('loads the bundled logo once and caches it', async () => {
    await expect(loadPdfLogoDataUri()).resolves.toBe('data:image/png;base64,iVBORw0K');
    await loadPdfLogoDataUri();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockBase64).toHaveBeenCalledWith('file:///assets/logo.png');
  });

  it('uses a saved data or file logo and falls back when it is broken', async () => {
    await expect(customLogoDataUri('data:image/png;base64,abc def')).resolves.toBe('data:image/png;base64,abcdef');
    await expect(loadPdfLogoDataUri('data:image/jpeg;base64,qqqq')).resolves.toBe('data:image/jpeg;base64,qqqq');
    expect(mockDownload).not.toHaveBeenCalled();

    resetPdfLogoCache();
    mockBase64.mockImplementation(async (uri: string) => {
      if (uri === 'file:///custom/logo.png') throw new Error('broken');
      return 'iVBORw0K';
    });
    await expect(loadPdfLogoDataUri('file:///custom/logo.png')).resolves.toBe('data:image/png;base64,iVBORw0K');
    expect(mockDownload).toHaveBeenCalledTimes(1);

    resetPdfLogoCache();
    mockDownload.mockClear();
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
    expect(mockDownload).not.toHaveBeenCalled();
    await expect(loadPdfLogoDataUri('content://media/unknown')).resolves.toBe('data:image/png;base64,iVBORw0K');
    expect(mockDownload).toHaveBeenCalledTimes(1);
    await expect(customLogoDataUri('https://example.invalid/logo.png')).resolves.toBeNull();
  });
});
