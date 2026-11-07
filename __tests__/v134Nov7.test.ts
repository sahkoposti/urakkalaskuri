import fs from 'node:fs';
import path from 'node:path';

import { telUrlForSavedPhone } from '../src/core/customer/phoneLink';
import {
  addMaterialShade,
  editMaterialShade,
  materialQuantitiesBlockFinish,
  prefillMaterialQuantities,
  sanitizeMaterialQuantities,
} from '../src/core/materials/materialQuantities';
import type { FormSnapshot, MaterialQuantityRow } from '../src/core/models/types';
import { buildPdfContext, customerHeaderLines } from '../src/core/pdf/buildPdfContext';
import { renderMarkedMultiline } from '../src/core/pdf/escapeHtml';
import { assignOfferNumber, NEXT_OFFER_NUMBER_KEY } from '../src/core/pdf/offerNumber';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { documentSiteAddress, readSiteAddressState } from '../src/core/pdf/siteAddress';
import {
  decideComposerLeave,
  shouldPersistOpenComposer,
} from '../src/core/wizard/wizardDraftHelpers';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { input, line, record } from './pdfFixtures';

describe('v1.3.4 Nov 7 feedback', () => {
  it('keeps the general hourly rate as a short fallback hint', () => {
    const general = fs.readFileSync(path.join(__dirname, '../app/settings/general.tsx'), 'utf8');
    const structure = fs.readFileSync(path.join(__dirname, '../app/settings/structures/[id].tsx'), 'utf8');
    expect(general).toContain('Varahinta, jos tuoterakenteella ei ole omaa tuntihintaa.');
    const commissionBlock = structure.slice(
      structure.indexOf('label="Myyntipalkkio %"'),
      structure.indexOf('HOURLY_RATE_FIELD.label'),
    );
    expect(commissionBlock).not.toContain('sectionHint');
  });

  it('renders only bold and italic and escapes HTML', () => {
    const html = renderMarkedMultiline('Rivi **lihava** ja *kursiivi*\n<script>alert(1)</script>\n*kesken');
    expect(html).toBe(
      'Rivi <strong>lihava</strong> ja <em>kursiivi</em><br />&lt;script&gt;alert(1)&lt;/script&gt;<br />*kesken',
    );
    expect(html).not.toContain('<script>');
  });

  it('prints structure Lisätiedot after the rows and keeps a real Muuta group', () => {
    const base = input(record({}));
    const structures = base.structures.map((item) =>
      item.id === 's1'
        ? {
            ...item,
            form: {
              ...item.form,
              fields: [
                ...item.form.fields,
                {
                  id: 'field_muuta',
                  key: 'vapaa',
                  label: 'Vapaa',
                  type: 'text' as const,
                  required: false,
                  showOnSummary: true,
                  print: { offer: { group: 'muuta' as const }, urakkakortti: { group: 'muuta' as const } },
                },
              ],
              pages: item.form.pages.map((page) =>
                page.id === 'page_surfaces' ? { ...page, fieldIds: [...page.fieldIds, 'field_muuta'] } : page,
              ),
            },
          }
        : item,
    );
    const rec = record({}, {
      structureLines: [
        {
          ...line('a', 's1', 'Ulkomaalaus'),
          additionalInfo: '**Pitkä** lisätieto\nja *toinen* rivi',
          fieldValues: { ...line('a', 's1', 'Ulkomaalaus').fieldValues, vapaa: 'Oikea muuta' },
        },
      ],
    });
    const offer = renderTarjousHtml(buildPdfContext(input(rec, { structures })));
    const card = renderUrakkakorttiHtml(buildUrakkakorttiContext({ ...input(rec, { structures }), record: rec }));
    for (const html of [offer, card]) {
      expect(html).toContain('<strong>Pitkä</strong>');
      expect(html).toContain('<em>toinen</em>');
      expect(html).toContain('>Muuta<');
      expect(html).toContain('Oikea muuta');
      expect(html.indexOf('>Muuta<')).toBeLessThan(html.indexOf('Lisätiedot:'));
      expect(html.indexOf('Lisätiedot:')).toBeGreaterThan(html.indexOf('Ulkomaalaus'));
    }
    expect(card).toContain('class="doc-card"');
    expect(card).not.toContain('@top-left-corner');
    expect(card).toMatch(/\.uk-sum-value \{[^}]*color: #C90000/);
    expect(card).toContain('color: #111');
    expect(offer).toContain('@top-left-corner');
    expect(offer).toContain('class="doc-offer"');
  });

  it('uses the edited site address and leaves a cleared address empty', () => {
    const customer = { address: 'Vanha 1', postalCode: '00100', postalLocality: 'Helsinki' };
    expect(documentSiteAddress(customer, undefined)).toBe('Vanha 1, 00100 Helsinki');
    expect(readSiteAddressState(undefined).missing).toBe(true);
    const edited: FormSnapshot = {
      formId: 'x',
      formVersion: 1,
      fields: [],
      siteAddress: 'Työmaa 5, 33100 Tampere',
      siteAddressTouched: true,
    };
    expect(documentSiteAddress(customer, edited)).toBe('Työmaa 5, 33100 Tampere');
    const cleared: FormSnapshot = { ...edited, siteAddress: '  ', siteAddressTouched: true };
    expect(documentSiteAddress(customer, cleared)).toBe('');
    expect(customerHeaderLines({ name: 'A', ...customer }, '')).toEqual(['A']);
    const rec = record({}, { formSnapshot: edited });
    const offer = renderTarjousHtml(buildPdfContext(input(rec)));
    const card = renderUrakkakorttiHtml(buildUrakkakorttiContext(input(rec)));
    expect(offer).toContain('Työmaa 5, 33100 Tampere');
    expect(card).toContain('Työmaa 5, 33100 Tampere');
    expect(offer).not.toContain('Testitie');
    expect(card).not.toContain('Testitie');
  });

  it('prints each shade with its own quantity and does not invent shades from the form', () => {
    const shades: MaterialQuantityRow[] = [
      {
        id: 'paint',
        productName: 'Nova 7',
        quantity: 0,
        source: 'manual',
        shades: [
          { id: 'g', name: 'G47', quantity: 3, unit: 'l' },
          { id: 'x', name: '505X', quantity: 5, unit: 'l' },
        ],
      },
      { id: 'other', productName: 'Pensseli', quantity: 2, unit: 'kpl', source: 'manual' },
    ];
    const stored = sanitizeMaterialQuantities(shades);
    expect(stored?.[0].shades?.map((shade) => `${shade.name} ${shade.quantity} ${shade.unit}`)).toEqual([
      'G47 3 l',
      '505X 5 l',
    ]);
    const rec = record({}, { structureLines: [{ ...line('a', 's1', 'Maalaus'), materialQuantities: shades }] });
    const ctx = buildUrakkakorttiContext(input(rec));
    expect(ctx.materials.map((row) => `${row.product}|${row.quantity}|${row.unit}|${row.shadeHeader ?? ''}|${row.shade ?? ''}`)).toEqual([
      'Nova 7|||true|',
      'G47|3|l||true',
      '505X|5|l||true',
      'Pensseli|2|kpl||',
    ]);
    const html = renderUrakkakorttiHtml(ctx);
    expect(html).toContain('uk-shade-product');
    expect(html).toContain('Nova 7');
    expect(html).toContain('G47');
    expect(html).toContain('505X');
    expect(html.match(/G47/g)).toHaveLength(1);
    const added = addMaterialShade(shades, 'other');
    const edited = editMaterialShade(added, 'other', added[1].shades?.[0].id ?? '', { name: 'NCS', quantity: 1, unit: 'l' });
    expect(edited[1].shades).toEqual([expect.objectContaining({ name: 'NCS', quantity: 1, unit: 'l' })]);
    expect(edited[0].shades).toHaveLength(2);
    expect(materialQuantitiesBlockFinish([{ ...shades[0], shades: [{ id: 'bad', name: '', quantity: 1 }] }])).toBe(true);
    expect(prefillMaterialQuantities(line('a', 's1', 'Maalaus'), input(rec).structures[0].form, [])).toEqual([]);
  });

  it('uses one offer-number series and does not renumber a reprint', () => {
    expect(NEXT_OFFER_NUMBER_KEY).toBe('pdf_next_offer_number');
    const first = assignOfferNumber(undefined, 10285, 10285);
    const second = assignOfferNumber(undefined, first.nextOfferNumber, 10285);
    const reprint = assignOfferNumber(first.offerNumber, second.nextOfferNumber, 10285);
    expect(first).toMatchObject({ offerNumber: 10285, nextOfferNumber: 10286, assigned: true });
    expect(second).toMatchObject({ offerNumber: 10286, nextOfferNumber: 10287, assigned: true });
    expect(reprint).toMatchObject({ offerNumber: 10285, assigned: false, nextOfferNumber: 10287 });
    expect(assignOfferNumber.length).toBe(3);
  });

  it('opens a tel link only for a saved usable phone number', () => {
    expect(telUrlForSavedPhone('040 123 4567')).toBe('tel:0401234567');
    expect(telUrlForSavedPhone('+358 (40) 123-4567')).toBe('tel:+358401234567');
    expect(telUrlForSavedPhone('')).toBeNull();
    expect(telUrlForSavedPhone('1234')).toBeNull();
    expect(telUrlForSavedPhone('soita minulle')).toBeNull();
    const customers = fs.readFileSync(path.join(__dirname, '../app/customers/index.tsx'), 'utf8');
    expect(customers).toContain('Soita');
    expect(customers).toContain('telUrlForSavedPhone');
    expect(customers).toContain('Poista');
  });

  it('does not auto-save a PDF to the phone folder and has no extra history delete', () => {
    const hook = fs.readFileSync(path.join(__dirname, '../src/components/pdf/usePdfExportForm.ts'), 'utf8');
    const showReady = hook.slice(hook.indexOf('const showReady'), hook.indexOf('const pickPhoneDirectory'));
    expect(showReady).toContain('setReadyPhone(null)');
    expect(showReady).not.toContain('copyPhoneDocument');
    expect(hook).toContain('copyPhoneDocument(document.id, document, true)');
    const history = fs.readFileSync(path.join(__dirname, '../app/history/index.tsx'), 'utf8');
    expect(history).toContain('Keskeneräinen');
    expect(history).not.toContain('Poista');
  });

  it('saves a contentful composer on back and background without a confirm dialog', () => {
    expect(
      decideComposerLeave({
        allowExit: false,
        dirty: true,
        hasContent: true,
        keepResume: false,
        hasSession: false,
      }),
    ).toBe('save-and-leave');
    expect(
      decideComposerLeave({
        allowExit: false,
        dirty: false,
        hasContent: false,
        keepResume: false,
        hasSession: false,
      }),
    ).toBe('leave');
    expect(
      decideComposerLeave({
        allowExit: false,
        dirty: false,
        hasContent: true,
        keepResume: true,
        hasSession: true,
      }),
    ).toBe('leave');
    expect(
      decideComposerLeave({
        allowExit: false,
        dirty: false,
        hasContent: false,
        keepResume: false,
        hasSession: true,
      }),
    ).toBe('clear-and-leave');
    expect(shouldPersistOpenComposer({ dirty: true, hasContent: true })).toBe(true);
    expect(shouldPersistOpenComposer({ dirty: false, hasContent: true })).toBe(false);
    expect(shouldPersistOpenComposer({ dirty: true, hasContent: false })).toBe(false);

    const wizard = fs.readFileSync(path.join(__dirname, '../app/wizard/index.tsx'), 'utf8');
    const leave = wizard.slice(wizard.indexOf("addListener('beforeRemove'"));
    expect(leave).toContain('decideComposerLeave');
    expect(leave).toContain('leaveKeepingDraft');
    expect(wizard).toContain('AppState.addEventListener');
    expect(wizard).toContain('shouldPersistOpenComposer');
    expect(wizard).toContain('publishComposerState');
    expect(wizard).toContain('refreshCalculations');
    expect(wizard).not.toContain('Kesken jäänyt laskenta');
    expect(wizard).toContain('setSiteAddressTouched(true)');
    expect(wizard).toContain('<MaterialQuantitiesEditor');

    const history = fs.readFileSync(path.join(__dirname, '../app/history/index.tsx'), 'utf8');
    expect(history).toContain('useFocusEffect');
    expect(history).toContain('refreshCalculations()');

    const line = fs.readFileSync(path.join(__dirname, '../app/wizard/line/[lineId].tsx'), 'utf8');
    expect(line).toContain('saveOnLeave: true');
    const guard = fs.readFileSync(path.join(__dirname, '../src/hooks/useUnsavedChangesGuard.tsx'), 'utf8');
    expect(guard).toContain("AppState.addEventListener('change'");
    expect(guard).toContain('saveOnLeaveRef.current');
  });
});
