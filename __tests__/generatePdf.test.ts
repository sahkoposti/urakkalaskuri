const mockPrint = jest.fn();
const mockShare = jest.fn();
const mockAvailable = jest.fn();
const mockMove = jest.fn();
const mockDelete = jest.fn();
const existing = new Set<string>();

jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrint(...args) }));
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShare(...args),
  isAvailableAsync: () => mockAvailable(),
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return existing.has(this.uri);
    }
    delete() {
      mockDelete(this.uri);
    }
    move(dest: { uri: string }) {
      mockMove(this.uri, dest.uri);
    }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { A4_PORTRAIT, generatePdf } from '../src/core/pdf/generatePdf';

describe('generatePdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existing.clear();
    mockPrint.mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 3 });
    mockAvailable.mockResolvedValue(true);
    mockShare.mockResolvedValue(undefined);
  });

  it('prints A4, renames into cache and shares as PDF', async () => {
    const result = await generatePdf({ html: '<p>x</p>', fileName: 'Tarjous_1_A_2026-01-01.pdf' });
    expect(mockPrint).toHaveBeenCalledWith({ html: '<p>x</p>', width: A4_PORTRAIT.width, height: A4_PORTRAIT.height });
    expect(mockMove).toHaveBeenCalledWith('file:///cache/Print/abc.pdf', 'file:///cache/Tarjous_1_A_2026-01-01.pdf');
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/Tarjous_1_A_2026-01-01.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
    expect(result).toEqual({ uri: 'file:///cache/Tarjous_1_A_2026-01-01.pdf', numberOfPages: 3, shared: true });
  });

  it('replaces an existing file with the same name (reprint)', async () => {
    existing.add('file:///cache/a.pdf');
    await generatePdf({ html: '', fileName: 'a.pdf', share: false });
    expect(mockDelete).toHaveBeenCalledWith('file:///cache/a.pdf');
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('throws a Finnish error when sharing is unavailable', async () => {
    mockAvailable.mockResolvedValue(false);
    await expect(generatePdf({ html: '', fileName: 'a.pdf' })).rejects.toThrow('Jakaminen ei ole käytettävissä');
  });
});
