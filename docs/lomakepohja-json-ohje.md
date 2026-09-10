# Lomakepohjan JSON-ohje

Tämä ohje kertoo, miten Urakkalaskurin **tuoterakenteen** lomakepohja (`FormDefinition`) rakennetaan JSON-tiedostona ja tuodaan sovellukseen. Jokaisella tuoterakenteella on oma pohja.

**Sovelluksen toiminta (näytöt, tallennus, hinnoittelu):** [sovellus.md](./sovellus.md). Tuoterakenteen malli (lisätiedot, oletushinnat, työryhmän koko, Ei pohjaa): [tuoterakenteet.md](./tuoterakenteet.md).

**Esimerkkitiedosto (opetuspohja):** [examples/peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json). Tuotannon oletuslomake on Julkisivumaalaus ([examples/julkisivumaalaus_v100.json](./examples/julkisivumaalaus_v100.json)).

JSON kuvaa **lomakkeen kentät ja kaavat**. Se ei sisällä tuoterakenteen asetuksia (työryhmän koko, myyntipalkkio-%, lisätiedot, oletushinnat) – ne asetetaan **Asetukset → Tuoterakenteet → [rakenne]**.

*Päivitetty: syyskuu 2026.*

---

## 1. Nopea alku

1. Kopioi esimerkki [`docs/examples/peruslaskenta-lomakepohja.json`](./examples/peruslaskenta-lomakepohja.json) uudeksi pohjaksi.
2. Muokkaa kentät, sivut ja kaavat.
3. Validoi JSON (esim. editorin JSON-tarkistus tai [jsonlint.com](https://jsonlint.com)).
4. Avaa sovellus → **Asetukset → Tuoterakenteet → [rakenne] → Lomake → Tuo JSON…**
5. Liitä JSON ja vahvista tuonti.

**Vinkki:** Vie ensin nykyinen pohja (**Vie JSON (leikepöytä)**) ja muokkaa sitä – saat mukaan oikeat järjestelmäkenttä-id:t ja rakenteen.

---

## 2. Tuonti ja vienti

Polku: **Asetukset → Tuoterakenteet → [rakenne] → Lomake** (näytön otsikko on **Lomakeasetukset**). Editori avaa sen rakenteen, joka on merkitty aktiiviseksi (`activeStructureId`) juuri ennen navigointia — tarkista että avasit Lomake-kortin oikealta rakenteelta.

| Toiminto | Painike |
|----------|---------|
| Vie nykyinen pohja | **Vie JSON (leikepöytä)** |
| Tuo uusi pohja | **Tuo JSON…** |
| Palauta tehdas oletus | **Palauta oletuslomake** |

Tuonti korvaa **tämän rakenteen** lomakkeen, ei muiden rakenteiden pohjia. Sovellus **normalisoi** pohjan: lisää järjestelmäkentät, korjaa vanhat avaimet, hylkää `alv_maara` / `kokonaishinta`-kaavat ja siivoaa sivujen kenttäviittaukset.

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

- **`system: "customer"`** – Rakenteen Asiakas-sivu **lisäkentille**. Nimi, puhelin, osoite, tyyppi ja käänteinen ALV ovat laskennan omalla asiakassivulla, eivät tällä sivulla. Jos `fieldIds` on tyhjä, sivu piilotetaan rivin lomakkeesta. Sivua ei voi poistaa asetuksista.
- **`system: "materials"`** – Tuote+määrä -rivi-editori. **Rivin lomake ei näytä tätä sivua.** Tuote valitaan `product_select`-kentästä. Älä lisää sivua, jos lasket materiaalit kaavoilla ja `add_material_fixed`-efekteillä.
- **Työn kesto** – Lisää sivulle `field_system_tyoryhma_kesto_pv` (kaava-avain `tyoryhma_kesto_pv`). Lomakkeella arvo on tarkka kesto. Yhteenvedon **Työn arvioitu kesto** kertoo säävarauskertoimen (Asetukset → Yleinen, ei kaavamuuttuja) ja pyöristää ylöspäin.
- **Alennus %** – Lisää sivulle `field_system_alennus_prosentti` (kaava-avain `alennus_prosentti`). Oletus `0`. Sama ale on myös rivikortissa.
- **Hinnat** – Tehdasoletuksessa sivu `page_prices`: urakka, materiaalit, palkkio, myyntihinta alv0 ja kokonaishinta (sis. ALV). Voit yliajaa arvot lomakkeella.

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
| `showOnSummary` | `true` = näkyy yhteenvedon **Lomaketiedot**-osiossa **tällä rivillä** (wizardista riippumatta). Järjestelmäkentät **eivät** tule tähän osioon. |

### Valinnaiset kentät

| Kenttä | Kuvaus |
|--------|--------|
| `unit` | Yksikkö (esim. `"m²"`, `"€"`, `"pv"`) |
| `helpText` | Ohjeteksti kentän alla wizardissa |
| `defaultValue` | Oletusarvo merkkijonona (tyhjä/puuttuu = ei oletusta, **ei 0**) |
| `formula` | Laskentakentän kaava (`type: "computed"`). Tyhjä kaava = käyttäjä syöttää arvon (kesto, alennus-%). |
| `allowManualOverride` | `computed`: käyttäjä saa ylikirjoittaa tuloksen (oletus `true`). Hintakortin avaimilla `false`. |
| `showWhen` | Wizardin näkyvyysehto (katso kohta 10) |
| `showOnSummaryWhen` | Yhteenvedon näkyvyysehto (katso kohta 10) |
| `effects` | Vaikutukset laskentaan (katso kohta 11) |
| `debugExampleValue` | Debug-tilan esimerkkiarvo |
| `systemKey` | Järjestelmäkentän tunnus. **Älä keksi omia** – tuonti liittää rungon kentät. |

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

Kaavamuuttujat `asetukset.*` tulevat automaattisesti kontekstiin. Osa on **yleisiä** (koko sovellus), osa **tämän tuoterakenteen** asetuksia. Eri rakenteilla voi olla eri työryhmän koko ja palkkio.

Vanhat `settings.*`-muodot toimivat vielä aliasina.

### 8.1 Yleiset asetukset (Asetukset → Yleinen)

| Muuttuja | Lähde |
|----------|-------|
| `asetukset.alv_prosentti` | ALV % |
| `asetukset.myyntikate_prosentti` | Myyntikatetavoite % (yksittäinen; vanhat kaavat) |
| `asetukset.myyntikate_alaraja_eur` | Liukuvan katteen alaraja € |
| `asetukset.myyntikate_alaraja_prosentti` | Kate % alarajalla |
| `asetukset.myyntikate_ylaraja_eur` | Liukuvan katteen yläraja € |
| `asetukset.myyntikate_ylaraja_prosentti` | Kate % ylärajalla |
| `asetukset.tuntihinta` | Tuntihinta €/h |
| `asetukset.tyopaivan_pituus` | Työpäivän pituus (h) |

**Säävarauskerroin** (Asetukset → Yleinen) **ei** tule kaavakontekstiin. Se vaikuttaa vain yhteenvedossa näytettävään työn arvioituun kestoon, ei `tyoryhma_kesto_pv` / `_h` -arvoihin eikä hinnoitteluun.

### 8.2 Tuoterakenteen asetukset (Asetukset → Tuoterakenteet → [rakenne])

Nämä **eivät kuulu JSON-tiedostoon**. Ne ovat rakenteen omia asetuksia ja tulevat kaavaan, kun tätä rakennetta lasketaan (rivin lomake, debug, yhteenveto).

| Muuttuja | Lähde |
|----------|-------|
| `asetukset.tyoryhman_koko` | **Työryhmän koko** (hlö). Jokaisella rakenteella oma arvo. |
| `asetukset.myyntipalkkio_prosentti` | Rakenteen **myyntipalkkio-%** (uuden rakenteen oletus tulee Yleinen-asetuksista) |

Esimerkki: julkisivumaalaus 2 hlö, katto 3 hlö – sama kaava `henkilotyotunnit / asetukset.tyoryhman_koko` käyttää kummankin rakenteen omaa kokoa.

**Ei kaavamuuttujia** (vain rivikortti / yhteenveto): lisätiedot, oletushinta alv0, oletus työn hinta alv0, oletus materiaalit alv0. Lomake yliajaa oletushinnat, jos se tuottaa hintapäivityksiä.

### Matka-aika kohteelle

Matka-aika **yhteen suuntaan** syötetään laskentasivulla (Toimitusajankohta-kentän alla), ei tuoterakenteen lomakkeessa. Sama arvo näkyy kaikille riveille. Yksikkö on tunti (`h`). Tyhjä = `0`.

Nouda kaavassa muuttujalla `laskelma.matka_aika_h`:

```json
{
  "id": "field_matka_henkilotyotunnit",
  "key": "matka_henkilotyotunnit",
  "label": "Matka-aika yhteensä",
  "type": "computed",
  "required": false,
  "showOnSummary": true,
  "unit": "h",
  "formula": "laskelma.matka_aika_h * 2 * tyoryhma_kesto_pv * asetukset.tyoryhman_koko"
}
```

| Muuttuja | Merkitys |
|----------|----------|
| `laskelma.matka_aika_h` | Matka-aika kohteelle, yhteen suuntaan (h) |

Meno–paluu on `laskelma.matka_aika_h * 2`. Älä lisää lomakkeelle erillistä `etaisyys`-kenttää samaan tarkoitukseen – käyttäjä täyttää ajan laskentasivulla.

Lomakkeen debug (Asetukset → Tuoterakenteet → [rakenne] → Lomake → Debug) käyttää tämän rakenteen työryhmän kokoa. `laskelma.matka_aika_h` on debugissa `0`, koska siellä ei ole avointa laskelmaa.

**Liukuva myyntihinta (alv0)** suorista kustannuksista:

```text
liukuva_myyntihinta(suorat_kustannukset_alv0)
```

Vie tulos avaimeen `kokonaishinta_alv0`. Älä kerro tulosta alennusprosentilla – alennus on rungon jälkikäsittely.

---

## 9. Rungon avaimet ja materiaalit

Sovellus on **runko**: se omistaa hintakortin ja muutaman johdetun arvon. JSON on **metodi**: se laskee arvot varattuihin avaimiin. Runko ei rakennu yhden lomakkeen ympärille; lomake tottelee tätä sopimusta.

### 9.0 Mitä JSON vie, mitä runko näyttää ja laskee

JSON **vie** arvot kaavalla tai efektillä. Hinnat näkyvät hintakortissa. Osa runkoriveistä voidaan myös näyttää ja yliajaa wizardissa, jos ne ovat sivun `fieldIds`-listassa (tehdasoletuksessa sivu **Hinnat**).

**Wizardissa + hintakortissa** (laita sivulle `fieldIds`; yliajo nuolella takaisin kaavaan):

| Avain | Kuka laskee | Wizard |
|-------|-------------|--------|
| `tyoryhma_kesto_pv` (ja tarvittaessa `_h`) | JSON / syöte | Kyllä – `field_system_tyoryhma_kesto_pv` |
| `alennus_prosentti` | syöte, oletus 0 | Kyllä – `field_system_alennus_prosentti` |
| `urakka_hinta_alv0` | JSON (oletus: kesto × ryhmä × tuntihinta) | Kyllä – `field_system_urakka` |
| `materiaalit` | rivit ja/tai `add_material_fixed` | Kyllä – `field_system_materiaalit` |
| `myyntipalkkio` | JSON | Kyllä – `field_system_myyntipalkkio` |
| `kokonaishinta_alv0` | JSON (esim. `liukuva_myyntihinta(...)`) | Kyllä – `field_system_kokonaishinta_alv0` |
| `kokonaishinta` | runko `alv0 + ALV`; yliajo johtaa uuden `kokonaishinta_alv0`:n | Kyllä – `field_system_kokonaishinta` |

**Vain hintakortissa** (wizard piilottaa, vaikka `fieldIds` sisältäisi ne):

| Avain | Kuka laskee |
|-------|-------------|
| `myyntikate` | JSON (listahinnalla); alennuksen jälkeen jäännös |
| `alv_maara` | runko `kokonaishinta_alv0`:sta |
| `alennus_eur` | runko listahinnasta × alennus-% |

Runko **laskee itse** nämä `kokonaishinta_alv0`:sta, paitsi jos `kokonaishinta` yliajetaan lomakkeella (silloin runko laskee uuden alv0:n yliajetusta sis. ALV -hinnasta):

| Avain | Runko |
|-------|--------|
| `alv_maara` | `kokonaishinta_alv0 × asetukset.alv_prosentti / 100` (käänteinen ALV → 0) |
| `kokonaishinta` | `kokonaishinta_alv0 + alv_maara` (yliajo → alv0 = kokonaishinta / (1 + ALV-%)) |
| `alennus_eur` ja alennetut kokonaishinnat | listahinta × (1 − alennus-%); kate on jäännös kustannusten ja palkkion jälkeen |

Erittelyt (tunnit, litrat, tuotehinnat) kuuluvat lomakkeelle ja `showOnSummary`:iin.

**Alennus:** JSON vie **listahinnan** `kokonaishinta_alv0`. Runko vähentää prosentin sen jälkeen. Älä kirjoita `(1 - alennus_prosentti/100)` myyntihintakaavaan. Listahinnalla kortin kate ja palkkio ovat JSON-kaavan tulos; alennuksen jälkeen kate on jäännös (myynti − suorat kustannukset − palkkio).

**Tuonti:** JSON-kaava säilyy, paitsi `alv_maara` ja `kokonaishinta` (runko kirjoittaa ne aina). Jos kentällä on jo kaava, tehdas-`helpText` / `debugExampleValue` ei ylikirjoita. Vanha `myyntikate_eur` / `myyntipalkkio_eur` kaavassa muunnetaan muotoon `myyntikate` / `myyntipalkkio`.

Sovellus lisää järjestelmäkentät tuonnissa. Sivuille viitataan id:llä. Kaavoissa käytetään `key`-arvoa. Kate, ALV € ja alennus € eivät näy **Kentät**-listassa eivätkä wizardissa, vaikka `fieldIds` sisältäisi ne.

| `id` (sivuille) | `key` (kaavoissa) | Rooli |
|-----------------|-------------------|--------|
| `field_system_tyoryhma_kesto_pv` | `tyoryhma_kesto_pv` | Kesto (pv), syöte tai kaava. Wizardissa tarkka arvo; yhteenvedossa arvioitu kesto + säävaraus. |
| `field_system_tyoryhma_kesto_h` | `tyoryhma_kesto_h` | Kesto (h) ilman säävarausta. Näkyy wizardissa jos sivulla. |
| `field_system_alennus_prosentti` | `alennus_prosentti` | Alennus % (0–100). Näkyy wizardissa. |
| `field_system_urakka` | `urakka_hinta_alv0` | Vie urakka; wizardissa yliajettavissa |
| `field_system_materiaalit` | `materiaalit` | Vie materiaalit; wizardissa yliajettavissa |
| `field_system_kokonaishinta_alv0` | `kokonaishinta_alv0` | Vie myyntihinta alv0; wizardissa yliajettavissa |
| `field_system_myyntikate` | `myyntikate` | Vie kate €; näyttö vain kortissa |
| `field_system_myyntipalkkio` | `myyntipalkkio` | Vie palkkio; wizardissa yliajettavissa |
| `field_system_alv` | `alv_maara` | Runko laskee |
| `field_system_kokonaishinta` | `kokonaishinta` | Runko laskee; wizardissa yliajo → uusi alv0 |
| `field_system_alennus_eur` | `alennus_eur` | Runko laskee |

**Materiaalit:** järjestelmäkenttä `materiaalit` (alv0). Alkaa tuoteriveistä; efektit `add_material_fixed` / `multiply_materials` täyttävät sen. Lomakkeella voi yliajaa summan. Älä luo omaa kenttää samalla avaimella. Tehdasoletuksen `kokonaishinta_alv0` käyttää `materiaalit`-muuttujaa, jos JSON ei korvaa kaavaa.

**Tehdasoletuksen kaavat** (vienti / uusi pohja; JSON saa korvata muut paitsi ALV ja sis. ALV):

```text
tyoryhma_kesto_h     = tyoryhma_kesto_pv * asetukset.tyopaivan_pituus
urakka_hinta_alv0    = tyoryhma_kesto_h * asetukset.tyoryhman_koko * asetukset.tuntihinta
kokonaishinta_alv0   = (urakka_hinta_alv0 + materiaalit)
                       / (1 - asetukset.myyntikate_prosentti/100 - asetukset.myyntipalkkio_prosentti/100)
                       / (1 + asetukset.alv_prosentti/100)
myyntikate           = kokonaishinta * asetukset.myyntikate_prosentti/100
myyntipalkkio        = kokonaishinta * asetukset.myyntipalkkio_prosentti/100
```

`asetukset.tyoryhman_koko` ja `asetukset.myyntipalkkio_prosentti` tulevat **tämän tuoterakenteen** asetuksista (katso §8.2). Tuntihinta, työpäivän pituus, ALV ja kateprosentit tulevat Yleinen-asetuksista.

Jos korvaat myyntihinnan esim. `liukuva_myyntihinta(urakka_hinta_alv0 + materiaalit)`, korvaa tarvittaessa myös `myyntikate` ja `myyntipalkkio` samaan metodiikkaan.

### 9.1 Materiaalit JSONissa – kolme tapaa

| Tapa | Milloin | JSON |
|------|---------|------|
| **A. Materiaalirivit** | Tuote+määrä -editori (ei rivin lomakkeessa) | `pages[].system: "materials"` |
| **B. Kiinteä lisä €** | Esim. +150 € aina | `"effects": [{ "type": "add_material_fixed", "value": 150 }]` |
| **C. Laskettu summa** | Kaava laskee hinnan → materiaaleihin | `computed` + `"effects": [{ "type": "add_material_fixed" }]` (ilman `value`) |

Kaikki kolme **voidaan yhdistää**: `materiaalit = rivien summa × kerroin + efektien lisät`.

---

#### Tapa A – Materiaalirivit (`system: "materials"`)

Lisää sivu, jolla `system` on `"materials"`. Kenttälistaa (`fieldIds`) ei tarvita. **Tuoterakenteen rivin lomake ei näytä tätä sivua** (tuote valitaan `product_select`-kentästä). Sivua voi käyttää vain, jos jokin muu näkymä sitä lukee; oletuspohjassa sitä ei ole.

```json
{
  "id": "page_materials",
  "title": "Materiaalit",
  "sortOrder": 2,
  "system": "materials",
  "fieldIds": []
}
```

Tuotteet määritellään sovelluksessa (**Tuotteet**), ei JSON-lomakkeessa. Rivin lomakkeessa tuote valitaan `product_select`-kentästä.

---

#### Tapa B – Kiinteä materiaalisumma kentältä

Numero- tai muu kenttä lisää aina saman €-summan:

```json
{
  "id": "field_kuljetus",
  "key": "kuljetuslisa",
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
  "formula": "laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.ostohinta",
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

- ❌ Kirjoittaa omaa `materiaalit`-kenttää `fields`-taulukkoon – käytä `field_system_materiaalit` (putki täyttää arvon)
- ❌ Kirjoittaa `alv_maara` / `kokonaishinta`-kaavaa – runko laskee ne `kokonaishinta_alv0`:sta
- ❌ Odottaa, että `product_select` tai `computed` lisää materiaaleihin **ilman** `effects`-taulukkoa

Valmis kopioitava esimerkki: **[examples/materiaalit-kaava-esimerkki.json](./examples/materiaalit-kaava-esimerkki.json)**

### 9.2 Työ ja kesto JSONissa

Runko näyttää `urakka_hinta_alv0`-arvon hintakortissa. **JSON vie avaimen** – joko oletuskaavalla tai omalla kaavalla.

Oletus (jos JSON ei korvaa):

```text
urakka_hinta_alv0 = tyoryhma_kesto_h × asetukset.tyoryhman_koko × asetukset.tuntihinta
```

(`tyoryhman_koko` = tämän tuoterakenteen Työryhmän koko; `tuntihinta` = Yleinen-asetukset.)

Voit korvata kaavan viedyssä JSON:ssa (esim. henkilötunnit × tuntihinta + matka). Runko ei sido JSON:ia tähän oletukseen.

Jos käytät oletusurakkaa, kestoa voi kasvattaa kolmella tavalla:

| Tapa | Milloin | JSON / mekanismi |
|------|---------|------------------|
| **A. Kesto kaavalla** | Pinta-ala → päivät | Kaava kentälle `tyoryhma_kesto_pv` |
| **B. Lisää tunteja** | Esim. +2 h esivalmistusta | `"effects": [{ "type": "add_duration", "value": 2 }]` |
| **C. Kerro kestoa** | Esim. vaikea kohde × 1,2 | `"effects": [{ "type": "multiply_duration", "value": 1.2 }]` |

Kuten materiaaleissa: `add_duration` **ilman** `"value"`-kenttää käyttää kentän omaa numero-/laskenta-arvoa **tunteina**.

Lopullinen kesto: `(peruskesto tunteina × kerroin) + lisätunnit`. Oletusurakka lukee tämän keston. Jos JSON:n `urakka_hinta_alv0`-kaava ei käytä `tyoryhma_kesto_h` / `_pv`, kestoefektit **eivät** muuta urakkahintaa – vie urakka omalla kaavalla.

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

**Huom:** Sijoita `field_system_tyoryhma_kesto_pv` jollekin sivulle `fieldIds`-listassa, jotta kesto näkyy wizardissa. `showOnSummary` ei vie järjestelmäkenttää Lomaketietoihin. JSON-`label` voi olla „Työn kesto”; yhteenveto näyttää „Työn arvioitu kesto” ja kertoo säävarauskertoimen ennen ylöspäin pyöristystä.

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

- ❌ Näyttää `alv_maara`, kate € tai alennus € lomakkeella – ne ovat vain hintakortissa
- ❌ Kertoa alennus myyntihintakaavaan – runko tekee sen listahinnan jälkeen
- ❌ Kirjoittaa `alv_maara` / `kokonaishinta`-kaavaa – runko laskee ne `kokonaishinta_alv0`:sta (sis. ALV -yliajo kääntää suhteen)
- ✅ Vie `urakka_hinta_alv0` ja `kokonaishinta_alv0` omilla kaavoilla, jos oletus ei riitä
- ✅ Laita urakka, materiaalit, palkkio ja kokonaishinnat sivulle, jos haluat näyttää ja yliajaa ne lomakkeella

Valmis esimerkki (materiaalit + kesto): **[examples/materiaalit-kaava-esimerkki.json](./examples/materiaalit-kaava-esimerkki.json)** – voit yhdistää §9.1- ja §9.2-kentät samaan pohjaan.

---

## 10. Näkyvyys (`showWhen` ja `showOnSummaryWhen`)

**`showWhen`** – näytä kenttä wizardissa vain kun ehto täyttyy. Sama ehto piilottaa kentän myös yhteenvedosta (piilotettu kenttä on kaavoissa `0`).

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

**`showOnSummaryWhen`** – näytä kenttä **vain yhteenvedossa** kun ehto täyttyy. Wizardissa kenttä pysyy näkyvissä. Vaatii `showOnSummary: true`.

```json
{
  "key": "lisatyot_kuvaus",
  "type": "text",
  "showOnSummary": true,
  "showOnSummaryWhen": {
    "fieldKey": "lisatyot",
    "operator": "eq",
    "value": "true"
  }
}
```

Boolean-kytkin: `"value": "true"` = Kyllä. Valintalista: `option.value`, ei näyttöteksti.

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
| `add_duration` | Lisää tunteja `tyoryhma_kesto_h`:hon | Kyllä (numero/computed) |
| `multiply_duration` | Kertoo `tyoryhma_kesto_h`:n | Kyllä (numero/select/computed kontekstissa) |

Kestoefekti päivittää urakan **vain**, jos `urakka_hinta_alv0` riippuu kestosta (oletuskaava). Omalla urakkakaavalla efekti ei riitä – päivitä myös se kaava.

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

Tuotteet määritellään erikseen (**Tuotteet**-näkymä: ostohinta, myyntihinta, kate, menekki, työkerroin). Tuote voi kuulua useaan tuoterakenteeseen; rivin lomake näyttää vain kyseisen rakenteen tuotteet **siinä järjestyksessä, joka on asetettu Tuotteet-listassa** (↑↓). Lomake viittaa tuotteeseen id:llä:

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
kaytettava_maali.ostohinta      (alias: .purchase_price, .yksikkohinta, .hinta, .unit_price)
kaytettava_maali.myyntihinta    (alias: .sale_price)
kaytettava_maali.kate           (alias: .kate_eur, .margin) — myynti − osto, alv0
kaytettava_maali.kate_prosentti (alias: .margin_percent) — (myynti − osto) / myynti × 100
kaytettava_maali.menekki        (alias: .consumption)
kaytettava_maali.tyokerroin     (alias: .work_factor)
```

Hinnat tulevat **Tuotteet**-rekisteristä (ostohinta ja myyntihinta, alv0). Kate lasketaan automaattisesti. Vanha `.yksikkohinta` tarkoittaa ostohintaa, jotta aiemmat kaavat toimivat.

Esimerkkikaava (materiaalikustannus ostohinnalla):

```text
laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.ostohinta
```

Myyntihinta ja kate samasta tuotteesta:

```text
laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.myyntihinta
kaytettava_maali.kate
kaytettava_maali.kate_prosentti
```

---

## 14. Täydellinen miniesimerkki

Katso valmis tiedosto: **[examples/peruslaskenta-lomakepohja.json](./examples/peruslaskenta-lomakepohja.json)**

Se sisältää:
- Asiakassivun
- Pinta-alasivun (numero, select, computed)
- Kestosivun (`field_system_tyoryhma_kesto_pv` ja `field_system_alennus_prosentti`)
- Hintasivun (urakka, materiaalit, palkkio, kokonaishinnat – yliajettavissa)
- Oletusarvot numero- ja select-kentille
- **Ei** `system: "materials"` -sivua (kuten tehdasoletus)

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
  "formula": "laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki * kaytettava_maali.ostohinta",
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
- [ ] `showWhen.fieldKey` ja `showOnSummaryWhen.fieldKey` viittaavat olemassa olevaan kenttään
- [ ] `defaultValue` on merkkijono (numerot lainausmerkeissä)
- [ ] `product_select`-oletusarvo on olemassa oleva tuote-id
- [ ] `kokonaishinta_alv0` on listahinta (ei alennusta kaavassa)
- [ ] `alv_maara` / `kokonaishinta` jätetty rungolle (kaavaa ei tarvita)
- [ ] Kesto, alennus-% ja halutut hinta-yliajot sivulla; kate / ALV € / alennus € eivät lomakkeella
- [ ] Materiaalit: `system: "materials"`-sivu ja/tai `effects` (`add_material_fixed` / `multiply_materials`) — tai hyväksyt 0 €
- [ ] Laskettu materiaali: `computed` + `"effects": [{ "type": "add_material_fixed" }]` (ilman `value` jos kaavan tulos)
- [ ] Urakka: oletuskaava + kesto **tai** oma `urakka_hinta_alv0`-kaava (kestoefekti ei riitä omaan kaavaan)
- [ ] Jos korvaat `kokonaishinta_alv0`-kaavan (`liukuva_myyntihinta` tms.), kate ja palkkio vastaavat samaa metodia
- [ ] Työryhmän koko asetettu **tälle rakenteelle** (Asetukset → Tuoterakenteet), ei Yleinen-sivulle

## 17. Yleisimmät virheet

| Ongelma | Ratkaisu |
|---------|----------|
| Tuonti: „JSON on tyhjä / virheellinen” | Tarkista syntaksi; poista kommentit (JSON ei tue `//`) |
| Tuonti: „puuttuu fields tai pages” | Lisää molemmat taulukot juureen |
| Kenttä ei näy wizardissa | Lisää `id` sivun `fieldIds`-listaan. Kate, ALV € ja alennus € piilotetaan aina. |
| Kaava palauttaa 0 | Tarkista `key`-nimet; onko lähdekenttä piilotettu `showWhen`:lla |
| Valinta ei vaikuta kaavaan | `select`-option `value` pitää olla numero merkkijonona |
| Hintakortti tyhjä / virhe | Vie `kokonaishinta_alv0`, `urakka_hinta_alv0`, kate, palkkio ja kesto. Tarkista Yleinen-asetukset (ALV, kate, tuntihinta) ja tuoterakenteen työryhmän koko / palkkio-%. |
| Materiaalit jäävät 0 | Lisää `effects` computed-kentälle tai `product_select`; pelkkä kaava ei riitä. `system: "materials"` ei näy rivin lomakkeessa. |
| Computed näyttää hinnan mutta materiaalit-kortti ei muutu | Puuttuu `"effects": [{ "type": "add_material_fixed" }]` |
| Urakkahinta ei muutu vaikka lisäsit työtä | Oletusurakka: `add_duration` tai kaava `tyoryhma_kesto_pv`:lle. Oma urakkakaava: päivitä `urakka_hinta_alv0`. |
| Lisätunnit eivät vaikuta | Puuttuu `"effects": [{ "type": "add_duration" }]`, kenttä piilotettu, tai urakka ei lue kestoa |

---

## 18. Työnkulku suositus

1. **Suunnittele sivut** – paperilla tai taulukossa: sivun nimi → kentät järjestyksessä.
2. **Määrittele avaimet (`key`)** – `a-z0-9_` (suomeksi ilman ääkkösiä, esim. `laskenta_seinapinta_ala_m2`).
3. **Rakenna JSON** – aloita esimerkistä; lisää kentät `fields`-taulukkoon; linkitä sivut.
4. **Testaa tuonti** – dev-ympäristössä; korjaa virheet.
5. **Kalibroi debug-tilassa** – Asetukset → Tuoterakenteet → [rakenne] → Lomake → Debug.
6. **Aja testilaskenta** ja tarkista yhteenveto (jokainen rivi omine lomaketietoineen).

---

## 19. Liittyvät tiedostot koodissa

| Tiedosto | Sisältö |
|----------|---------|
| `src/core/form/types.ts` | Tyypit (`FormField`, `FormPage`, …) |
| `src/core/form/formDefinitionIo.ts` | Tuonti / vienti |
| `src/core/form/formDefinitionHelpers.ts` | Normalisointi ja wizard-näyttö |
| `src/core/form/systemFields.ts` | Vientiavaimet, merge, rungon ALV-kaavat |
| `src/core/calculation/pricingSkeleton.ts` | ALV ja sis. ALV `kokonaishinta_alv0`:sta |
| `src/core/calculation/discount.ts` | Alennus listahinnan jälkeen |
| `src/core/form/settingsFormulaContext.ts` | `asetukset.*` kaavamuuttujat |
| `src/core/structure/structureSettings.ts` | Tuoterakenteen työryhmän koko ja palkkio kaavakontekstiin |
| `src/core/form/defaultFormDefinition.ts` | Tehdasoletus (Julkisivumaalaus) |
| `src/core/form/productContext.ts` | Tuoteattribuutit kaavoissa (`.ostohinta`, `.myyntihinta`, `.kate`, `.menekki`, `.tyokerroin`) |
