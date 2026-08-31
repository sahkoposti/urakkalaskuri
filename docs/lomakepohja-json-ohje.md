# Lomakepohjan JSON-ohje

Tämä ohje kertoo, miten Urakkalaskurin lomakepohja (`FormDefinition`) rakennetaan JSON-tiedostona ja tuodaan sovellukseen.

**Esimerkkitiedosto:** [examples/peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json)

---

## 1. Nopea alku

1. Kopioi esimerkki [`docs/examples/peruslaskenta-lomakepohja.json`](./examples/peruslaskenta-lomakepohja.json) uudeksi pohjaksi.
2. Muokkaa kentät, sivut ja kaavat.
3. Validoi JSON (esim. editorin JSON-tarkistus tai [jsonlint.com](https://jsonlint.com)).
4. Avaa sovellus → **Asetukset → Lomakeasetukset → Tuo JSON…**
5. Liitä JSON ja vahvista tuonti.

**Vinkki:** Vie ensin nykyinen pohja (**Vie JSON (leikepöytä)**) ja muokkaa sitä – saat mukaan oikeat järjestelmäkenttä-id:t ja rakenteen.

---

## 2. Tuonti ja vienti

| Toiminto | Polku sovelluksessa |
|----------|---------------------|
| Vie nykyinen pohja | Asetukset → Lomakeasetukset → **Vie JSON (leikepöytä)** |
| Tuo uusi pohja | Asetukset → Lomakeasetukset → **Tuo JSON…** |
| Palauta tehdas oletus | **Palauta oletuslomake** |

Tuonnin jälkeen sovellus **normalisoi** pohjan: lisää järjestelmäkentät, korjaa vanhat avaimet ja siivoaa sivujen kenttäviittaukset.

---

## 3. JSON-rakenne (ylätaso)

```json
{
  "id": "oma_lomake",
  "name": "Oma laskenta",
  "version": 1,
  "updatedAt": 0,
  "pages": [ /* sivut */ ],
  "fields": [ /* kentät */ ]
}
```

| Kenttä | Pakollinen | Kuvaus |
|--------|------------|--------|
| `id` | Suositeltu | Lomakepohjan tunniste (merkkijono) |
| `name` | Kyllä | Näyttönimi asetuksissa |
| `version` | Suositeltu | Kokonaisluku; kasvaa kun pohjaa muokataan sovelluksessa |
| `updatedAt` | Valinnainen | Unix-aika ms; tuonnissa päivittyy automaattisesti |
| `pages` | Kyllä | Wizard-sivujen lista |
| `fields` | Kyllä | Kaikkien kenttien globaali lista |

---

## 4. Sivut (`pages`)

Jokainen wizard-vaihe on yksi sivu. Kentät **eivät** kuulu sivuun upotettuna – ne viitataan `fieldIds`-listalla.

```json
{
  "id": "page_surfaces",
  "title": "Pinta-alat",
  "sortOrder": 1,
  "fieldIds": [
    "field_kiintea_seinapinta",
    "field_laskenta_seinapinta"
  ]
}
```

| Kenttä | Kuvaus |
|--------|--------|
| `id` | Uniikki sivutunniste (esim. `page_xxx`) |
| `title` | Otsikko wizardissa |
| `sortOrder` | Järjestysnumero (0 = ensimmäinen) |
| `fieldIds` | Kenttien `id`-arvot **tässä järjestyksessä** |
| `system` | Valinnainen: `"customer"` = asiakassivu, `"materials"` = materiaalirivit (ei poistettavissa) |

### Järjestelmäsivut

- **`system: "customer"`** – Asiakastiedot (nimi, yhteystiedot). Voit lisätä omia kenttiä `fieldIds`-listaan; ne näkyvät asiakaslomakkeen jälkeen.
- **`system: "materials"`** – Materiaalirivit tuoterekisteristä (tuote + määrä). Rivien summa syötetään kaavamuuttujaan `materiaalit`. Voit lisätä omia kenttiä samaan sivuun.
- **Työryhmän kesto** – Lisää sivulle järjestelmäkentän id: `field_system_tyoryhma_kesto_pv` (avain kaavoissa: `tyoryhma_kesto_pv`).

---

## 5. Kentät (`fields`)

Jokaisella kentällä on globaali määrittely. Sivu valitsee vain mitkä kentät näytetään.

### Pakolliset kentät kaikille tyypeille

```json
{
  "id": "field_esimerkki",
  "key": "pinta_ala",
  "label": "Pinta-ala",
  "type": "number",
  "required": true,
  "showOnSummary": true
}
```

| Kenttä | Kuvaus |
|--------|--------|
| `id` | Uniikki tunniste (viitataan `pages[].fieldIds`) |
| `key` | **Kaavamuuttuja** – vain `a-z`, `0-9`, `_` (ei ä/ö, ei välilyöntiä) |
| `label` | Näyttönimi wizardissa |
| `type` | Kenttätyyppi (taulukko alla) |
| `required` | `true` = pakollinen (tyhjä oletus + ei syötettä = virhe) |
| `showOnSummary` | `true` = näkyy yhteenvedossa |

### Valinnaiset kentät

| Kenttä | Kuvaus |
|--------|--------|
| `unit` | Yksikkö (esim. `"m²"`, `"€"`, `"pv"`) |
| `helpText` | Ohjeteksti kentän alla wizardissa |
| `defaultValue` | Oletusarvo merkkijonona (tyhjä/puuttuu = ei oletusta, **ei 0**) |
| `showWhen` | Näkyvyys ehto (katso kohta 10) |
| `effects` | Vaikutukset laskentaan (katso kohta 11) |
| `debugExampleValue` | Debug-tilan esimerkkiarvo |

---

## 6. Kenttätyypit

| `type` | Kuvaus | JSON-erityispiirteet |
|--------|--------|----------------------|
| `number` | Numero | `unit`, `defaultValue` (esim. `"120"`) |
| `text` | Teksti | `defaultValue` vapaana tekstinä |
| `select` | Valintalista | `options[]`, `defaultValue` = jokin `option.value` |
| `boolean` | Kyllä/Ei-vipu | `defaultValue`: `"true"` tai `"false"` |
| `product_select` | Tuotelista | `defaultValue` = tuotteen `id` tuoterekisteristä |
| `computed` | Laskentakenttä | `formula`, `allowManualOverride` (oletus `true`) |
| `section` | Otsikko | Ei syötettä; `required` yleensä `false` |

### Valintalista (`select`)

```json
{
  "type": "select",
  "options": [
    { "label": "Paneeli", "value": "1.15" },
    { "label": "Hirsi", "value": "1" }
  ],
  "defaultValue": "1.15"
}
```

- `value` on **merkkijono** ja menee kaavoihin numeerisena arvona.
- Käytä pistettä desimaalierottimena (`"1.15"`, ei `"1,15"`).

### Laskentakenttä (`computed`)

```json
{
  "type": "computed",
  "allowManualOverride": true,
  "formula": "(kiintea_seinapinta_ala_m2 - aukkovahennykset) * laudoitustyyppi",
  "unit": "m²"
}
```

- Wizard näyttää kaavan tuloksen live-laskentana.
- Käyttäjä voi ylikirjoittaa arvon; palautus nuoli-painikkeella.

---

## 7. Kaavat

Kaavoissa viitataan muihin kenttiin **`key`-arvolla**, ei `label`-tekstillä.

### Sallitut operaatiot

- Lasku: `+`, `-`, `*`, `/`
- Sulut: `( )`
- Vertailu: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Funktiot: `min(a, b)`, `max(a, b)`, `round(x, desimaalit)`, `if(ehto, then, else)`, `sqrt(x)`

### Esimerkkejä

```text
(kiintea_seinapinta_ala_m2 - aukkovahennykset) * laudoitustyyppi
tyoryhma_kesto_pv * asetukset.tyopaivan_pituus
if(pinta_ala > 100, max(1, round(pinta_ala / 50, 1)), 1)
```

### Puuttuva arvo ja virheet

- **Puuttuva muuttuja** kaavassa = `0` (ei kaada laskentaa).
- **Jako nollalla** = `0`.
- Piilotettu kenttä (`showWhen` ei täyty) = `0` kaavakontekstissa.

---

## 8. Asetukset kaavoissa

Yleiset asetukset (ALV, kate, tuntihinta…) tulevat automaattisesti kaavakontekstiin:

| Muuttuja | Lähde |
|----------|-------|
| `asetukset.alv_prosentti` | ALV % |
| `asetukset.myyntikate_prosentti` | Myyntikatetavoite % |
| `asetukset.myyntipalkkio_prosentti` | Myyntipalkkio % |
| `asetukset.tuntihinta` | Tuntihinta €/h |
| `asetukset.tyoryhman_koko` | Työryhmän koko (hlö) |
| `asetukset.tyopaivan_pituus` | Työpäivän pituus (h) |

Vanhat `settings.*`-muodot toimivat vielä aliasina.

---

## 9. Järjestelmäkentät ja materiaalit

Sovellus **lisää automaattisesti** hinta- ja kestolaskennan järjestelmäkentät tuonnin yhteydessä. Niitä **ei tarvitse** kirjoittaa `fields`-taulukkoon, mutta sivuille voi viitata niiden id:llä.

| `id` (sivuille) | `key` (kaavoissa) | Kuvaus |
|-----------------|-------------------|--------|
| `field_system_tyoryhma_kesto_pv` | `tyoryhma_kesto_pv` | Työryhmän kesto (pv), muokattavissa |
| `field_system_tyoryhma_kesto_h` | `tyoryhma_kesto_h` | Kesto tunneissa (kaava) |
| `field_system_urakka` | `urakka_hinta_alv0` | Urakkahinta alv0 |
| `field_system_kokonaishinta` | `kokonaishinta` | Kokonaishinta (sis. ALV) |
| `field_system_kokonaishinta_alv0` | `kokonaishinta_alv0` | Myyntihinta alv0 |
| `field_system_myyntikate` | `myyntikate` | Myyntikate € |
| `field_system_myyntipalkkio` | `myyntipalkkio` | Myyntipalkkio € |
| `field_system_alv` | `alv_maara` | ALV € |

**Materiaalit:** kaavamuuttuja `materiaalit` (alv0, alkaa 0). Kenttäefektit `add_material_fixed` / `multiply_materials` vaikuttavat tähän.

**Huom:** Osa järjestelmäkentistä on piilotettu asetusten Kentät-listasta, mutta voit sijoittaa ne sivulle JSON:ssa jos haluat näyttää ne wizardissa.

---

## 10. Näkyvyys (`showWhen`)

Näytä kenttä vain kun toinen kenttä täyttää ehdon:

```json
{
  "key": "raystasmetrit",
  "type": "number",
  "showWhen": {
    "fieldKey": "raystaan_aluset",
    "operator": "eq",
    "value": "true"
  }
}
```

| `operator` | Kelpaa lähteille |
|------------|------------------|
| `eq`, `neq` | boolean, select, number, computed |
| `gt`, `lt`, `gte`, `lte` | number, computed |

`value` on aina merkkijono JSON:ssa:
- boolean: `"true"` / `"false"` (tuonnissa myös `true`/`false` kelpaa)
- select: `option.value`
- number: `"10"` tai `"10.5"`

---

## 11. Vaikutukset (`effects`)

Kenttä voi vaikuttaa materiaaleihin tai kestoon laskennan lopussa:

```json
{
  "effects": [
    { "type": "add_material_fixed", "value": 150 },
    { "type": "add_duration", "value": 2 },
    { "type": "multiply_materials", "value": 1.1 },
    { "type": "multiply_duration", "value": 1.05 }
  ]
}
```

| `type` | Vaikutus |
|--------|----------|
| `add_material_fixed` | Lisää € materiaaleihin (`materiaalit`) |
| `multiply_materials` | Kertoo materiaalit |
| `add_duration` | Lisää tunteja kestoon |
| `multiply_duration` | Kertoo keston |

Ilman `value`-kenttää voidaan käyttää kentän omaa arvoa (numero/select/computed) – asetetaan sovelluksen kenttäeditorissa.

---

## 12. Oletusarvot (`defaultValue`)

| Tyyppi | `defaultValue` esimerkki |
|--------|--------------------------|
| number | `"120"` |
| text | `"Huomio asennus"` |
| select | `"1.15"` (option.value) |
| boolean | `"true"` tai `"false"` |
| product_select | tuotteen UUID/id |

- **Tyhjä tai puuttuva** = ei oletusta (kenttä tyhjänä wizardissa, ei nollaa).
- Oletus näytetään valmiina; käyttäjä voi muokata arvoa.
- Oletus huomioidaan validoinnissa ja kaavoissa, jos käyttäjä ei ole muuttanut kenttää.

---

## 13. Tuotelista (`product_select`)

Tuotteet määritellään erikseen (**Tuotteet**-näkymä). Lomake viittaa tuotteeseen id:llä:

```json
{
  "id": "field_maali",
  "key": "kaytettava_maali",
  "label": "Käytettävä maali",
  "type": "product_select",
  "required": true,
  "showOnSummary": true,
  "defaultValue": "abc123-tuote-id"
}
```

Kaavoissa käytettävissä (kun tuote valittu):

```text
kaytettava_maali.yksikkohinta
kaytettava_maali.menekki
kaytettava_maali.tyokerroin
```

Esimerkkikaava:

```text
laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta
```

---

## 14. Täydellinen miniesimerkki

Katso valmis tiedosto: **[examples/peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json)**

Se sisältää:
- Asiakassivun
- Pinta-alasivun (numero, select, computed)
- Kestosivun (järjestelmäkenttä)
- Oletusarvot numero- ja select-kentille

---

## 15. Laajempi esimerkki (ehto + tuote)

```json
{
  "id": "field_onko_raystas",
  "key": "raystaan_aluset",
  "label": "Räystään aluset ja otsalaudat",
  "type": "boolean",
  "required": false,
  "showOnSummary": true,
  "defaultValue": "false"
},
{
  "id": "field_raystas_metrit",
  "key": "raystasmetrit",
  "label": "Räystäsmetrit",
  "type": "number",
  "required": true,
  "showOnSummary": true,
  "unit": "m",
  "showWhen": {
    "fieldKey": "raystaan_aluset",
    "operator": "eq",
    "value": "true"
  }
},
{
  "id": "field_maali",
  "key": "kaytettava_maali",
  "label": "Maali",
  "type": "product_select",
  "required": false,
  "showOnSummary": true
},
{
  "id": "field_maali_hinta",
  "key": "maalin_hinta",
  "label": "Maalin hinta",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "allowManualOverride": true,
  "unit": "€",
  "formula": "laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta"
}
```

Muista lisätä näiden `id`-arvot haluamallesi sivulle `fieldIds`-listaan.

---

## 16. Tarkistuslista ennen tuontia

- [ ] JSON on validi (ei puuttuvia pilkkuja, lainausmerkit kunnossa)
- [ ] `pages` ja `fields` ovat taulukoita
- [ ] Jokainen `pages[].fieldIds`-viite löytyy `fields[].id`:stä **tai** on järjestelmäkentän id
- [ ] Kaikki `key`-arvot ovat uniikkeja ja muotoa `a-z0-9_`
- [ ] `select`-kentillä on vähintään yksi `option`
- [ ] Kaavoissa käytetyt muuttujat ovat olemassa (tai tarkoituksella puuttuvia → 0)
- [ ] `showWhen.fieldKey` viittaa olemassa olevaan kenttään
- [ ] `defaultValue` on merkkijono (numerot lainausmerkeissä)
- [ ] `product_select`-oletusarvo on olemassa oleva tuote-id

---

## 17. Yleisimmät virheet

| Ongelma | Ratkaisu |
|---------|----------|
| Tuonti: „JSON on tyhjä / virheellinen” | Tarkista syntaksi; poista kommentit (JSON ei tue `//`) |
| Tuonti: „puuttuu fields tai pages” | Lisää molemmat taulukot juureen |
| Kenttä ei näy wizardissa | Lisää kentän `id` jollekin sivulle `fieldIds`-listaan |
| Kaava palauttaa 0 | Tarkista `key`-nimet; onko lähdekenttä piilotettu `showWhen`:lla |
| Valinta ei vaikuta kaavaan | `select`-option `value` pitää olla numero merkkijonona |
| Järjestelmähinnat puuttuvat | Varmista kestosivu ja järjestelmäkaavat; tarkista Yleinen-asetukset |

---

## 18. Työnkulku suositus

1. **Suunnittele sivut** – paperilla tai taulukossa: sivun nimi → kentät järjestyksessä.
2. **Määrittele avaimet (`key`)** – lyhyet englanninkieliset/snake_case-nimet kaavoille.
3. **Rakenna JSON** – aloita esimerkistä; lisää kentät `fields`-taulukkoon; linkitä sivut.
4. **Testaa tuonti** – dev-ympäristössä; korjaa virheet.
5. **Kalibroi debug-tilassa** – Asetukset → Debug → esimerkkiarvot ja live-laskenta.
6. **Aja testilaskenta** wizardissa ja tarkista yhteenveto.

---

## 19. Liittyvät tiedostot koodissa

| Tiedosto | Sisältö |
|----------|---------|
| `src/core/form/types.ts` | Tyypit (`FormField`, `FormPage`, …) |
| `src/core/form/formDefinitionIo.ts` | Tuonti / vienti |
| `src/core/form/formDefinitionHelpers.ts` | Normalisointi ja validointi |
| `src/core/form/systemFields.ts` | Järjestelmäkaavat |
| `src/core/form/defaultFormDefinition.ts` | Tehdas oletuslomake |
