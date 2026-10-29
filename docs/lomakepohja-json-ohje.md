# Lomakepohjan JSON-ohje

Urakkalaskuri **v1.2.5**. Jokaisella tuoterakenteella on oma `FormDefinition`. Tämä tiedosto riittää pohjan **luontiin, muokkaukseen, tuontiin ja vientiin**.

| | |
|--|--|
| Sovellus | [sovellus.md](./sovellus.md) |
| Tuoterakenteet | [tuoterakenteet.md](./tuoterakenteet.md) |
| Opetuspohja | [examples/peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json) |
| Materiaalit+kesto | [examples/materiaalit-kaava-esimerkki.json](./examples/materiaalit-kaava-esimerkki.json) |
| Tehdaslomake | [examples/julkisivumaalaus_v100.json](./examples/julkisivumaalaus_v100.json) |

JSON = **kentät ja kaavat**. Ei työryhmän kokoa, palkkiota, liukuvaa katetta, lisätietoja eikä oletushintoja — ne ovat **Asetukset → Tuoterakenteet → [rakenne]**.

*Päivitetty: lokakuu 2026.*

---

## Sisällys

1. [Työnkulku](#1-työnkulku)
2. [Juuri, sivut, kentät](#2-juuri-sivut-kentät)
3. [Kaavat ja muuttujat](#3-kaavat-ja-muuttujat)
4. [Runkoavaimet](#4-runkoavaimet)
5. [Materiaalit, kesto, efektit](#5-materiaalit-kesto-efektit)
6. [Tuotelista](#6-tuotelista)
7. [Näkyvyys, rivitys, oletukset](#7-näkyvyys-rivitys-oletukset) ([`print`](#print-tulostus-tarjoukseen--urakkakortille))
8. [Tarkistuslista ja virheet](#8-tarkistuslista-ja-virheet)

---

## 1. Työnkulku

1. **Vie** nykyinen pohja: Asetukset → Tuoterakenteet → [rakenne] → **Lomake** → **Vie JSON (leikepöytä)**. Saat oikeat järjestelmä-id:t.
2. Muokkaa `pages` / `fields` / kaavat. JSON ei tue `//`-kommentteja.
3. Validoi (editori tai [jsonlint.com](https://jsonlint.com)).
4. **Tuo JSON…** samalle rakenteelle. Tuonti korvaa **vain tämän** rakenteen lomakkeen.
5. Kalibroi **Debug**-näkymässä, aja testilaskenta.

Onnistunut tuonti: `Nimi. Versio N (edellinen versio: N−1).` Sovellus normalisoi: lisää järjestelmäkentät, korjaa vanhat avaimet, hylkää `alv_maara`/`kokonaishinta`-kaavat, uniikistaa sivujen id:t.

Muut painikkeet samalla näytöllä: **Palauta oletuslomake**. Editori avaa sen rakenteen, jonka Lomake-kortista tulit.

---

## 2. Juuri, sivut, kentät

```json
{
  "id": "oma_lomake",
  "name": "Oma laskenta",
  "version": 1,
  "updatedAt": 0,
  "pages": [],
  "fields": []
}
```

| Kenttä | | |
|--------|--|--|
| `id` | suositeltu | pohjan tunniste |
| `name` | pakollinen | näyttönimi |
| `version` | suositeltu | kasvaa sovelluksessa tallennettaessa |
| `updatedAt` | valinnainen | ms; tuonti ylikirjoittaa |
| `pages` | pakollinen | wizard-sivut |
| `fields` | pakollinen | globaali kenttälista |

### Sivu

```json
{
  "id": "page_surfaces",
  "title": "Pinta-alat",
  "sortOrder": 1,
  "fieldIds": ["field_leveys", "field_korkeus"]
}
```

| | |
|--|--|
| `id` | uniikki (`page_…`). Kaksoiskappale → `_2` |
| `title` | otsikko |
| `sortOrder` | 0 = ensimmäinen |
| `fieldIds` | kenttien `id` **näyttöjärjestyksessä** |
| `system` | `"customer"` tai `"materials"` |

**`customer`** — lisäkentät. Yhteystiedot, tyyppi ja käänteinen ALV ovat laskennan asiakassivulla. Tyhjä `fieldIds` → sivu piilotetaan rivin lomakkeesta. Ei voi poistaa asetuksista.

**`materials`** — tuote+määrä -editori. **Rivin lomake ei näytä tätä sivua.** Tuote valitaan `product_select`-kentästä. Jätä pois, jos lasket materiaalit kaavoilla + `effects`.

Sijoita sivulle (jos haluat wizardissa): `field_system_tyoryhma_kesto_pv`, `field_system_alennus_prosentti`, ja hintarivit (`urakka`, `materiaalit`, `myyntipalkkio`, `kokonaishinta_alv0`, `kokonaishinta`). Tehdas: sivu **Hinnat**.

### Kenttä

```json
{
  "id": "field_pinta",
  "key": "pinta_ala",
  "label": "Pinta-ala",
  "type": "number",
  "required": true,
  "showOnSummary": true,
  "unit": "m²"
}
```

| Pakollinen | |
|------------|--|
| `id` | viitataan `fieldIds`:ssä |
| `key` | kaavamuuttuja: vain `a-z0-9_` (ei ä/ö) |
| `label` | näyttönimi |
| `type` | alla |
| `required` | tyhjä + ei oletusta = virhe |
| `showOnSummary` | näkyy rivin **Lomaketiedot**-osiossa. Järjestelmäkentät **eivät** tule sinne |

| Valinnainen | |
|-------------|--|
| `unit` | `"m²"`, `"€"`, `"pv"`, `"h"`, `"%"` |
| `helpText` | ohje wizardissa |
| `defaultValue` | merkkijono; tyhjä/puuttuu = ei oletusta (**ei 0**) |
| `formula` | `computed`. Tyhjä = käyttäjä syöttää (kesto, alennus-%) |
| `allowManualOverride` | `computed`, oletus `true`. Pyyhittävä; reset-nuoli palauttaa kaavan |
| `showWhen` / `showOnSummaryWhen` | [§7](#7-näkyvyys-rivitys-oletukset) |
| `sameRowAsPrevious` | [§7](#7-näkyvyys-rivitys-oletukset) |
| `effects` | [§5](#5-materiaalit-kesto-efektit) |
| `debugExampleValue` | Debug-tila |
| `systemKey` | **älä keksi** — runko liittää nämä |
| `options` | vain `select` |
| `print` | [tulostus tarjoukseen / urakkakortille](#print-tulostus-tarjoukseen--urakkakortille) |

| `type` | |
|--------|--|
| `number` | `defaultValue` esim. `"120"` |
| `text` | vapaateksti |
| `select` | `options: [{ "label", "value" }]`. `value` merkkijono, kaavassa numero. Desimaali pisteellä (`"1.15"`) |
| `boolean` | `"true"` / `"false"` |
| `product_select` | `defaultValue` = tuotteen id. [§6](#6-tuotelista) |
| `computed` | `formula` + live-laskenta |
| `section` | otsikko, ei syötettä |

#### `print` (tulostus tarjoukseen / urakkakortille)

Valinnainen lohko. Kertoo, tulostuuko kenttä **tarjoukseen** ja **urakkakortille**. PDF-koostajat eivät vielä lue lohkoa: tuonti vain normalisoi sen ja pitää sen viennissä.

```json
"print": {
  "when": "always",
  "offer": { "when": "notEmpty", "group": "osa_alueet", "order": 10, "label": "Julkisivu" },
  "urakkakortti": true
}
```

| | |
|--|--|
| Kohde mukana (`true` tai objekti) | kenttä tulostuu sinne. `true` = `{}` |
| Kohde puuttuu | ei tulostu sinne |
| `"print": {}` | ei tulostu minnekään |
| Ei `print`-objektia | vanha oletus (alla) |

Kohteen `when` voittaa lohkon `when`. Oletus ilman `when`: boolean `ifYes`, muut `notEmpty`.

| `when` | boolean | numero / computed | teksti | select / product_select |
|--------|---------|-------------------|--------|-------------------------|
| `always` | Kyllä ja Ei | myös `0`. Puuttuva arvo ei tulostu | tyhjä jää pois | vain valittu |
| `notEmpty` | sama kuin `always` | luku ≠ 0 | ei tyhjä | vain valittu |
| `ifYes` | vain kun tosi | sama kuin `notEmpty` | sama kuin `notEmpty` | sama kuin `notEmpty` |

`group`: `osa_alueet`, `tyovaiheet`, `muuta`, `tieto` tai `maali`. Oletus `tieto`.

`order`: äärellinen luku. Oletus = sivun `sortOrder`, sitten indeksi `fieldIds`:ssä. `label`: merkkijono. Oletus = kentän nimi. `""` = pelkkä arvo.

`quantityKey` vain kohteessa `urakkakortti`, ryhmässä `maali`, kentän tyyppi `product_select`, ja arvo on olemassa oleva kentän `key` (myös runkoavain).

`section` ja järjestelmäkenttä (`systemKey`) eivät tulostu `print`-lohkon kautta. Keston, toimitusajankohdan ja urakan lisää sovellus itse.

Kun `print` on objekti, vain se ratkaisee. `showOnSummary` ja `showOnSummaryWhen` eivät vaikuta. Wizardin `showWhen` vaikuttaa yhä: piilotettu kenttä ei tulostu.

**Vanha pohja** (ei `print`-objektia):

- **Tarjous:** pois, jos `systemKey`, `section` tai `unit` on `€`. Muuten mukana kun `showOnSummary`, ja `showOnSummaryWhen` täyttyy. Boolean `ifYes` (Ei piiloon), muut `notEmpty`. Ryhmä `tieto`, lomakejärjestys.
- **Urakkakortti:** samat `showOnSummary`-kentät kuin nykyinen kortti, paitsi sivulla `system: "customer"`. Boolean `always` (Kyllä ja Ei), muut `notEmpty`. Ryhmä `tieto`.

**Urakkakortti ei tulosta €-rivejä**, oli asetus vanha tai suora `print`: rivi pois, jos `unit` on `€` tai muotoiltu arvo sisältää `€`.

**Virheellinen arvo:** tuntematon `when` poistetaan (käyttöön oletus), tuntematon `group` → `tieto`, kelvoton `order` tai `label` poistetaan, kohde joka ei ole `true` tai objekti poistetaan (pois päältä), kelvoton `quantityKey` poistetaan. Jokaisesta yksi lyhyt suomenkielinen huomio (`Kenttä "avain": … ohitettu`). Koko `print` joka ei ole objekti (`null`, merkkijono, taulukko) → vanha oletus ja yksi huomio. Pohja ilman `print`-avainta ei tuota huomioita eikä lisää avainta. Huomiot palauttaa `parseImportedFormDefinitionWithWarnings` / `normalizeFormDefinitionWithWarnings`. Tyhjä näyttö `–` on tyhjä arvo.

Esimerkki on **kuvitteellinen** (avaimet tiedostosta `docs/examples/julkisivumaalaus_v100.json`, ei osa tehdaslomaketta):

```json
{
  "key": "kaytettava_maali",
  "print": {
    "when": "notEmpty",
    "offer": { "group": "tieto", "label": "Maali" },
    "urakkakortti": { "group": "maali", "quantityKey": "savyjen_lkm", "order": 10 }
  }
}
```

---

## 3. Kaavat ja muuttujat

Viittaa **`key`**, ei `label`. Operaatiot: `+ - * / ( )` ja `> < >= <= == !=`.

| Funktio | |
|---------|--|
| `min(a, b)` `max(a, b)` | |
| `round(x, desimaalit)` | |
| `if(ehto, then, else)` | |
| `sqrt(x)` | |
| `liukuva_myyntihinta(suorat_alv0)` | myyntihinta alv0 rakenteen kate-rajoilla |

Puuttuva muuttuja = `0`. Jako nollalla = `0`. Piilotettu `showWhen`-kenttä = `0`.

Vanhat `settings.*`-nimet toimivat aliaksina.

### Yleinen (Asetukset → Yleinen)

| Muuttuja | |
|----------|--|
| `asetukset.alv_prosentti` | ALV % |
| `asetukset.tuntihinta` | €/h alv0 |
| `asetukset.tyopaivan_pituus` | h |

**Säävarauskerroin ei ole kaavamuuttuja.** Se kerrotaan vasta yhteenvedon/rivikortin **Työn arvioitu kesto** -lukuun (pyöristys ylöspäin). `tyoryhma_kesto_pv` / `_h` ja hinnoittelu käyttävät tarkkaa kestoa.

Uuden rakenteen palkkio-%-oletus on Yleinen-sivulla; kaava lukee silti **tämän rakenteen** palkkion.

### Tämä tuoterakenne (ei JSONissa)

| Muuttuja | Asetukset → Tuoterakenteet → [rakenne] |
|----------|----------------------------------------|
| `asetukset.tyoryhman_koko` | työryhmän koko |
| `asetukset.myyntipalkkio_prosentti` | palkkio-% |
| `asetukset.myyntikate_prosentti` | kate % alarajalla (vanhat kaavat) |
| `asetukset.myyntikate_alaraja_eur` | liukuvan katteen alaraja € |
| `asetukset.myyntikate_alaraja_prosentti` | kate % alarajalla |
| `asetukset.myyntikate_ylaraja_eur` | yläraja € |
| `asetukset.myyntikate_ylaraja_prosentti` | kate % ylärajalla |

Eri rakenteilla eri kate, palkkio ja ryhmäkoko. Ei kaavamuuttujia: lisätiedot, oletushinta, oletus materiaalit, näytettävä arvioitu kesto.

### Laskelma

`laskelma.matka_aika_h` — matka **yhteen suuntaan** (h), laskentasivulta, sama kaikille riveille. Tyhjä = `0`. Debugissa aina `0`. Meno–paluu: `* 2`.

```json
{
  "id": "field_matka_htt",
  "key": "matka_henkilotyotunnit",
  "label": "Matka-aika yhteensä",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "formula": "laskelma.matka_aika_h * 2 * tyoryhma_kesto_pv * asetukset.tyoryhman_koko"
}
```

`liukuva_myyntihinta(...)` → avain `kokonaishinta_alv0`. **Älä** kerro alennuksella. Kate-rajat tästä rakenteesta.

---

## 4. Runkoavaimet

JSON **vie** arvot avaimiin. Runko näyttää hintakortin ja laskee ALV:n / alennuksen. Älä luo omaa kenttää samalla `key`:llä.

**Wizardissa** (lisää `fieldIds`; yliajo reset-nuolella):

| `id` | `key` | Kuka |
|------|-------|------|
| `field_system_tyoryhma_kesto_pv` | `tyoryhma_kesto_pv` | JSON / syöte. Wizard = tarkka pv. Kortti/yhteenveto = arvio + säävaraus |
| `field_system_tyoryhma_kesto_h` | `tyoryhma_kesto_h` | oletus: `pv × työpäivä` |
| `field_system_alennus_prosentti` | `alennus_prosentti` | syöte, oletus `0`, 0–100 |
| `field_system_urakka` | `urakka_hinta_alv0` | JSON |
| `field_system_materiaalit` | `materiaalit` | rivit + efektit; yliajettavissa |
| `field_system_myyntipalkkio` | `myyntipalkkio` | JSON |
| `field_system_kokonaishinta_alv0` | `kokonaishinta_alv0` | JSON = **listahinta** |
| `field_system_kokonaishinta` | `kokonaishinta` | runko; yliajo → uusi alv0 |

**Vain hintakortissa** (wizard piilottaa aina): `myyntikate`, `alv_maara`, `alennus_eur`.

Runko `kokonaishinta_alv0`:sta (käänteinen ALV → ALV 0):

```text
alv_maara    = kokonaishinta_alv0 × asetukset.alv_prosentti / 100
kokonaishinta = kokonaishinta_alv0 + alv_maara
```

Alennus-% vähennetään **listahinnan jälkeen**. Älä kirjoita `(1 - alennus_prosentti/100)` myyntihintaan. Alennuksen jälkeen kate = myynti − urakka − materiaalit − palkkio.

Tuonti säilyttää JSON-kaavan paitsi `alv_maara` ja `kokonaishinta`. Vanha `myyntikate_eur` / `myyntipalkkio_eur` kaavassa → `myyntikate` / `myyntipalkkio`.

### Tehdasoletus

```text
tyoryhma_kesto_h   = tyoryhma_kesto_pv * asetukset.tyopaivan_pituus
urakka_hinta_alv0  = tyoryhma_kesto_h * asetukset.tyoryhman_koko * asetukset.tuntihinta
kokonaishinta_alv0 = (urakka_hinta_alv0 + materiaalit)
                     / (1 - asetukset.myyntikate_prosentti/100 - asetukset.myyntipalkkio_prosentti/100)
                     / (1 + asetukset.alv_prosentti/100)
myyntikate         = kokonaishinta * asetukset.myyntikate_prosentti/100
myyntipalkkio      = kokonaishinta * asetukset.myyntipalkkio_prosentti/100
```

Jos korvaat `kokonaishinta_alv0`:n (esim. `liukuva_myyntihinta(urakka_hinta_alv0 + materiaalit)`), päivitä kate ja palkkio samaan metodiikkaan.

---

## 5. Materiaalit, kesto, efektit

`effects` ajetaan vain kun kenttä on **näkyvissä** (`showWhen`). Sama kenttä voi sisältää useita. `value` pois = käytä kentän omaa numeroa / select-arvoa / computed-tulosta.

| `type` | | `value` pois |
|--------|--|--------------|
| `add_material_fixed` | + € → `materiaalit` | kentän € |
| `multiply_materials` | kerro materiaalit | yleensä kiinteä `"value"` |
| `add_duration` | + **tuntia** → `tyoryhma_kesto_h` | kentän h |
| `multiply_duration` | kerro kesto | kentän kerroin |

Lopullinen kesto: `(peruskesto h × kertoimet) + lisätunnit`. Kestoefekti muuttaa urakan **vain**, jos `urakka_hinta_alv0` lukee kestoa (oletuskaava). Omalla urakkakaavalla päivitä myös se.

`materiaalit` = tuoterivit × kertoimet + €-lisät. Älä lisää omaa `materiaalit`-kenttää `fields`:iin — käytä `field_system_materiaalit`. Pelkkä kaava **ei** vie materiaaleihin ilman efektiä.

### Materiaalit

**A.** `pages[].system: "materials"` — ei näy rivin lomakkeessa.  
**B.** Kiinteä €: `"effects": [{ "type": "add_material_fixed", "value": 85 }]`.  
**C.** Kaava → materiaalit (yleisin):

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
  "formula": "pinta_ala / kaytettava_maali.menekki * kaytettava_maali.ostohinta",
  "effects": [{ "type": "add_material_fixed" }]
}
```

Käyttäjän syöttämä € ilman kiinteää `value`: `"effects": [{ "type": "add_material_fixed" }]`.  
Kerroin: `"effects": [{ "type": "multiply_materials", "value": 1.1 }]`.

### Kesto

**A.** Kaava järjestelmäkentälle (vie pohja → muokkaa `formula`):

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
  "formula": "pinta_ala / 25"
}
```

Sijoita id sivulle, jotta kesto näkyy. `showOnSummary` ei vie järjestelmäkenttää Lomaketietoihin. Kortin **Työn arvioitu kesto** -yliajo ei muuta kaavoja.

**B.** Lisätunnit: `"effects": [{ "type": "add_duration" }]` tai `{ "type": "add_duration", "value": 2 }`.  
**C.** Kerroin: `"effects": [{ "type": "multiply_duration" }]` (select `option.value` esim. `"1.2"`) tai kiinteä `"value": 1.2`.

Tuotteen `.tyokerroin` ei kerro kestoa automaattisesti — computed + `multiply_duration` ilman `value`.

Molemmat: `"effects": [{ "type": "add_duration" }, { "type": "add_material_fixed", "value": 120 }]`.

---

## 6. Tuotelista

Tuotteet: **Tuotteet**-näkymä (ostohinta, myyntihinta, menekki, työkerroin, rakenteet). Lomake näyttää **tämän rakenteen** tuotteet Tuotteet-listan järjestyksessä.

```json
{
  "id": "field_maali",
  "key": "kaytettava_maali",
  "label": "Käytettävä maali",
  "type": "product_select",
  "required": true,
  "showOnSummary": true,
  "defaultValue": "tuote-id"
}
```

Kun valittu:

```text
kaytettava_maali.ostohinta       .purchase_price .yksikkohinta .hinta .unit_price
kaytettava_maali.myyntihinta     .sale_price
kaytettava_maali.kate            .kate_eur .margin          (myynti − osto, alv0)
kaytettava_maali.kate_prosentti  .margin_percent
kaytettava_maali.menekki         .consumption
kaytettava_maali.tyokerroin      .work_factor
```

`.yksikkohinta` = ostohinta (vanhat kaavat). Hinnat rekisteristä, alv0.

---

## 7. Näkyvyys, rivitys, oletukset

### `showWhen` (wizard; piilotettu = 0 kaavoissa ja pois yhteenvedosta)

```json
"showWhen": { "fieldKey": "raystaan_aluset", "operator": "eq", "value": "true" }
```

### `showOnSummaryWhen` (vain yhteenveto; wizard näkyy silti). Vaatii `showOnSummary: true`.

Boolean: `"true"` / `"false"` (tuonti hyväksyy myös boolean/number). Select: `option.value`. Number: `"10"` / `"10.5"`.

| `operator` | Lähde |
|------------|--------|
| `eq` `neq` | boolean, select, number, computed |
| `gt` `lt` `gte` `lte` | number, computed |

### `sameRowAsPrevious`

`true` = sama wizard-rivi kuin **edellinen näkyvä** kenttä samalla sivulla (`fieldIds`, `showWhen` huomioidaan). 2 kenttää → 50/50, 3 → ⅓. Uusi rivi: ei lippua, sivun ensimmäinen, tai edellinen on `section`. Otsikko ei jaa riviä. Asetuksissa: **Kenttä → Rivitä edelliselle riville**.

### `defaultValue`

Merkkijono: number `"120"`, select `"1.15"`, boolean `"true"`, product id. Tyhjä = kenttä tyhjänä (ei nollaa). Huomioidaan validoinnissa ja kaavoissa kunnes käyttäjä muuttaa.

### `print` (tulostus tarjoukseen / urakkakortille)

Sama lohko kuin [kentän `print`](#print-tulostus-tarjoukseen--urakkakortille). Lyhyesti: valinnainen kohdekohtainen tulostus. `true` kohteessa = `{}`. Puuttuva kohde = ei tulostu. `{}` = ei minnekään. Ilman koko objektia vanha yhteenveto.

| `when` | boolean | muu |
|--------|---------|-----|
| `always` | Kyllä ja Ei | numero myös 0; tyhjä teksti ja tyhjä valinta jäävät pois |
| `notEmpty` | sama kuin `always` | teksti ei tyhjä, numero ≠ 0, valinta tai tuote valittu |
| `ifYes` | vain kun tosi | sama kuin `notEmpty` |

Kohteen `when` voittaa lohkon `when`. Oletus: boolean `ifYes`, muut `notEmpty`. Ryhmät: `osa_alueet`, `tyovaiheet`, `muuta`, `tieto` (oletus), `maali`. `order` = luku (oletus lomakejärjestys). `label` = merkkijono (oletus kentän nimi, `""` = pelkkä arvo). `quantityKey` vain `urakkakortti` + `maali` + `product_select` + olemassa oleva `key`.

`section` ja `systemKey` eivät tulostu. Mukana oleva `print` ohittaa `showOnSummary` / `showOnSummaryWhen`; `showWhen` pätee silti.

Vanha pohja: tarjous = `showOnSummary` ilman `€` / järjestelmäkenttää / otsikkoa (`ifYes` / `notEmpty`). Urakkakortti = samat kentät paitsi `system: "customer"`, boolean `always`. Urakkakortille ei €-rivejä (`unit` tai arvo sisältää `€`), vaikka `print` käskisi.

Kelvoton arvo pudotetaan (tuntematon `group` → `tieto`) ja siitä tulee yksi huomio. Ei-objekti `print` → vanha oletus. Ilman `print`-avainta ei huomioita eikä uutta avainta.

```json
{
  "key": "kaytettava_maali",
  "print": {
    "when": "notEmpty",
    "offer": { "group": "tieto", "label": "Maali" },
    "urakkakortti": { "group": "maali", "quantityKey": "savyjen_lkm", "order": 10 }
  }
}
```

Kuvitteellinen esimerkki, avaimet `docs/examples/julkisivumaalaus_v100.json`. Ei tehdaslomakkeen arvo.

---

## 8. Tarkistuslista ja virheet

Ennen tuontia:

- JSON validi; `pages` ja `fields` taulukoita
- jokainen `fieldIds`-viite on `fields[].id` tai järjestelmä-id
- `key` uniikki, `a-z0-9_`
- `select`: vähintään yksi option; `value` numero merkkijonona jos kaava käyttää
- `showWhen` / `showOnSummaryWhen` → olemassa oleva `key`
- `print` valinnainen objekti. Tuntematon `when`, kohde, `order`, `label` tai `quantityKey` pudotetaan; tuntematon `group` → `tieto`. Ilman `print`-objektia vanha yhteenveto (tarjous / urakkakortti). Urakkakortille ei €-rivejä. `section` ja järjestelmäkenttä eivät tulostu `print`-lohkon kautta
- `defaultValue` merkkijono; `product_select`-id on olemassa
- `kokonaishinta_alv0` = listahinta (ei alennusta kaavassa)
- ei `alv_maara` / `kokonaishinta`-kaavaa
- kesto, alennus-% ja halutut hinta-yliajot sivulla; kate / ALV € / alennus € pois lomakkeelta
- materiaalit: `effects` ja/tai hyväksyt 0 € (`system: "materials"` ei näy rivillä)
- laskettu materiaali: `computed` + `add_material_fixed` ilman `value`
- urakka: oletus + kesto **tai** oma `urakka_hinta_alv0` (kestoefekti ei riitä omaan kaavaan)
- jos korvaat myyntihinnan, kate ja palkkio samaan metodiikkaan
- tälle rakenteelle asetettu ryhmäkoko, palkkio ja liukuva kate

| Ongelma | |
|---------|--|
| JSON tyhjä / virheellinen | syntaksi; ei `//` |
| puuttuu fields tai pages | molemmat juureen |
| kenttä ei näy | `id` sivun `fieldIds`:ään. Kate, ALV €, alennus € piilotetaan aina |
| kaava = 0 | `key`; piilotettu `showWhen` |
| valinta ei vaikuta | option `value` numero merkkijonona |
| hintakortti tyhjä | vie `kokonaishinta_alv0`, `urakka_hinta_alv0`, kate, palkkio, kesto. ALV/tuntihinta Yleisestä; ryhmä/palkkio/kate rakenteesta |
| materiaalit 0 | `effects`; pelkkä kaava ei riitä |
| computed € mutta kortti ei muutu | puuttuu `add_material_fixed` |
| urakka ei muutu | oletus: `add_duration` tai kaava `tyoryhma_kesto_pv`:lle. Oma kaava: päivitä `urakka_hinta_alv0` |
| lisätunnit eivät vaikuta | puuttuu `add_duration`, kenttä piilossa, tai urakka ei lue kestoa |

Opetuspohja: [peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json) — asiakas, pinta-alat, kesto, alennus-%, hinnat; ei `materials`-sivua.
