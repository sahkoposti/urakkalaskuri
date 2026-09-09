# Urakkalaskurin yhtenäisyystarkistus

> Katselmus 9.9.2026. Pakettiversio koodissa **v1.2.4**.  
> Siivous tehty 9.9.2026: WizardSession poistettu, lomake-editori `structureId`-reitillä, totals-tyypit yhdistetty, kuollut koodi poistettu, UI-primitiivit yhdistetty, `reverseVat` preview-polussa, `database/connection.ts` erotettu.

Sovellus on kesken siirtymässä. Päälaskenta on tuoterakenne-composer (`app/wizard/index.tsx`), ja lomake elää rivin takana (`wizard/line/[lineId]`). Tämä poikkeama vanhasta sivuwizardista selittää suurimman osan muista epäyhtenäisyyksistä.

Elävä kuvaus: [sovellus.md](./sovellus.md). Tuoterakenteet: [tuoterakenteet.md](./tuoterakenteet.md).

---

## Mikä on kunnossa

Teema kulkee pääosin `useThemedStyles` + `useAppColors` kautta. Jaetut primitiivit (`AppPicker`, `ConfirmDialog`, `SettingsNavCard`) ovat käytössä. Lomake-engine (`evaluateFormContext`, kaavat, näkyvyys) on testattu tiheästi. Hinnoittelun ydinrutiinit (`linePricing`, `productPricing`) ovat irti näytöistä.

---

## Kaksoisarkkitehtuuri

Composer on tuotantopolku. Vanha istunto ja globaali lomake ovat yhä kytkettyinä. `setWizardSession` kutsutaan vain `null`-arvolla — täyttä sessiota ei enää kirjoiteta, mutta hydraus lukee sitä yhä.

| Kerros | Nykyinen koodi | Dokumentoitu / vanha malli |
|--------|----------------|----------------------------|
| Päänäyttö | Composer: asiakas + toimitus + tuoterakennerivit | Lomakepohjan sivut järjestyksessä, viimeinen sivu **Laske** |
| Lomake | Per tuoterakenne, avataan rivikortin hammasrattaasta | Yksi globaali `FormDefinition` wizardin sivuille |
| Tallennus | `buildCalculationRecordFromComposer` + `aggregateStructureLines` | `buildCalculationRecord` + `CalculationResult` |
| Istunto | `PersistedWizardDraft` (SQLite). `WizardSession` aina `null` | `WizardSession`: result, formContext, materialLines |
| Asetukset | Asetukset → Tuoterakenteet → Lomake | Asetukset → Lomakeasetukset |

### WizardSession zombie

Tyyppi kantaa yhä `result`, `formContext` ja `materialLines`. Kaikki UI-kutsut ovat `setWizardSession(null)`. Silti `wizard/index.tsx` hydraa `wizardSession.form` jos se olisi olemassa, ja `wizard/summary.tsx` odottaa `editCalculationId`:tä sessiosta.

### Lomake kahteen paikkaan

`saveFormDefinition` kirjoittaa `settings.form_definition` ja aktiivisen tuoterakenteen `form`-kentän. `/settings/calculation` ei näytä, mitä rakennetta muokataan — se riippuu `activeStructureId`:stä, jonka `structures/[id]` asettaa ennen navigointia.

### Kolme identtistä totals-muotoa

| Tyyppi | Tiedosto | Ero |
|--------|----------|-----|
| `CalculationResult` | `calculationPipeline.ts` | Sisältää `workDurationDays`; form-putken tulos |
| `DiscountableTotals` | `discount.ts` | Sama kenttäjoukko; alennus form-putkessa |
| `StructureTotals` | `linePricing.ts` | Ei `workDurationDays`; + `marginPercent`. Composer-polku |

Alennus lasketaan kahdesti eri semantilla: form-putki (`applyDiscountToResult`) vs rivikohtainen ale + `aggregateStructureLines`.

---

## Duplikaattikoodi

| Mitä | Kopiot | Ehdotus |
|------|--------|---------|
| Materiaalisumma | `materialsTotal` (models) ≈ `materialLinesTotal` (fieldEffects) | Yksi funktio. `materialsTotal` näyttää kuolleelta |
| `findFieldByKey` | `pipeline.ts`, `evaluateFormContext.ts`, `applyFieldValueChange.ts` | Käytä `getFieldById` / yhtä helperiä |
| Debug-jälki | `DebugStep` ≈ `FormContextStep` | `pipeline.ts` vain nimeää `evaluateFormContext`-muodon uudelleen |
| Asiakaslabel | `customerTypeLabel` vs `formatCustomerType` | Yksi merkkijonoapuri |
| Asiakas state | wizard, wizard/customer, customers/[id] | `useCustomerFormState` tai nested `CustomerInfo` |
| Päivitä vanhat laskelmat -dialogi | Kolme identtistä `ConfirmDialogia` | Yksi jaettu dialogi |
| NavCard | Koti paikallinen kopio, `SettingsNavCard` jaettu | Lisää `accent`-prop `SettingsNavCardiin` |
| Segmented toggle | `CustomerStep` ja `StructureLineCard` | `ChoiceToggle` |
| Reorder ↑↓ + Poista | pages, pageId, `SelectOptionsEditor` | `ReorderControls` |
| Tuotelomake | `products/new` ja `products/[id]` | Yhteinen `ProductForm` |

---

## Modulaarisuus

Kerrosnimet eivät vastaa riippuvuuksia: `form/pipeline` kutsuu `calculationPipeline` joka kutsuu `evaluateFormContext` ja `wizardPageHelpers`. `AppContext` vie `db`-olion ulos, joten näytöt kytkeytyvät koko persistenssipintaan.

| Tiedosto | Rivejä | Sekoitus |
|----------|--------|----------|
| `database.ts` | ~980 | settings, products, calculations, drafts, forms, structures, customers |
| `wizard/index.tsx` | ~696 | hydraus, luonnos, exit-guard, picker, finish, UI |
| `fields/[fieldId].tsx` | ~636 | validointi, persist, debug-esimerkki, layout |
| `common.tsx` | ~488 | logo, napit, input, ResultRow, loading |
| `calculationPipeline.ts` | ~377 | eval, efektit, preview, finish, result |
| `formDefinitionHelpers.ts` | ~376 | migraatio + kyselyt + topo-sort |
| `evaluateFormContext.ts` | ~349 | parse, tuotteet, näkyvyys, ALV, trace |

`formMutations` on julkisivu: CRUD ja re-export `formDefinitionHelpers`, `formKeyUtils` ja `systemFields`. Importit leviävät yhden barrelin kautta, jolloin vastuut hämärtyvät.

---

## UI-yhtenäisyys

**Tallenna.** Tuotteet, yleinen, teema ja kenttä: dirty-guard + toast + `router.back()`. Sivut jäävät paikalleen. Asiakas: ei dirty-guardia, ei toastia. Wizardin asiakas-nappi on «Valmis». Composerin finish ei näytä «Tallennettu».

**Vahvistus ja tyhjätila.** Osa poistoista käyttää `ConfirmDialog`-suoraan, osa `showAlert`-käärettä. Listojen tyhjätilat ovat eri sävyisiä («Ei tuotteita. Lisää ensimmäinen tuote.» vs «Ei asiakkaita.»). Padding 16 vs 20 sekoittuu.

Teema-asetukset eivät ulotu `secondary`- tai `border`-väreihin. Placeholder on kovakoodattu `#999` kolmessa paikassa. Modaalien overlay on `0.4` tai `0.45`, säde `5` tai `8`.

---

## Kuollut ja jäämäkoodi

| Symboli | Tila |
|---------|------|
| `setWizardSession(non-null)` | Ei yhtään kirjoittajaa; vain nullaus |
| `buildCalculationRecord` | Vain testi; UI käyttää `FromComposer` |
| `MaterialsStep` | Ei UI-importteja. Testitiedosto testaa materials-sivua |
| `BrandIcon` | Vain määrittely `common.tsx`:ssä |
| `mergeMaterialLines` | `groups.flat()`, ei kutsuja |
| `materialsTotal` | Duplikaatti `materialLinesTotal`ista |
| `recordToCustomerInfo` | Alias `customerRecordToInfo`sta |
| `formatMarginCommissionPrice` | Alias `formatCurrency`sta; vain testi |
| `formatContractPriceVat0` | Alias, ei tuotantokutsuja |
| `productFormulaIdentifiers` | UI käyttää `PRODUCT_FORMULA_ATTRIBUTES` |

---

## Muut epäyhtenäisyydet

- **ID:t:** `createId()` (UUID) vs `generateId(prefix)` (timestamp+random).
- `CustomerRecord` asuu `structure/types.ts`.
- Kaava-aliakset (`menekki` / `consumption`) ylläpidetään `productContext.ts`:ssä ja `productAttributes.ts`:ssä erikseen.
- Live-konteksti kutsuu `applyOwnedVatTotals(..., false)` — käänteinen ALV ei näy esikatselussa samoin kuin finishissä.
- Testit kattavat form-enginen hyvin. Ei testejä `database.ts`:lle, `AppContextille` eikä näytöille (poikkeus `appPicker.test.ts`).

---

## Ehdotettu siivousjärjestys

1. ~~Päivitä README ja `sovellus.md` composer-malliin. Merkitse `tuoterakenteet.md` toteutetuksi osin.~~ (tehty 9.9.2026)
2. ~~Poista `WizardSession` tai kutista se. `summary.tsx` ohjaa draft/record-id:llä.~~
3. ~~Lomake-editori saa `structureId` reitissä. Lopeta kaksoiskirjoitus `settings.form_definitioniin`.~~
4. ~~Yksi totals-tyyppi form-finishille, rivihinnoittelulle ja alennukselle.~~ (`PriceTotals` / `DiscountableTotals`; `CalculationResult` ja `StructureTotals` laajentavat)
5. ~~Halkaise `database.ts` domain-tiedostoihin (settings, products, calculations, structures, customers).~~ (`connection.ts` = avaus + migraatiot; `database.ts` = CRUD-julkisivu)
6. ~~Yhdistä NavCard, ChoiceToggle, ReorderControls, ProductForm, customer-state, update-calcs-dialogi.~~
7. ~~Poista `MaterialsStep`, `BrandIcon` ja alias-wrapperit kun testit on siirretty.~~
8. ~~Vie `reverseVat` `evaluateFormContext` / preview-polkuun.~~
