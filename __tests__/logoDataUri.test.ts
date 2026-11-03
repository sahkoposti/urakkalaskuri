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

import { loadPdfLogoDataUri, pngDataUri, resetPdfLogoCache } from '../src/core/pdf/logoDataUri';

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
});
