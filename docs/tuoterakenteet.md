# Versio 1.3 – Tuoterakenteet

> **Tila:** Toteutettu sovelluksessa (PDF ei kuulu tähän)  
> **Nykyinen sovellus:** [sovellus.md](./sovellus.md)  
> **PDF myöhemmin:** [v1.3-suunnitelma.md](./v1.3-suunnitelma.md)  
> **Edeltäjä:** [v1.2](./v1.2-suunnitelma.md)

Laskelma = asiakas + toimitusajankohta + tuoterakennerivit. Lomake on rivin takana. Yhteenveto = kokonaissumma + rivikohtainen erittely. Ei PDF:ää.

Koodin jäämät (vanha istunto, kaksoiskirjoitus lomakkeelle): [yhtenaisyystarkistus.md](./yhtenaisyystarkistus.md).

---

## 1. Tavoite

```
Laskentasivu (pysty, mobiili)
  ├── Asiakas          oma osio → syöttösivu + rekisteri
  ├── Toimitusajankohta   vapaateksti, rivien ulkopuolella
  ├── Matka-aika yhteen suuntaan   tunteina, rivien ulkopuolella (`laskelma.matka_aika_h`)
  ├── Tuoterakennerivit   summakortit (ei erillistä „valitse tuote” -vaihetta)
  └── Yhteenveto        → tallennus + erittely
```

**Tuoterakenne** = mallipohja (nimi, lomake, tuotteet, myyntipalkkio-%).  
**Rivi** = esiintymä tällä laskelmalla. Summat voi kirjoittaa korttiin tai laskea lomakkeella (⚙).

---



## 2. Vahvistetut päätökset


| Aihe                   | Päätös                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Ale vs kate            | Rivilistassa **ale-%** (kaupallinen alennus). **Kate € ja kate-%** näytetään erikseen, laskettuina.                          |
| Yliajo                 | Lomakkeen jälkeen rivin summia saa muuttaa.                                                                                  |
| Materiaalit rivillä    | Yksi €-kenttä. Erittely ei kuulu rivilistaan.                                                                                |
| Mater. yliajo          | Lomakkeen `product_select`-valinta **säilyy** (näytetään lomakkeessa/yhteenvedossa) vaikka materiaalit € nollataan.          |
| Valitse tuote          | JSON:sta irrallinen materiaalivaihe (`system: "materials"`) ei ole käytössä. Tuote valitaan lomakkeen tuotelistakentästä.    |
| Asiakas (yhteystiedot) | Oma osio laskentasivulta (`CustomerStep`: nimi, puh, osoite…). **Poistuvat** lomakkeen Asiakas-sivulta.                      |
| Lomakkeen Asiakas-sivu | **Jää rakenteeseen** lisäkentille. Järjestelmän yhteystietokysymyksiä ei siellä enää ole.                                    |
| Urakka ilman lomaketta | **Ei pohjaa** pickerissä: tyhjä rivi ilman lomaketta. Hinnat ja työn hinta kirjoitetaan korttiin. |
| Rekisteri              | Asiakas **aina** rekisteriin. Sama nimi saa esiintyä kahdesti.                                                               |
| Nimi-kenttä            | Samalla haku: osumat alle; valinta täyttää tiedot; ei valintaa → uusi asiakas.                                               |
| Rekisterin muutos      | Kysytään: päivitetäänkö vanhat laskelmat. Ei → vain rekisteririvi.                                                           |
| Yhteenveto             | **Kokonaissumma kuten nyt**, sen alla erittely: jokainen tuoterakennerivi omine hintoineen ja kestoineen. Päiviä ei summata. |
| Kate riveillä          | € ja %; lasketaan rivistä (urakka, mater., palkkio, myyntihinta).                                                            |
| Palkkio                | Tuoterakenteen ominaisuus. Ei rivilistassa. Yhteenvedon erittelyssä per rivi.                                                |
| UI                     | Mobiili **pysty**. Kortti per rivi, tarvittaessa useampi rivi kortin sisällä.                                                |
| Toimitusajankohta      | Vapaamuotoinen teksti, **rivien ulkopuolella** (laskelmataso).                                                               |
| Matka-aika yhteen suuntaan | Tunnit, **rivien ulkopuolella**. JSON: `laskelma.matka_aika_h`.                                                          |


---



## 3. Laskentasivu (pääui)

Pysty, yksi ScrollView. Ei vaakataulukkoa.

```
┌ Asiakas ─────────────────────────────────┐
│ Jaana Rönkä                         ›    │
│ Piikkiö                                  │
└──────────────────────────────────────────┘

Toimitusajankohta
[ esim. viikko 42 / syksy 2026          ]

Matka-aika yhteen suuntaan
[ 0,75                               h  ]

Tuoterakenteet
┌ rivikortti 1 ─┐
┌ rivikortti 2 ─┐

[ + Lisää tuoterakenne ]

[ Yhteenveto ]
```

**Asiakas-kortti:** nimi + paikkakunta (tai „Lisää asiakas”). Avaa asiakassivun (§4).

**Toimitusajankohta:** `AppInput`, ei validointia, ei kalenteria v1.3. Tyhjä sallittu. Näkyy yhteenvedossa asiakkaan alla.

**Lisää tuoterakenne:** picker mallipohjista tai **Ei pohjaa** → tyhjä rivi ilman lomaketta. Mallipohjasta: määrä 1, ale 0, ALV asetuksista, oletushinnat ja lisätiedot rakenteen asetuksista.

**Tarjous / urakkakirja:** ei tässä versiossa (PDF myöhemmin). **Yhteenveto** vaatii nimen ja vähintään yhden rivin; keskeneräiset lomakkeet pitää täyttää ensin.

---



## 4. Asiakas



### 4.1 Syöttösivu

Nykyinen `CustomerStep`-kenttäjoukko (nimi *, puh, sähköposti, osoite, postinumero, postitoimipaikka, lisätiedot, tyyppi, käänteinen ALV).

**Nimi** on haku:

1. Kirjoitus suodattaa rekisteriä (`name` sisältää merkkijonon, aakkosjärjestyksessä, max ~8 osumaa).
2. Lista nimen **alla** (ei erillistä hakunäyttöä): nimi + osoite/paikkakunta erottimena.
3. Rivin valinta → täyttää kaikki kentät, `customerId` = valittu.
4. Ei valintaa → `customerId` tyhjä kunnes tallennus; tallennus **luo uuden** rekisteririvin vaikka nimi olisi sama kuin jollakulla muulla.

Poistuttaessa asiakassivulta / **Yhteenveto**: aina `INSERT` tai `UPDATE` rekisteriin.

Jos muokataan **olemassa olevaa** rekisteriasiakasta (id tiedossa) ja tiedot muuttuivat: dialogi

> Päivitetäänkö tämän asiakkaan vanhat laskelmat?

- **Kyllä** → kaikki laskelmat joilla sama `customerId`: snapshot = uudet tiedot.
- **Ei** → vain `customers`-rivi; vanhat snapshotit ennallaan.

Uusi asiakas: ei dialogia.

### 4.2 Lomakkeen Asiakas-sivu

Sivu **jää tuoterakenteen lomakkeeseen**. Siitä poistetaan järjestelmän yhteystietokentät (`CustomerStep`: nimi, puhelin, sähköposti, osoite, postinumero, postitoimipaikka, lisätiedot, tyyppi, käänteinen ALV). Jäljelle jäävät vain sivulle sijoitetut **lisäkentät** (`fieldIds`).

Jos sivulla ei ole lisäkenttiä, se voidaan piilottaa rivin lomakewizardista (tyhjä sivu). `system: "customer"` säilyy sivun tunnisteena, jotta lisäkentät pysyvät asiakassivulla.

---



## 5. Rivikortti (mobiili)

Idea on sama kuin leveässä taulukossa: **nimike + summat**. Ei tuote-erittelyä. Kate ei ole ale.

Yksi kortti, kentät kahdessa palstassa jossa se on luettavaa; muuten allekkain. Hammasratas otsikon oikealla (lomake).

```
┌──────────────────────────────────────────┐
│ Ulkoverhoilun maalaus              ⚙  🗑 │
│ Keskeneräinen lomake                     │  ← jos lomake avattu mutta ei täytetty
│                                          │
│ Määrä            [1,00]                  │
│ Yksikkö          [     ]                 │
│ Hinnat           [ alv0 | sis. ALV ]     │
│ Hinta €          [3 393,52]              │
│ Materiaalit €    [  365,00]              │
│ Työn hinta €     [  800,00]              │
│ Ale %            [    5,00]              │
│ Lisätiedot       [ …                   ] │  ← valinnainen; oletus rakenteesta
│ Kate (alv0)        1 234,00 € · 28,5 %   │  ← vain näyttö
│ Yhteensä           3 223,84 €            │  ← laskettu
└──────────────────────────────────────────┘
```

Muokattavat: määrä, yksikkö, hinta, materiaalit, työn hinta, ale-%, ALV-tila, lisätiedot. **Ei pohjaa** -rivillä myös nimi.  
Lasketut: kate €, kate %, yhteensä. Hinta/materiaalit/työn hinta/yhteensä noudattavat kortin alv0 / sis. ALV -valintaa.

**Kaavat (alv0, ale kuten nykyinen alennus):**

```
yhteensä_alv0 = hinta × määrä × (1 − ale%/100)
```

Hinta on **yksikköhinta** (lomake täyttää sen koko työnä kun määrä on 1). Määrän muutos kertoo vain yhteensä-lukua, ei automaattisesti materiaalikenttää.

Kate rivillä = nykyinen jäännöskate tälle riville (myyntihinta aleen jälkeen − urakka − materiaalit − palkkio), sekä € että %. Palkkio ei näy kortissa (rakenteen ominaisuus).

**Urakka / työn hinta:** lomake täyttää sen putkesta ja **yliajaa** rakenteen oletuksen, ellei kenttää ole muokattu kortilla. Ilman lomaketta arvo on rakenteen oletus tai 0 (**Ei pohjaa**).

Poisto: roskakori kortin kulmassa, vahvistus.

⚙ piilotetaan jos rakenteella ei ole yhtään lomakesivua (vain asiakassivu ilman kenttiä = ei sivuja) tai rivi on **Ei pohjaa**.

---



## 6. Lomake (alivirta)

Avaa rakenteen sivut, mukaan lukien Asiakas-sivu **jos sillä on lisäkenttiä**. Järjestelmän yhteystietoja ei näytetä. Tuotelistakenttä (`product_select`) käyttää **vain tämän rakenteen** tuotteita. Ei `MaterialsStep`-vaihetta.

**Valmis** (tai poistumisen **Tallenna**, jos lomake on täynnä): ajaa laskennan ja kirjoittaa riviin hinnan, mater. €, urakan/työn hinnan, keston, palkkion ja alennuksen jos lomakkeessa on `alennus_prosentti` (ei yliajettu). Rakenteen oletushinnat yliajetaan, jos lomake tuottaa hintapäivityksiä. **Tallenna keskeneräisenä** tallentaa kentät ilman hinnoittelua (`formFilled: false`). Paluu laskentasivulle.

Yliajo: muokattu solun lippu; lomakkeen uusinta-ajo ei ylikirjoita sitä. Mater. € yliajo **ei** tyhjennä `product_select`-arvoa `fieldValues`:ssa. Lisätiedot ovat rivin omia; lomake ei koske niihin.

---



## 7. Yhteenveto

Järjestys:

1. Asiakas (kopiointi yhteystiedoista)
2. Toimitusajankohta (jos ei tyhjä)
3. **Kokonaissumma** — materiaalit, työ, alennus (jos > 0 %), kokonaishinnat (alv0 / ALV / sis. ALV). **Yksi rivi:** työn arvioitu kesto tässä kortissa. **Useita rivejä:** kestoa ei näytetä kokonaissummassa.
4. **Erittely** — useilla riveillä jokaiselle tuoterakenteelle otsikko + sama hintakortti (kesto tälle riville) + **Lisätiedot** (jos täytetty) + **Lomaketiedot**. Yhdellä rivillä vain Lisätiedot (jos täytetty) ja Lomaketiedot (hinnat ovat jo kokonaissummassa).
  - lomakespeksit (`showOnSummary`) rivin omasta snapshotista, ml. valittu tuote vaikka mater. € olisi 0

Muokkaa → laskentasivu.

---



## 8. Mallipohjan hallinta

```
Asetukset → Tuoterakenteet
  [Ulkoverhoilun maalaus]
    Nimi, yksikkö, myyntipalkkio-%
    Lisätiedot (oletusteksti riville)
    Oletushinta alv0, oletus työn hinta alv0, oletus materiaalit alv0
    Lomake (sivut, kentät, JSON, debug) — Asiakas-sivu saa olla, ilman CustomerStep-kenttiä
```

Koti → Tuotteet: ostohinta, myyntihinta, kate; valitse miltä rakenteille tuote kuuluu (useita sallittu); kopiointi; järjestys ↑↓ (sama järjestys tuotelistakentässä, suodatettuna rakenteen mukaan).  
Koti → Asiakkaat: lista/haku (rekisterin ylläpito; muokkaus → sama päivityskysymys).

Migraatio: yksi rakenne nykyisestä lomakkeesta + tuotteista; laskelmat → yksi rivi; asiakas → rekisteri + snapshot.

---



## 9. Tietomalli

```ts
interface ProductStructure {
  id: string;
  name: string;
  unit?: string;
  form: FormDefinition;
  commissionPercent: number;
  defaultAdditionalInfo?: string;
  defaultUnitPriceVat0?: number;
  defaultContractPriceVat0?: number;
  defaultMaterialsVat0?: number;
}

interface Product {
  structureIds: string[];      // tuote voi kuulua useaan rakenteeseen
  purchasePriceVat0: number;   // ostohinta alv0
  salePriceVat0: number;       // myyntihinta alv0
  sortOrder?: number;          // Tuotteet-lista ja product_select
  // kate = myynti − osto; kate-% myyntihinnasta
}

interface CustomerRecord {
  id: string;
  name: string;
  customerType: 'private' | 'business';
  reverseVat: boolean;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  postalLocality?: string;
  notes?: string;
  updatedAt: Date;
}

interface StructureLine {
  id: string;
  structureId: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPriceVat0: number;       // Hinta
  materialsVat0: number;
  discountPercent: number;     // Ale
  vatPercent: number;
  contractPriceVat0: number;
  workDurationDays: number;
  commissionPercent: number;
  commissionEur: number;
  marginEur: number;
  marginPercent: number;
  pricesIncludeVat?: boolean;  // kortin alv0 / sis. ALV
  additionalInfo?: string;     // rivin lisätiedot (oletus rakenteesta)
  fieldValues: Record<string, string>;
  formFilled: boolean;
  formVersion?: number;
  snapshot?: FormSnapshot;     // rivin Lomaketiedot
  overrides: Array<'unitPrice' | 'materials' | 'discount' | 'quantity' | 'unit' | 'contractPrice'>;
}

interface CalculationRecord {
  customerId: string;
  customer: CustomerInfo;      // snapshot
  deliveryScheduleText: string;
  structureLines: StructureLine[];
  // aggregaatit kokonaissummakorttiin
}
```

`lineTotalVat0 = unitPriceVat0 * quantity * (1 - discountPercent/100)`.

---



## 10. Toteutusjärjestys

Vaiheet A–F on tehty sovelluksessa. PDF ei kuulu tähän dokumenttiin.


---



## 11. Rajaus


| Ei tässä versiossa               |                                                                     |
| -------------------------------- | ------------------------------------------------------------------- |
| Tarjous-PDF                      | [v1.3-suunnitelma.md](./v1.3-suunnitelma.md)                        |
| Urakkakortti-PDF                 | sama                                                              |
| Toimitusajankohdan kalenteri     | vain teksti                                                         |
| Irrallinen materiaalivaihe       | poistettu rivin lomakkeesta                                         |


---



## 12. Vahvistetut oletukset

1. **Hinta × määrä × (1 − ale)** = rivin yhteensä (alv0). Lomake täyttää Hinnan määrälle 1; määrä 2 kaksinkertaistaa yhteensä-luvun, ei materiaalikenttää.
2. **Kate** rivilistassa = sama kaava kuin yhteenvedon myyntikate tälle riville (ei ale).
3. **Ilman lomaketta** työn hinta on rakenteen oletus tai korttiin kirjoitettu arvo (**Ei pohjaa**: 0 kunnes täytetään).
4. **Yhteenveto** vaatii nimen ja vähintään yhden rivin; lomakkeet täytettyinä.
5. **Asiakas-kortti** laskentasivulla on tiivis; täysi yhteystietolomake omalla sivullaan.

---

*Päivitetty: syyskuu 2026 – toteutettu sovelluksessa; ostohinta/myyntihinta; tuote usealle rakenteelle; Yhteenveto.*