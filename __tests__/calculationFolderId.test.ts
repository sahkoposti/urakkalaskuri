const mockDirectoryDeletes: string[][] = [];

jest.mock('expo-file-system', () => ({
  Directory: class {
    parts: unknown[];
    constructor(...parts: unknown[]) {
      this.parts = parts;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDirectoryDeletes.push(this.parts.map(String));
    }
  },
  File: class {},
  Paths: { document: 'doc' },
}));

import { deleteCalculationAttachmentFolder } from '../src/features/attachments/lib/attachmentFiles';
import { UNSAFE_CALCULATION_FOLDER_ID_WARNING } from '../src/core/documents/calculationFolderId';
import { deleteCalculationDocumentFolder } from '../src/core/documents/documentFiles';

const VALID_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const INVALID_IDS = ['', '.', '..', '../x', 'a/b', 'a\\b', ' a', 'a\u0000'];

describe('delete calculation folders', () => {
  beforeEach(() => {
    mockDirectoryDeletes.length = 0;
  });

  it('deletes a valid UUID folder with the same id segment', () => {
    deleteCalculationDocumentFolder(VALID_ID);
    deleteCalculationAttachmentFolder(VALID_ID);
    expect(mockDirectoryDeletes).toEqual([
      ['doc', 'documents', VALID_ID],
      ['doc', 'attachments', VALID_ID],
    ]);
  });

  it.each(INVALID_IDS)('does not delete a folder for %p', (id) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => deleteCalculationDocumentFolder(id)).not.toThrow();
    expect(() => deleteCalculationAttachmentFolder(id)).not.toThrow();
    expect(mockDirectoryDeletes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(UNSAFE_CALCULATION_FOLDER_ID_WARNING, id);
    warn.mockRestore();
  });
});
