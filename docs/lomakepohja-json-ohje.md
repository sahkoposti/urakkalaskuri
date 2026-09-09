# Lomakepohjan JSON-ohje

Tämä ohje kertoo, miten Urakkalaskurin lomakepohja (`FormDefinition`) rakennetaan JSON-tiedostona ja tuodaan sovellukseen.

**Sovelluksen toiminta (näytöt, tallennus, hinnoittelu):** [sovellus.md](./sovellus.md)

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
| `system` | Valinnainen: `"customer"` = asiakassivu (ainoa poistamaton sivu), `"materials"` = materiaalirivit tuoterekisteristä |

### Järjestelmäsivut

- **`system: "customer"`** – Asiakastiedot (nimi, yhteystiedot). Voit lisätä omia kenttiä `fieldIds`-listaan; ne näkyvät asiakaslomakkeen jälkeen. Tätä sivua ei voi poistaa.
- **`system: "materials"`** – Valinnainen tuote+määrä -rivi-editori. Summa menee kaavamuuttujaan `materiaalit`. **Oletuspohjassa ei ole tätä sivua** (materiaalit tulevat usein kaavoista ja `add_material_fixed`-efekteistä). Sivu voidaan poistaa asetuksista. Älä lisää sitä, jos lasket materiaalit jo omilla kentillä – muuten wizardissa näkyy tyhjä Materiaalit-vaihe.
- **Työn kesto** – Lisää sivulle `field_system_tyoryhma_kesto_pv` (kaava-avain `tyoryhma_kesto_pv`).
- **Alennus %** – Lisää sivulle `field_system_alennus_prosentti` (kaava-avain `alennus_prosentti`). Oletus `0`.

Sama `pages[].id` ei saa toistua; tuonti uniikistaa kaksoiskappaleet (`page_materials` → `page_materials_2`).

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
- Funktiot: `min(a, b)`, `max(a, b)`, `round(x, desimaalit)`, `if(ehto, then, else)`, `sqrt(x)`, `liukuva_myyntihinta(suorat_kustannukset_alv0)`

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
| `asetukset.myyntikate_prosentti` | Myyntikatetavoite % (yksittäinen; vanhat kaavat) |
| `asetukset.myyntikate_alaraja_eur` | Liukuvan katteen alaraja € |
| `asetukset.myyntikate_alaraja_prosentti` | Kate % alarajalla |
| `asetukset.myyntikate_ylaraja_eur` | Liukuvan katteen yläraja € |
| `asetukset.myyntikate_ylaraja_prosentti` | Kate % ylärajalla |
| `asetukset.myyntipalkkio_prosentti` | Myyntipalkkio % |
| `asetukset.tuntihinta` | Tuntihinta €/h |
| `asetukset.tyoryhman_koko` | Työryhmän koko (hlö) |
| `asetukset.tyopaivan_pituus` | Työpäivän pituus (h) |

Vanhat `settings.*`-muodot toimivat vielä aliasina.

**Liukuva myyntihinta (alv0)** suorista kustannuksista:

```text
liukuva_myyntihinta(suorat_kustannukset_alv0)
```

Käytä tätä `kokonaishinta_alv0`-kaavana, jos hinnoittelet liukuvalla katteella. Älä kerro tulosta alennusprosentilla – alennus sovelletaan järjestelmässä listahinnan jälkeen.

---

## 9. Järjestelmäkentät ja materiaalit

Sovellus **lisää automaattisesti** hinta- ja kestolaskennan järjestelmäkentät tuonnin yhteydessä. Niitä **ei tarvitse** kirjoittaa `fields`-taulukkoon, mutta sivuille voi viitata niiden id:llä.

| `id` (sivuille) | `key` (kaavoissa) | Kuvaus |
|-----------------|-------------------|--------|
| `field_system_tyoryhma_kesto_pv` | `tyoryhma_kesto_pv` | Työn kesto (pv), muokattavissa |
| `field_system_tyoryhma_kesto_h` | `tyoryhma_kesto_h` | Kesto tunneissa (kaava) |
| `field_system_alennus_prosentti` | `alennus_prosentti` | Alennus % (0–100), oletus 0 |
| `field_system_alennus_eur` | `alennus_eur` | Alennus € (laskettu, piilotettu Kentät-listasta) |
| `field_system_urakka` | `urakka_hinta_alv0` | Urakkahinta alv0 |
| `field_system_kokonaishinta` | `kokonaishinta` | Kokonaishinta (sis. ALV) |
| `field_system_kokonaishinta_alv0` | `kokonaishinta_alv0` | Myyntihinta alv0 |
| `field_system_myyntikate` | `myyntikate` | Myyntikate € |
| `field_system_myyntipalkkio` | `myyntipalkkio` | Myyntipalkkio € |
| `field_system_alv` | `alv_maara` | ALV € |

**Alennus:** lisää `field_system_alennus_prosentti` jollekin sivulle. Sovellus vähentää prosentin listahinnasta; kate yhteenvedossa on alennuksen jälkeen. Älä kirjoita `(1 - alennus_prosentti/100)` myyntihintakaavaan.

**Materiaalit:** kaavamuuttuja `materiaalit` (alv0, alkaa 0). Kenttäefektit `add_material_fixed` / `multiply_materials` vaikuttavat tähän.

**Huom:** Osa järjestelmäkentistä on piilotettu asetuksen Kentät-listasta, mutta voit sijoittaa ne sivulle JSON:ssa jos haluat näyttää ne wizardissa.

**Järjestelmäkaavoja ei tarvitse muokata** materiaalien vuoksi – `kokonaishinta` ym. käyttävät jo muuttujaa `materiaalit`. Sinun tehtäväsi on vain **syöttää data** tähän muuttujaan (rivit tai efektit alla).

### 9.1 Materiaalit JSONissa – kolme tapaa

| Tapa | Milloin | JSON |
|------|---------|------|
| **A. Materiaalirivit** | Käyttäjä valitsee tuotteet listasta | `pages[].system: "materials"` |
| **B. Kiinteä lisä €** | Esim. +150 € aina | `"effects": [{ "type": "add_material_fixed", "value": 150 }]` |
| **C. Laskettu summa** | Kaava laskee hinnan → materiaaleihin | `computed` + `"effects": [{ "type": "add_material_fixed" }]` (ilman `value`) |

Kaikki kolme **voidaan yhdistää**: `materiaalit = rivien summa × kerroin + efektien lisät`.

---

#### Tapa A – Materiaalirivit (wizard-sivu)

Lisää sivu, jolla `system` on `"materials"`. Kenttälistaa (`fieldIds`) ei tarvita – sivu näyttää tuote+määrä -rivit automaattisesti.

```json
{
  "id": "page_materials",
  "title": "Materiaalit",
  "sortOrder": 2,
  "system": "materials",
  "fieldIds": []
}
```

Tuotteet määritellään sovelluksessa (**Tuotteet**), ei JSON-lomakkeessa. Käyttäjä lisää rivejä wizardissa.

---

#### Tapa B – Kiinteä materiaalisumma kentältä

Numero- tai muu kenttä lisää aina saman €-summan:

```json
{
  "id": "field_kuljetus",
  "key": "kuljetuslisä",
  "label": "Kuljetuslisä",
  "type": "number",
  "required": false,
  "showOnSummary": true,
  "unit": "€",
  "effects": [
    { "type": "add_material_fixed", "value": 85 }
  ]
}
```

Tai efekti **käyttää kentän syötettyä arvoa** (käyttäjä kirjoittaa summan wizardissa):

```json
{
  "id": "field_lisamateriaali",
  "key": "lisamateriaali_eur",
  "label": "Lisämateriaalit (€)",
  "type": "number",
  "required": false,
  "showOnSummary": true,
  "unit": "€",
  "effects": [
    { "type": "add_material_fixed" }
  ]
}
```

**Tärkeä:** `"effects": [{ "type": "add_material_fixed" }]` **ilman** `"value"`-kenttää = käytä kentän omaa numero-/laskenta-arvoa.

---

#### Tapa C – Tuote + kaava + materiaaleihin (yleisin kaavamateriaali)

**Vaihe 1 – Tuotevalinta** (`product_select`). Korvaa `TUOTE_ID` oikealla id:llä (**Tuotteet**-näkymä):

```json
{
  "id": "field_maali",
  "key": "kaytettava_maali",
  "label": "Käytettävä maali",
  "type": "product_select",
  "required": true,
  "showOnSummary": true
}
```

**Vaihe 2 – Laskettu hinta** (`computed`). Kaava käyttää tuotteen attribuutteja:

```json
{
  "id": "field_maalin_kustannus",
  "key": "maalin_kustannus",
  "label": "Maalin kustannus",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "allowManualOverride": true,
  "unit": "€",
  "formula": "laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta",
  "effects": [
    { "type": "add_material_fixed" }
  ]
}
```

**Vaihe 3 – Sijoita kentät sivulle** (`pages[].fieldIds`):

```json
{
  "id": "page_surfaces",
  "title": "Pinta-alat",
  "sortOrder": 1,
  "fieldIds": [
    "field_kiintea_seinapinta",
    "field_laskenta_seinapinta",
    "field_maali",
    "field_maalin_kustannus"
  ]
}
```

`computed`-kentän `effects` ilman `value`:ää syöttää **lasketun arvon** järjestelmän `materiaalit`-muuttujaan. Kenttä voi silti näkyä yhteenvedossa – se on erillinen näyttökenttä, ei itse `materiaalit`-kaava.

---

#### Materiaalikerroin (koko summa × kerroin)

Esim. +10 % materiaaleihin:

```json
{
  "id": "field_materiaali_kerroin",
  "key": "materiaali_kerroin",
  "label": "Materiaalikerroin",
  "type": "number",
  "required": false,
  "showOnSummary": false,
  "defaultValue": "1",
  "effects": [
    { "type": "multiply_materials", "value": 1.1 }
  ]
}
```

`multiply_materials` käyttää JSONissa yleensä kiinteää `"value"`-kerrointa. Useita kertojiin efektejä kerrotaan peräkkäin.

---

#### Mitä **ei** tarvitse tehdä JSONissa

- ❌ Kirjoittaa `materiaalit`-kenttää `fields`-taulukkoon – se on putken sisäinen muuttuja
- ❌ Muokata `kokonaishinta`-järjestelmäkaavaa materiaalien lisäämiseksi
- ❌ Odottaa, että `product_select` tai `computed` lisää materiaaleihin **ilman** `effects`-taulukkoa

Valmis kopioitava esimerkki: **[examples/materiaalit-kaava-esimerkki.json](./examples/materiaalit-kaava-esimerkki.json)**

### 9.2 Työ ja kesto JSONissa – vaikutukset

**Urakkahinta** (`urakka_hinta_alv0`) lasketaan järjestelmäkaavalla:

```text
urakka_hinta_alv0 = tyoryhma_kesto_h × asetukset.tyoryhman_koko × asetukset.tuntihinta
```

Työhön **ei ole suoraa €-lisäefektiä** (kuten materiaaleilla `add_material_fixed`). Työn hinta muuttuu **keston** kautta. Voit vaikuttaa kestoon kolmella tavalla:

| Tapa | Milloin | JSON / mekanismi |
|------|---------|------------------|
| **A. Kesto kaavalla** | Pinta-ala → päivät | Kaava kentälle `tyoryhma_kesto_pv` tai computed → syöttö kestoon |
| **B. Lisää tunteja** | Esim. +2 h esivalmistusta | `"effects": [{ "type": "add_duration", "value": 2 }]` |
| **C. Kerro kestoa** | Esim. vaikea kohde × 1,2 | `"effects": [{ "type": "multiply_duration", "value": 1.2 }]` |

Kuten materiaaleissa: `add_duration` **ilman** `"value"`-kenttää käyttää kentän omaa numero-/laskenta-arvoa **tunteina**.

Lopullinen kesto: `(peruskesto tunteina × kerroin) + lisätunnit` → siitä lasketaan urakkahinta.

---

#### Tapa A – Kesto laskettuna (kaava)

Järjestelmäkenttä `tyoryhma_kesto_pv` (id: `field_system_tyoryhma_kesto_pv`) on wizardissa muokattavissa. Voit antaa sille kaavan **viedyn JSON:n kautta** (vie pohja → muokkaa → tuo):

```json
{
  "id": "field_system_tyoryhma_kesto_pv",
  "key": "tyoryhma_kesto_pv",
  "label": "Työn kesto",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "allowManualOverride": true,
  "unit": "pv",
  "formula": "laskenta_seinapinta_ala_m2 / 25"
}
```

Tai erillinen computed-kenttä, joka **lisää tunteja** efektillä (esim. laskettu lisäkesto tunteina):

```json
{
  "id": "field_lisatyotunnit",
  "key": "lisatyotunnit",
  "label": "Lisätyötunnit (esim. tikkaat)",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "formula": "if(onko_tikkaat, 4, 0)",
  "effects": [
    { "type": "add_duration" }
  ]
}
```

`effects` ilman `value` → kentän laskema arvo (tunnit) lisätään kestoon.

**Huom:** Sijoita `field_system_tyoryhma_kesto_pv` jollekin sivulle `fieldIds`-listassa, jotta kesto näkyy wizardissa.

---

#### Tapa B – Kiinteät lisätunnit

```json
{
  "id": "field_esivalmistus",
  "key": "esivalmistus_tunnit",
  "label": "Esivalmistustunnit",
  "type": "number",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "effects": [
    { "type": "add_duration", "value": 2 }
  ]
}
```

Tai ehdollinen kenttä (`showWhen`): efekti ajetaan vain kun kenttä on **näkyvissä** wizardissa.

```json
{
  "id": "field_extra_hours",
  "key": "extra_hours",
  "label": "Lisätunnit",
  "type": "number",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "effects": [
    { "type": "add_duration" }
  ]
}
```

---

#### Tapa C – Kestokerroin (työkerroin, vaikeus jne.)

Kiinteä kerroin JSONissa:

```json
{
  "id": "field_vaikeus",
  "key": "vaikeuskerroin",
  "label": "Vaikeuskerroin",
  "type": "select",
  "required": true,
  "showOnSummary": true,
  "defaultValue": "1",
  "options": [
    { "label": "Normaali", "value": "1" },
    { "label": "Vaikea", "value": "1.2" },
    { "label": "Erittäin vaikea", "value": "1.4" }
  ],
  "effects": [
    { "type": "multiply_duration", "value": 1.2 }
  ]
}
```

**Select-kentällä** kerroin tulee yleensä kiinteästä `value`:sta efektissä, **tai** voit jättää `value` pois ja käyttää valinnan numeerista arvoa (option.value on merkkijono numerona kontekstissa):

```json
{
  "id": "field_vaikeus",
  "key": "vaikeuskerroin",
  "label": "Vaikeuskerroin",
  "type": "select",
  "options": [
    { "label": "Normaali", "value": "1" },
    { "label": "Vaikea", "value": "1.2" }
  ],
  "effects": [
    { "type": "multiply_duration" }
  ]
}
```

Tuotteen **työkerroin** kaavoissa (`maali.tyokerroin`) ei kerro kestoa automaattisesti – jos haluat saman vaikutuksen efektin kautta, luo computed esim. `kaytettava_maali.tyokerroin` ja `multiply_duration` ilman `value`.

---

#### Työ vs materiaali – efektit rinnakkain

Sama kenttä voi vaikuttaa **molempiin** (harvinaista, mutta sallittu):

```json
{
  "id": "field_erikoiskohde",
  "key": "erikoiskohde_lisa",
  "label": "Erikoiskohde",
  "type": "number",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "effects": [
    { "type": "add_duration" },
    { "type": "add_material_fixed", "value": 120 }
  ]
}
```

Tässä kesto kasvaa kentän arvon verran (tunnit) **ja** materiaaleihin lisätään 120 €.

---

#### Mitä **ei** tarvitse / voi tehdä

- ❌ `add_urakka_fixed` tai suora € lisä työhön – ei ole olemassa; käytä `add_duration` tai pidennä kestoa kaavalla
- ❌ Odottaa, että computed-työtuntien kaava muuttaa urakkahintaa **ilman** efektiä – kesto pitää päivittää kaavalla (`tyoryhma_kesto_pv`) tai `add_duration` / `multiply_duration`
- ✅ Urakkahinta päivittyy automaattisesti, kun kesto muuttuu (järjestelmäkaava hoitaa)

Valmis esimerkki (materiaalit + kesto): **[examples/materiaalit-kaava-esimerkki.json](./examples/materiaalit-kaava-esimerkki.json)** – voit yhdistää §9.1- ja §9.2-kentät samaan pohjaan.

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

## 11. Vaikutukset (`effects`) – pika-reference

Kenttä voi vaikuttaa **materiaaleihin** tai **kestoon** (työhön indirektisti). Yksityiskohtaiset JSON-esimerkit: **§9.1** (materiaalit), **§9.2** (työ/kesto).

```json
{
  "effects": [
    { "type": "add_material_fixed", "value": 150 },
    { "type": "add_material_fixed" },
    { "type": "multiply_materials", "value": 1.1 },
    { "type": "add_duration", "value": 2 },
    { "type": "add_duration" },
    { "type": "multiply_duration", "value": 1.05 }
  ]
}
```

| `type` | Vaikutus | `value` pois = kentän arvo |
|--------|----------|----------------------------|
| `add_material_fixed` | Lisää € materiaaleihin (`materiaalit`) | Kyllä (numero/computed/select) |
| `multiply_materials` | Kertoo materiaalit | Yleensä kiinteä JSONissa |
| `add_duration` | Lisää tunteja kestoon → kasvattaa urakkahintaa | Kyllä (numero/computed) |
| `multiply_duration` | Kertoo keston → kasvattaa urakkahintaa | Kyllä (numero/select/computed kontekstissa) |

**Kentän oma arvo JSONissa:** jätä `value` pois – efekti lukee kentän arvon (numero, select tai computed):

```json
{ "type": "add_material_fixed" }
```

Kiinteä summa JSONissa:

```json
{ "type": "add_material_fixed", "value": 150 }
```

`add_material_fixed` + computed + ilman `value` = tyypillisin tapa viedä kaavamateriaali `materiaalit`-muuttujaan. Katso **§9.1 Tapa C**.

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
- Kestosivun (järjestelmäkenttä `tyoryhma_kesto_pv`; alennus lisätään id:llä `field_system_alennus_prosentti`)
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
  "formula": "laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.yksikkohinta",
  "effects": [
    { "type": "add_material_fixed" }
  ]
}
```

`effects` ilman `value` lisää lasketun hinnan järjestelmän `materiaalit`-summaan (ks. §9.1).

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
- [ ] Materiaalit: joko `system: "materials"`-sivu ja/tai kentillä `effects` (`add_material_fixed` / `multiply_materials`)
- [ ] Laskettu materiaali: `computed`-kentällä on `"effects": [{ "type": "add_material_fixed" }]` (ilman `value` jos käytetään kaavan tulosta)
- [ ] Työn kesto: kaava `tyoryhma_kesto_pv`:lle ja/tai `add_duration` / `multiply_duration` -efektit

## 17. Yleisimmät virheet

| Ongelma | Ratkaisu |
|---------|----------|
| Tuonti: „JSON on tyhjä / virheellinen” | Tarkista syntaksi; poista kommentit (JSON ei tue `//`) |
| Tuonti: „puuttuu fields tai pages” | Lisää molemmat taulukot juureen |
| Kenttä ei näy wizardissa | Lisää kentän `id` jollekin sivulle `fieldIds`-listaan |
| Kaava palauttaa 0 | Tarkista `key`-nimet; onko lähdekenttä piilotettu `showWhen`:lla |
| Valinta ei vaikuta kaavaan | `select`-option `value` pitää olla numero merkkijonona |
| Järjestelmähinnat puuttuvat | Varmista kestosivu ja järjestelmäkaavat; tarkista Yleinen-asetukset |
| Materiaalit jäävät 0 | Lisää `effects` computed-kentälle tai materiaalirivit-sivu; pelkkä kaava ei riitä |
| Computed näyttää hinnan mutta kokonaishinta ei muutu | Puuttuu `"effects": [{ "type": "add_material_fixed" }]` |
| Urakkahinta ei muutu vaikka lisäsit työtä | Työhön ei ole €-efektiä – käytä `add_duration` (tunnit) tai kaavaa kestoon |
| Lisätunnit eivät vaikuta | Puuttuu `"effects": [{ "type": "add_duration" }]` tai kenttä piilotettu `showWhen`:lla |

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
