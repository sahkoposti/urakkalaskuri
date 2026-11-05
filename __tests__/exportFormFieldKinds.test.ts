import fs from 'fs';
import path from 'path';

import {
  CARD_EXPORT_FIELD_KINDS,
  OFFER_EXPORT_FIELD_KINDS,
} from '../src/components/pdf/exportFormFieldKinds';
import { textInputPropsFor } from '../src/components/textInputProps';

describe('export form field kinds', () => {
  test('offer and card fields use the kinds the old export buttons had', () => {
    expect(OFFER_EXPORT_FIELD_KINDS).toEqual({
      ktvPersons: 'integer',
      validDays: 'integer',
      validDate: 'code',
    });
    expect(CARD_EXPORT_FIELD_KINDS).toEqual({
      rowPrice: 'decimal',
      huomio: 'sentence',
    });
    expect(textInputPropsFor(OFFER_EXPORT_FIELD_KINDS.ktvPersons)).toMatchObject({
      keyboardType: 'numeric',
      autoCapitalize: 'none',
    });
    expect(textInputPropsFor(OFFER_EXPORT_FIELD_KINDS.validDays).autoCapitalize).toBe('none');
    expect(textInputPropsFor(OFFER_EXPORT_FIELD_KINDS.validDate)).toMatchObject({
      autoCapitalize: 'none',
      keyboardType: 'default',
    });
    expect(textInputPropsFor(CARD_EXPORT_FIELD_KINDS.rowPrice).keyboardType).toBe('decimal-pad');
    expect(textInputPropsFor(CARD_EXPORT_FIELD_KINDS.huomio).autoCapitalize).toBe('sentences');
  });

  test('both forms import the shared kind table', () => {
    const offer = fs.readFileSync(
      path.join(__dirname, '../src/components/pdf/TarjousExportForm.tsx'),
      'utf8',
    );
    const card = fs.readFileSync(
      path.join(__dirname, '../src/components/pdf/UrakkakorttiExportForm.tsx'),
      'utf8',
    );
    expect(offer).toContain("from './exportFormFieldKinds'");
    expect(offer).toContain('kind={OFFER_EXPORT_FIELD_KINDS.ktvPersons}');
    expect(offer).toContain('kind={OFFER_EXPORT_FIELD_KINDS.validDays}');
    expect(offer).toContain('kind={OFFER_EXPORT_FIELD_KINDS.validDate}');
    expect(offer).not.toContain('keyboardType=');
    expect(card).toContain("from './exportFormFieldKinds'");
    expect(card).toContain('kind={CARD_EXPORT_FIELD_KINDS.rowPrice}');
    expect(card).toContain('kind={CARD_EXPORT_FIELD_KINDS.huomio}');
    expect(card).not.toContain('keyboardType=');
  });
});
