const mockPrint = jest.fn();
const mockMove = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const existing = new Set<string>();

jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrint(...args) }));
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return existing.has(this.uri);
    }
    create() {
      mockCreate(this.uri);
      existing.add(this.uri);
    }
    delete() {
      mockDelete(this.uri);
      existing.delete(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return existing.has(this.uri);
    }
    delete() {
      mockDelete(this.uri);
      existing.delete(this.uri);
    }
    move(dest: { uri: string }) {
      mockMove(this.uri, dest.uri);
      existing.delete(this.uri);
      existing.add(dest.uri);
    }
  }
  return { File, Directory, Paths: { document: { uri: 'file:///docs' }, cache: { uri: 'file:///cache' } } };
});

import { A4_PORTRAIT, generatePdf } from '../src/core/pdf/generatePdf';

describe('generatePdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existing.clear();
    mockPrint.mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 3 });
  });

  it('prints A4 and moves the file under the calculation documents folder', async () => {
    const result = await generatePdf({
      html: '<p>x</p>',
      fileName: 'Tarjous_1_A_2026-01-01.pdf',
      calculationId: 'calc-1',
      documentId: 'doc-1',
    });
    expect(mockPrint).toHaveBeenCalledWith({ html: '<p>x</p>', width: A4_PORTRAIT.width, height: A4_PORTRAIT.height });
    expect(mockCreate).toHaveBeenCalledWith('file:///docs/documents/calc-1');
    expect(mockMove).toHaveBeenCalledWith('file:///cache/Print/abc.pdf', 'file:///docs/documents/calc-1/doc-1.pdf');
    expect(result).toEqual({
      uri: 'file:///docs/documents/calc-1/doc-1.pdf',
      relativePath: 'documents/calc-1/doc-1.pdf',
      numberOfPages: 3,
      fileName: 'Tarjous_1_A_2026-01-01.pdf',
    });
  });

  it('replaces an existing file with the same document id', async () => {
    existing.add('file:///docs/documents/calc-1/doc-1.pdf');
    await generatePdf({ html: '', fileName: 'a.pdf', calculationId: 'calc-1', documentId: 'doc-1' });
    expect(mockDelete).toHaveBeenCalledWith('file:///docs/documents/calc-1/doc-1.pdf');
    expect(mockMove).toHaveBeenCalled();
  });
});
