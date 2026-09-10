# Urakkalaskuri – sovelluksen kuvaus

ColoRajatonin tarjouslaskuri (Expo / React Native, Android). Pakettiversio **v1.2.4**. Laskelma = asiakas + toimitusajankohta + matka-aika yhteen suuntaan + tuoterakennerivit.

Tämä sivu kuvaa **miten sovellus toimii nyt**. JSON-kentät ja kaavat: [lomakepohja-json-ohje.md](./lomakepohja-json-ohje.md). Tuoterakenteiden malli: [tuoterakenteet.md](./tuoterakenteet.md). Kehitysympäristö: [README.md](../README.md).

PDF (tarjous / urakkakortti) ei ole käytössä. Suunnitelma: [v1.3-suunnitelma.md](./v1.3-suunnitelma.md).

Composer-malli on tuotantopolku. Yhtenäisyystarkistuksen siivous: [yhtenaisyystarkistus.md](./yhtenaisyystarkistus.md).

---

## Näytöt

| Polku | Mitä se tekee |
|-------|----------------|
| Koti | Uusi laskenta, historia, tuotteet, asiakkaat, asetukset |
| Laskenta (`/wizard`) | Asiakas, toimitusajankohta, tuoterakennerivit. **Yhteenveto** tallentaa laskelman |
| Asiakas (`/wizard/customer`) | Yhteystiedot ja rekisterihaku (nimi *) |
| Rivin lomake (`/wizard/line/…`) | Tuoterakenteen lomakesivut. **Valmis** laskee rivin hinnat |
| Laskelman tiedot | Yhteinen näkymä yhteenvedon jälkeen ja historiasta. Roskakori poistaa laskelman. Kopiointi vain asiakastiedoista. **Sulje** → historia |
| Historia | Tallennetut laskelmat |
| Tuotteet | Materiaalit: ostohinta, myyntihinta, kate, menekki, työkerroin, tuoterakenteet. Järjestys nuolilla |
| Asiakkaat | Rekisteri |
| Asetukset | Yleinen, tuoterakenteet (lomake per rakenne), teema |

Kesken jäänyt laskenta: punainen palkki **Jatka laskentaa**. **Uusi laskenta** kysyy vahvistuksen, jos luonnos on olemassa (luonnos tyhjennetään).

---

## Laskenta

Laskentasivulla ei ole enää yhtä globaalia wizardia. Rakenne:

```
Asiakas          → oma sivu (rekisteri)
Toimitusajankohta   vapaateksti
Matka-aika yhteen suuntaan   tunteina (kaava: `laskelma.matka_aika_h`)
Tuoterakennerivit   kortti per rivi (määrä, yksikkö, alv0/sis. ALV, hinta, materiaalit, työn hinta, ale %, lisätiedot, kate)
Yhteenveto          tallentaa SQLite-laskelman
```

**Lisää tuoterakenne** valitsee mallipohjan tai **Ei pohjaa** (tyhjä rivi ilman lomaketta). Mallipohjan oletushinnat ja lisätiedot tulevat rakenteen asetuksista. Hammasratas avaa rakenteen lomakkeen; lomake yliajaa oletushinnat, ellei niitä ole muokattu kortilla.

**Yhteenveto** on pois käytöstä, kun jollain rivillä on keskeneräinen lomake.

### Poistuminen

- **Laskenta:** jos tila on sama kuin tallennettu luonnos tai avattu laskelma, tallennusta ei kysytä. Muuten: Peruuta / Tallenna keskeneräisenä / Poistu tallentamatta. Valmiin laskelman avaaminen muokkaukseen ei jätä **Jatka laskentaa** -luonnosta, jos mitään ei muutettu.
- **Rivin lomake:** ei kysytä, jos kentät ovat samat kuin tallennetut. Muuten Sulje tallentamatta + **Tallenna keskeneräisenä**, tai **Tallenna** jos kaikki pakolliset kentät on täytetty (ajaa laskennan riville kuten Valmis).

### Tallennus

| Miten avattiin | Tallennus |
|----------------|-----------|
| Uusi laskenta | Uusi rivi ensimmäisellä **Yhteenveto**-kerralla |
| Historia → **Muokkaa** | Sama `id`, alkuperäinen `createdAt` säilyy |
| **Jatka laskentaa** kesken jääneestä muokkauksesta | Sama `id` kuin muokattavalla rivillä |
| **Jatka laskentaa** uudesta luonnoksesta | Uusi rivi ensimmäisellä yhteenvedolla |

Luonnos (`wizard_drafts`) sisältää tarvittaessa `editCalculationId`. Historia-muokkaus ei kirjoita luonnosta heti avattaessa: luonnos syntyy vasta kun sisältö eroaa avatusta laskelmasta tai käyttäjä tallentaa keskeneräisenä. `editCalculationId` varmistaa, että jatko päivittää samaa riviä.

**Sulje** erittelyssä tyhjentää luonnosta ja vie historiaan.

**Poista** (roskakori nimen vieressä) kysyy vahvistuksen. Onnistunut poisto palaa historialistaan. Jos sama laskelma oli muokattavana, luonnos tyhjennetään.

### Asiakas

Oma sivu, ei tuoterakenteen JSON-kenttiä: nimi *, puhelin, sähköposti, osoite, postinumero, postitoimipaikka, lisätiedot, tyyppi (yksityinen/yritys), yritykselle käänteinen ALV.

Nimi on haku rekisteristä. Valinta täyttää tiedot. Ilman valintaa tallennus luo uuden rekisteririvin (sama nimi saa esiintyä kahdesti). Viisinumeroinen Varsinais-Suomen postinumero täyttää postitoimipaikan; kentän voi kirjoittaa itse.

Jos muokataan olemassa olevaa rekisteriasiakasta ja tiedot muuttuivat, kysytään päivitetäänkö vanhat laskelmat.

Yhteenvedossa kopiointinappi on vain asiakkaan yhteystiedoissa.

---

## Yhteenveto (erittely)

1. Asiakkaan tiedot, toimitusajankohta ja matka-aika yhteen suuntaan.
2. **Kokonaissumma:** materiaalit, työ, alennus (jos > 0 %), kokonaishinnat (alv0 / ALV / sis. ALV). Yksityinen: korostus sis. ALV. Yritys: korostus alv0; käänteinen ALV tarvittaessa.
3. **Yksi rivi:** työn arvioitu kesto näytetään kokonaissummassa (säävarauskerroin + tasapäiviin ylöspäin). Päiviä ei summata riveiltä.
4. **Useita rivejä:** jokaisella tuoterakenteella oma otsikko, hintakortti (kesto tälle riville), **Lisätiedot** (jos täytetty) ja **Lomaketiedot**. Yhdellä rivillä Lisätiedot (jos täytetty) ja Lomaketiedot (hinnat ovat jo kokonaissummassa).

Lomaketiedot tulevat rivin snapshotista tai täytetyistä kentistä. Jokainen täytetty rivi näyttää omat speksinsä.

Lomakepohjan `version` kasvaa tallennettaessa. Vanhaa laskelmaa muokatessa näytetään varoitus, jos rivin lomakeversio eroaa nykyisestä.

---

## Tuoterakenteet

Asetukset → **Tuoterakenteet**: nimi, valinnainen yksikkö, myyntipalkkio-%, työryhmän koko, lisätiedot (oletusteksti), oletushinta / työn hinta / materiaalit alv0, **Lomake** (sivut, kentät, JSON, debug).

Jokaisella rakenteella on oma `FormDefinition`. Tuotteet eivät ole rakenteen asetuksissa; ne liitetään tuotteelta (yksi tuote voi kuulua useaan rakenteeseen).

Rivin lomake näyttää vain sivut, joilla on kenttiä. Tyhjä Asiakas-sivu (ilman lisäkenttiä) ja `system: "materials"` piilotetaan. Yhteystiedot ovat laskennan asiakassivulla.

---

## Tuotteet

Nimi, yksikkö, **ostohinta** (alv0), **myyntihinta** (alv0), laskettu kate € / %, kuvaus, menekki, työkerroin, tuoterakenteet. Kopiointi luo uuden tuotteen listan loppuun.

**Järjestys:** Tuotteet-listassa ↑↓. Sama järjestys on `product_select`-kentässä (suodatettuna rakenteen mukaan). Uusi tuote ja kopio lisätään loppuun.

Kaavoissa (kun `product_select` on valittu): `.ostohinta`, `.myyntihinta`, `.kate`, `.kate_prosentti`, `.menekki`, `.tyokerroin`. Vanha `.yksikkohinta` = ostohinta. Materiaalirivit käyttävät ostohintaa.

---

## Alennus

Järjestelmäkenttä `alennus_prosentti` (0–100 %). Rivikortissa **Ale %**.

- Kaavat laskevat ensin listahinnan.
- Sovellus vähentää alennuksen myyntihinnasta; kate on jäännös kustannusten ja palkkion jälkeen.
- **Älä** kerro alennusta `kokonaishinta` / `liukuva_myyntihinta`-kaavaan.
- JSON: lisää sivulle `"field_system_alennus_prosentti"`.

---

## Liukuva kate

Asetukset → Yleinen: alaraja € / kate %, yläraja € / kate %.

Kaava: `liukuva_myyntihinta(suorat_kustannukset_alv0)` → myyntihinta alv0.

---

## Lomake (per tuoterakenne)

- **Sivut** = rivin lomakkeen vaiheet. Kentät ovat globaaleja; sivu viittaa `fieldIds`.
- **Asiakassivu** (`system: "customer"`) jää rakenteeseen lisäkentille. Järjestelmän yhteystiedot eivät ole tällä sivulla. Tyhjä sivu piilotetaan.
- **Materiaalirivit** (`system: "materials"`) eivät ole rivin lomakkeessa. Tuote valitaan `product_select`-kentästä.
- Järjestelmäkentät lisätään tuonnissa. Lomakkeella voi yliajaa keston, alennus-%:n, urakan, materiaalit, palkkion ja kokonaishinnat. Kate, ALV € ja alennus € ovat laskennan tulosta, eivät Lomaketiedot-osiossa.
- **Kentät**-asetuksissa sivut ovat oletuksena suljettu; avaus muistetaan (`fields_page_expanded`).
- Lasketun kentän manuaalinen arvo: teemavärinen reset-nuoli palauttaa kaavan tuloksen.

JSON-tuonti: **Asetukset → Tuoterakenteet → [rakenne] → Lomake → Tuo JSON…**

---

## Tietokanta (paikallinen SQLite)

- `product_structures` (lomakepohja JSON:na, palkkio-%, työryhmän koko, lisätietojen oletus, oletushinnat alv0)
- `products` (ostohinta, myyntihinta, attribuutit, `structure_ids`, `sort_order`)
- `customers`
- `calculations` (`structure_lines`, `form_snapshot` yhteensopivuutta varten, asiakas-snapshot)
- `settings` (avain–arvo)
- `wizard_drafts` (yksi kesken oleva laskenta, tarvittaessa `editCalculationId`)

Ei pilvisynkkaa.

---

## Teema ja brändi

Asetukset → Teema: korostus-, pää-, teksti- ja pintaväri, taustakuva, logo. Fontti IBM Plex Sans. Logo ColoRajaton.

Kuvakkeet: `@expo/vector-icons` (Ionicons) `ThemedIcon`-komponentin kautta. SF Symbols ei näy Androidilla.

---

## Siirtymä (v1.2 → tuoterakenteet)

Composer on tuotantopolku. Vanha istunto ja globaali lomake ovat yhä kytkettyinä koodissa:

- `WizardSession`-tyyppi kantaa yhä `result` / `formContext` / `materialLines`, mutta UI kirjoittaa vain `null`. Luonnos on `wizard_drafts`.
- `buildCalculationRecord` (form-putki) on testikäytössä; tallennus menee `buildCalculationRecordFromComposer`-kautta.
- Lomake-editori (`/settings/calculation`) muokkaa **aktiivista** tuoterakennetta (`activeStructureId`) ja kirjoittaa myös `settings.form_definition`.
- Alennus: lomakkeen `applyDiscountToResult` vs rivin ale-% + `aggregateStructureLines`.

Näitä ei pidä käyttää uusena mallina. Lista: [yhtenaisyystarkistus.md](./yhtenaisyystarkistus.md).
