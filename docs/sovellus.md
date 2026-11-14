# Urakkalaskuri – sovelluksen kuvaus

ColoRajattoman tarjouslaskuri (Expo / React Native, Android). Pakettiversio **v1.3.4**. Laskelma = asiakas + kohteen osoite + toimitusajankohta + matka-aika yhteen suuntaan + tuoterakennerivit.

Tämä sivu kuvaa **miten sovellus toimii nyt**. JSON-kentät ja kaavat: [lomakepohja-json-ohje.md](./lomakepohja-json-ohje.md). Tuoterakenteiden malli: [tuoterakenteet.md](./tuoterakenteet.md). Kehitysympäristö: [README.md](../README.md).

Nykyinen versio on **1.3.4**. Muutokset ja hyväksyntä: [v1.3.4-hyvaksyminen.md](./v1.3.4-hyvaksyminen.md). Versioon 1.3.3 kuuluvat tarjouksen ja urakkakortin PDF sekä liitteet (valinta, kuvankäsittely, tarjouksessa kaksi kuvaa sivulla tai yksi iso kuva, urakkakortissa neljä kuvaa sivulla). Kuvaus: [liitteet.md](./liitteet.md). Suunnitelma: [v1.3-suunnitelma.md](./v1.3-suunnitelma.md).

Composer-malli on tuotantopolku. Yhtenäisyystarkistuksen siivous: [yhtenaisyystarkistus.md](./yhtenaisyystarkistus.md).

### v1.3.4

Kohteen osoite, rakenteen Lisätiedot omassa osiossa, sävykohtaiset materiaalimäärät, luonnoksen sama id ja logo tulosteessa. Kaavat ja tuodut JSON-pohjat eivät muutu. Tarkka matriisi: [v1.3.4-hyvaksyminen.md](./v1.3.4-hyvaksyminen.md).

### v1.3.3

- Keskeneräinen laskenta tallentuu `calculations.status = 'draft'` ja näkyy historiassa punaisella merkinnällä **Keskeneräinen**. Uusi laskenta ei poista muita luonnoksia. Vanha `wizard_drafts`-rivi nostetaan luonnoslaskelmaksi, sitä ei hävitetä.
- Laskelman tiedoista ja Dokumentit-välilehdeltä on poistettu alareunan **Sulje**.
- Puhelimen kansio on asetuksissa (Yleinen), vain Androidilla. Laatikko on väliaikainen ja poistuu versiossa 1.4.
- Uusi liite lisätään yhdellä **Lisää liite** -painikkeella. Oletuskohde on urakkakortti. Tarjouksen kuvamäärä sivulla päätetään kuvatekstin pituudesta taiton laskennalla (ei laitteen mittauksella): lyhyt kuvateksti on kaksi kuvaa sivulla, yli kolmen rivin kuvateksti tai liian korkea blokki on yksi kuva sivulla. Kortti pysyy 2×2-ruudukkona.
- Luontilomakkeella liitteet ovat **Liitteet: N** heti **Luo tarjous** / **Luo urakkakortti** -painikkeen yläpuolella. N on sen dokumentin liitteiden määrä.
- Dokumenttirivillä on **Lataa**. Onnistuminen ilmoitetaan sovelluksessa. Jos kansiota ei ole valittu, näytetään virhe.
- Urakkakortti tulostaa **Urakkasumma alihankkija** ja **Urakkasumma työntekijä**. Kelvoton tai puuttuva sivukulukerroin tulostaa työntekijähinnan oletuksella 1,5. Usealla rakenteella kortti tulostaa myös rivikohtaisen erittelyn **Urakka: [nimi]**. Summa on vain otsikossa. Rivikohtainen hinnan yliajo säilyy. Vanhaa tilavalintaa ei enää kysytä.
- Kotitalousvähennystulosteessa ei ole Peruste-saraketta. Sovelluksen näytössä sellaista saraketta ei ollut. Katto on 2 100 €/hlö. Esimerkki: bruttovähennys 2 300 € ja kaksi henkilöä. Kahden henkilön katto olisi 4 200 €, mutta yhden henkilön katto (2 100 €) on suurempi kuin kahden henkilön vähennys omavastuiden jälkeen (2 000 €), joten laskenta käyttää yhtä henkilöä.
- Tarjouksen yhteiset asetukset ovat **Asetukset → Tarjous**. Sivukytkimiä ei näytetä, koska tuloste ei lue `offerPages`-arvoja. Tallennetut `offer_settings:<id>`-sivut säilyvät. **Sivukulukerroin** on **Asetukset → Yleinen**. Kelvoton arvo näytetään punaisella huomautuksella, eikä kenttä vaihda sitä hiljaa oletukseen. Arvot tallentuvat edelleen `offer_company_settings`- ja `offer_settings:<id>`-avaimiin. Uusi rivi kopioi rakenteen **Lisätiedot**-oletuksen omaan kenttäänsä. Tyhjä merkkijono on tyhjennys, eikä sitä täytetä uudelleen. Vanhan laskelman riviltä, jolta kenttä puuttuu, tuloste ei lue rakenteen nykyistä oletusta. Tulosteen Muuta-teksti on ensimmäisen tuoterakenteen oma teksti. Manuaalirivin kuvaus tulostuu tarjoukseen aina, eikä se vie Muuta-paikkaa. Vanhaa `offer_settings`-lisätekstiä ei tulosteta eikä tyhjennetä. Yrityksen Lisätiedot tulostuu vain tarjoukseen.
- Rivin lomakkeen viimeisellä sivulla on **Päivitä hinta** (oletus päällä). Päällä lomakkeen hinta korvaa rivin hinnan ja rivikohtaisen yliajon. Pois päältä hinnat ja yliajot säilyvät.
- Laskentasivulla **Tallenna ja sulje** on **Yhteenveto**-painikkeen alla. Valmis laskelma tallennetaan kuten yhteenveto. Keskeneräinen tallennetaan luonnokseksi.

---

## Näytöt

| Polku | Mitä se tekee |
|-------|----------------|
| Koti | Uusi laskenta, historia, tuotteet, asiakkaat, asetukset |
| Laskenta (`/wizard`) | Asiakas, toimitusajankohta, tuoterakennerivit. **Yhteenveto** tallentaa laskelman |
| Asiakas (`/wizard/customer`) | Yhteystiedot ja rekisterihaku (nimi *) |
| Rivin lomake (`/wizard/line/…`) | Tuoterakenteen lomakesivut. **Valmis** laskee rivin hinnat |
| Laskelman tiedot | Yhteinen näkymä yhteenvedon jälkeen ja historiasta. Roskakori poistaa laskelman. Kopiointi vain asiakastiedoista. Paluu on laitteen oma. |
| Historia | Tallennetut laskelmat |
| Tuotteet | Materiaalit: ostohinta, myyntihinta, kate, menekki, työkerroin, tuoterakenteet. Järjestys nuolilla |
| Asiakkaat | Rekisteri |
| Asetukset | Yleinen, tarjous, tuoterakenteet (lomake per rakenne), yritys, teema |

Kesken jäänyt laskenta: punainen palkki **Jatka laskentaa**. **Uusi laskenta** jättää aiemmat luonnokset historiaan.

---

## Laskenta

Laskentasivulla ei ole enää yhtä globaalia wizardia. Rakenne:

```
Asiakas          → oma sivu (rekisteri)
Toimitusajankohta   vapaateksti
Matka-aika yhteen suuntaan   tunteina (kaava: `laskelma.matka_aika_h`)
Tuoterakennerivit   kortti per rivi (nimi, määrä, yksikkö, alv0/sis. ALV yksityisasiakkaalla, hinta, materiaalit, työn arvioitu kesto, ale %, lisätiedot, kate)
Yhteenveto          tallentaa SQLite-laskelman
```

**Lisää tuoterakenne** valitsee mallipohjan tai **Ei pohjaa** (tyhjä rivi ilman lomaketta). Mallipohjan oletushinnat, arvioitu kesto ja lisätiedot tulevat rakenteen asetuksista. Hammasratas avaa rakenteen lomakkeen; lomake yliajaa oletushinnat, ellei niitä ole muokattu kortilla.

**Yhteenveto** on pois käytöstä, kun jollain rivillä on keskeneräinen lomake.

### Poistuminen

- **Laskenta:** jos tila on sama kuin tallennettu luonnos tai avattu laskelma, tallennusta ei kysytä. Muuten: Peruuta / Tallenna keskeneräisenä / Poistu tallentamatta. Kysymys tulee **kaikista poistumisteistä**: otsikon Takaisin, Android-paluunäppäin, pyyhkäisyele ja JS-navigointi. Valmiin laskelman avaaminen muokkaukseen ei jätä **Jatka laskentaa** -luonnosta, jos mitään ei muutettu.
- **Rivin lomake:** ei kysytä, jos kentät ovat samat kuin tallennetut. Muuten **Sulje tallentamatta** palauttaa edellisen tallennetun lomakkeen, tai **Tallenna keskeneräisenä**. Sama dialogi otsikon Takaisin-, ele-, laitteistopaluu- ja **Takaisin**-napista. Jos kaikki pakolliset kentät on täytetty, poistumisen **Tallenna** ajaa laskennan riville kuten Valmis. Keskeneräistä ei tallenneta kysymättä.
- **Asiakas-sivu:** tallentamattomat asiakasmuutokset kysytään ennen poistumista.

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
3. **Yksi rivi:** työn arvioitu kesto näytetään kokonaissummassa. Kortilla voi yliajaa näytettävän luvun. Päiviä ei summata riveiltä.
4. **Useita rivejä:** jokaisella tuoterakenteella oma otsikko, hintakortti (kesto tälle riville), **Lisätiedot** (jos täytetty) ja **Lomaketiedot**. Yhdellä rivillä Lisätiedot (jos täytetty) ja Lomaketiedot (hinnat ovat jo kokonaissummassa).

Lomaketiedot tulevat rivin snapshotista tai täytetyistä kentistä. Jokainen täytetty rivi näyttää omat speksinsä. Järjestelmäkenttä `tyoryhma_kesto_pv` ei kuulu Lomaketietoihin; arvioitu kesto on hintakortissa.

Lomakepohjan `version` kasvaa tallennettaessa. Vanhaa laskelmaa muokatessa näytetään varoitus, jos rivin lomakeversio eroaa nykyisestä.

---

## Työn arvioitu kesto

Lomakkeen `tyoryhma_kesto_pv` on **tarkka kesto** ja menee hinnoitteluun. Rivikortilla ja yhteenvedossa näytetään **Työn arvioitu kesto (pv)**: tarkka kesto × säävarauskerroin (Asetukset → Yleinen, oletus 1,3), pyöristetty ylöspäin tasapäiviin.

Rivikortin tai rakenteen oletuksen muokkaus vaihtaa **vain tätä näytettävää lukua**. Se ei muuta urakkaa, putken kestoa, kate- eikä hintatuloksia. Tyhjä kenttä palauttaa lasketun arvion. Ennen lomakkeen täyttöä näytetään rakenteen oletus, jos se on asetettu.

---

## Tuoterakenteet

Asetukset → **Tuoterakenteet**: nimi, valinnainen yksikkö, myyntipalkkio-%, **liukuva kate** (alaraja/yläraja € ja %), työryhmän koko, lisätiedot (oletusteksti), oletushinta / työn arvioitu kesto (pv) / materiaalit alv0, **Lomake** (sivut, kentät, JSON, debug).

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
- Rivikortin **Yhteensä** on hinta aleen jälkeen. Yhteenvedossa **Työ** = listahinta − materiaalit, **Alennus** erillisenä rivinä, sitten kokonaishinta. Rivit täsmäävät korttiin.
- **Älä** kerro alennusta `kokonaishinta` / `liukuva_myyntihinta`-kaavaan.
- JSON: lisää sivulle `"field_system_alennus_prosentti"`.

---

## ALV

- **Yksityisasiakas:** rivikortilla valinta ALV 0 / sis. ALV (oletus sis. ALV). Yhteenveto noudattaa samaa tilaa.
- **Yritysasiakas:** hinnat ovat automaattisesti ALV 0 (valintaa ei näytetä). Yhteenveto näyttää vain ALV 0 -hinnat; sis. ALV -kokonaissummaa ei näytetä. Käänteinen ALV merkitään tarvittaessa.

---

## Liukuva kate

Asetukset → Tuoterakenteet → [rakenne]: alaraja € / kate %, yläraja € / kate %. Jokaisella rakenteella oma kate. Uusi rakenne kopioi oletuksen aiemmista yleisistä arvoista.

Kaava: `liukuva_myyntihinta(suorat_kustannukset_alv0)` → myyntihinta alv0. Muuttujat `asetukset.myyntikate_*` tulevat **tästä tuoterakenteesta**.

---

## Lomake (per tuoterakenne)

- **Sivut** = rivin lomakkeen vaiheet. Kentät ovat globaaleja; sivu viittaa `fieldIds`.
- **Asiakassivu** (`system: "customer"`) jää rakenteeseen lisäkentille. Järjestelmän yhteystiedot eivät ole tällä sivulla. Tyhjä sivu piilotetaan.
- **Materiaalirivit** (`system: "materials"`) eivät ole rivin lomakkeessa. Tuote valitaan `product_select`-kentästä.
- Järjestelmäkentät lisätään tuonnissa. Lomakkeella voi yliajaa keston, alennus-%:n, urakan, materiaalit, palkkion ja kokonaishinnat. Kate, ALV € ja alennus € ovat laskennan tulosta, eivät Lomaketiedot-osiossa.
- **Kentät**-asetuksissa sivut ovat oletuksena suljettu; avaus muistetaan (`fields_page_expanded`).
- Lasketun kentän manuaalinen arvo: voi pyyhkiä lasketun luvun ja kirjoittaa uuden. Teemavärinen reset-nuoli palauttaa kaavan tuloksen.

JSON-tuonti: **Asetukset → Tuoterakenteet → [rakenne] → Lomake → Tuo JSON…** Onnistunut tuonti näyttää nimen, version ja edellisen version.

---

## Tietokanta (paikallinen SQLite)

- `product_structures` (lomakepohja JSON:na, palkkio-%, liukuva kate, työryhmän koko, lisätietojen oletus, oletushinta / materiaalit alv0, arvioitu kesto pv)
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
