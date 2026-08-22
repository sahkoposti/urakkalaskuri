# Urakkalaskuri – Versio 1 suunnitelma

> **Tila:** Odottaa vahvistusta  
> **Brändi:** ColoRajaton / [colorajaton.fi](https://colorajaton.fi)  
> **Alusta:** Android (APK)  
> **Tallennus:** Paikallinen (SQLite), offline  
> **Kehys:** Flutter  

---

## 1. Tavoite

Urakkalaskuri on puhelinsovellus, jolla urakoitsija laskee tarjoushinnan vaiheittain. Käyttäjä vastaa kysymyksiin yksi kerrallaan (wizard), valitsee tarvittaessa tuotteita materiaalikustannuksiin ja saa yhteenvedon kaikista hinnoista, kateesta ja työn kestosta.

Versio 1 on **lokaali ensin -MVP**: ei pilveä, ei kirjautumista, ei custom-kaavaeditoria. Arkkitehtuuri valmistellaan kuitenkin myöhempää modulaarisuutta varten (ks. luku 9).

Sovelluksen visuaalinen tyyli noudattaa [colorajaton.fi](https://colorajaton.fi)-sivuston brändiä (ColoRajaton).

---

## 2. Sovelluksen osiot

| Osa | Kuvaus | v1 |
|-----|--------|-----|
| **Etusivu** | Navigaatio: Uusi laskenta, Historia, Tuotteet, Asetukset | Kyllä |
| **Tuotteet** | Tuotteiden hallinta (nimi, yksikkö, yksikköhinta alv0) | Kyllä |
| **Laskenta (wizard)** | Vaiheittainen syöttö + tuoterivit | Kyllä |
| **Yhteenveto** | Lasketut tulokset + tallennus | Kyllä |
| **Historia** | Aiempien laskelmien lista ja avaus | Kyllä |
| **Asetukset** | ALV-%, myyntikatetavoite (35 %), myyntipalkkio (7 %), tuntihinta (30 €/h), työryhmä | Kyllä |
| Custom-kentät / kaavaeditori | Käyttäjän määrittelemät kentät ja vaikutukset | Ei (v1.1+) |
| PDF-vienti / pilvisynkka | | Ei |

---

## 3. Visuaalinen tyyli (colorajaton.fi)

Brändi, värit ja typografia otetaan suoraan colorajaton.fi-sivuston Elementor-teemasta. Tarkat CSS-arvot on poimittu sivuston tyylitiedostoista (`docs/colorajaton-css-extract.txt`).

### 3.1 Brändi

| Elementti | Arvo |
|-----------|------|
| Yritys | ColoRajaton |
| Logo | COLOR (musta) + AJATON (punainen) – käytetään sovelluksen yläpalkissa |
| Logo-tiedosto | `https://colorajaton.fi/wp-content/uploads/2023/05/logo-2-e1683805973789-1024x140.png` (kopio projektin `assets/`-kansioon toteutuksessa) |
| Yleisilme | Siisti, ammattimainen, valkoinen pohja, punainen korostus |

### 3.2 Väripaletti

| Token | Hex | Käyttö |
|-------|-----|--------|
| `primary` | `#000000` | Otsikot, pääteksti (painotettu) |
| `secondary` | `#FFFFFF` | Taustat, kortit, napin teksti |
| `text` | `#3C3C3C` | Leipäteksti, kenttien labelit |
| `accent` | `#C90000` | Pääpainikkeet, aktiivinen navigaatio, korostusviiva |
| `surface` | `#F9FAFA` | Vaihtoehtoinen osiotausta (sivuston vaalea harmaa) |
| `border` | `#E1E8ED` | Korttien reunat, erottimet |
| `navUnderline` | `#3F444B` | Navigaation alleviivaus (ei punainen) |

### 3.3 Typografia

| Elementti | Fontti | Paino | Koko (mobile) |
|-----------|--------|-------|---------------|
| Kaikki teksti | **IBM Plex Sans** (`google_fonts`-paketti) | | |
| Otsikko (H1) | IBM Plex Sans | 700 (Bold) | 24–28 sp |
| Otsikko (H2/H3) | IBM Plex Sans | 600 (SemiBold) | 18–20 sp |
| Leipäteksti | IBM Plex Sans | 400 (Regular) | 15–16 sp |
| Painike | IBM Plex Sans | 600 (SemiBold) | 16 sp |
| Pieni apu teksti | IBM Plex Sans | 400 | 13 sp |

### 3.4 Komponentit

#### Painikkeet

| Tyyppi | Tausta | Teksti | Reunus | Radius | Padding |
|--------|--------|--------|--------|--------|---------|
| **Primary** (Seuraava, Tallenna) | `#C90000` | `#FFFFFF` | ei | 5 px | 16 × 32 px |
| **Secondary** (Peruuta, Takaisin) | läpinäkyvä | `#C90000` | 1 px `#C90000` | 5 px | 16 × 32 px |
| **Teksti** (Poista) | ei | `#C90000` | ei | – | – |

#### Kortit

- Tausta: `#FFFFFF`
- Reunus: `1 px #E1E8ED` tai varjo ilman reunusta
- Varjo: `0 0 10px rgba(0, 0, 0, 0.15)`
- Hover/korostus (valinnainen): `0 0 20px rgba(0, 0, 0, 0.15)`
- Kulmasäde: **5 px** (palvelukortit), **3 px** (listakortit)

#### Otsikon korostusviiva

Sivuston tapaan otsikon alle kapea punainen viiva:

- Väri: `#C90000`
- Leveys: ~40 px
- Korkeus: 3 px
- Sijainti: keskitetty otsikon alle (wizard-kysymyksissä)

#### Syötekentät

- Tausta: `#FFFFFF`
- Reunus: `1 px #E1E8ED`, fokus: `2 px #C90000`
- Kulmasäde: 5 px
- Label: `#3C3C3C`, SemiBold

#### Navigaatio (etusivu)

- Tausta: `#FFFFFF`
- Valikon kortit/napit: valkoinen kortti varjolla, punainen ikoni tai accent-viiva
- Aktiivinen kohta: punainen alleviivaus tai vasen accent-palkki

### 3.5 Flutter-teema (toteutuksessa)

```dart
// lib/theme/app_theme.dart – luonnos
class AppColors {
  static const primary   = Color(0xFF000000);
  static const secondary = Color(0xFFFFFFFF);
  static const text      = Color(0xFF3C3C3C);
  static const accent    = Color(0xFFC90000);
  static const surface   = Color(0xFFF9FAFA);
  static const border    = Color(0xFFE1E8ED);
}

// ThemeData: Material 3, IBM Plex Sans, accentColor #C90000
// ElevatedButton: accent tausta, valkoinen teksti, borderRadius 5
// OutlinedButton: accent reunus ja teksti
```

### 3.6 Näyttökohtaiset huomiot

| Näyttö | Tyyli |
|--------|-------|
| Etusivu | Logo ylhäällä, valkoinen tausta, 4 navigaatiokorttia varjolla |
| Wizard | Yksi kysymys kerrallaan, iso otsikko + punainen viiva, primary-nappi alhaalla |
| Tuotelista | Valkoiset listakortit, punainen FAB (+) tai yläreunan Lisää-nappi |
| Yhteenveto | Kortti lasketuille arvoille, **kokonaishinta** korostettuna + erittely (urakka + materiaalit + kate + palkkio) |
| Asetukset | Yksinkertainen lomakelista, samanlainen kuin sivuston selkeät lomakkeet |

---

## 4. Näytöt

```
Etusivu
├── Uusi laskenta → Wizard → Yhteenveto
├── Historia → Laskelman tiedot (luku)
├── Tuotteet → Tuotelista → Lisää/Muokkaa tuote
└── Asetukset
```

### 4.1 Wizard-vaiheet (kiinteä järjestys v1:ssä)

| # | Vaihe | Syöte | Pakollinen |
|---|-------|-------|------------|
| 1 | Projektin nimi | teksti | Kyllä |
| 2 | Asiakas | teksti | Ei |
| 3 | Työryhmän arvioitu kesto (h) | h | Kyllä |
| 4 | Työryhmän koko | hlö | Kyllä (oletus asetuksista) |
| 5 | Materiaalit – tuoterivit | tuote + määrä | Ei (0 riviä sallittu) |
| 6 | Myyntikatetavoite (%) | % | Kyllä (oletus 35 %, asetuksista) |
| 7 | Myyntipalkkio (%) | % | Kyllä (oletus 7 %, asetuksista) |

**Huom.** Käyttäjä syöttää työryhmän arvioidun keston (tuntia). Urakkahinta lasketaan: `kesto × työryhmän koko × tuntihinta`. Tuntihinta (oletus 30 €/h) haetaan asetuksista – sitä ei kysytä wizardissa. Työryhmän keston automaattinen laskenta (tuotteet, custom-kentät) tulee v1.1+:ssa.

---

## 5. Tuotteet

### 5.1 Tuotteen kentät

| Kenttä | Tyyppi | Esimerkki |
|--------|--------|-----------|
| Nimi | teksti | Kipsilevy 13 mm |
| Yksikkö | teksti / valinta | kpl, m², m, kg, h |
| Yksikköhinta (alv0) | € | 12,50 |
| Kuvaus | teksti (valinnainen) | |

### 5.2 Toiminnot

- Lisää tuote
- Muokkaa tuotetta
- Poista tuote (varoitus jos tuote on käytössä historiassa – silti sallitaan, historiassa säilyy tallennettu hinta)

### 5.3 Tuoterivi laskennassa

```
rivisumma_alv0 = määrä × yksikköhinta_alv0
```

Tuotteen nykyinen yksikköhinta kopioidaan laskentaan tallennushetkellä (historia ei muutu tuotteen hinnan muuttuessa).

---

## 6. Laskentakaavat

### 6.1 Muuttujat ja symbolit

| Symboli | Merkitys | Lähde |
|---------|----------|-------|
| `t` | Työryhmän arvioitu kesto (h) | wizard, syöte |
| `n` | Työryhmän koko | wizard / oletus, hlö |
| `h` | Tuntihinta (alv0) | **asetukset** (oletus 30 €/h), €/h |
| `U` | Urakkahinta tekijöille (alv0) | **laskettu**, € |
| `M` | Materiaalit yhteensä (alv0) | tuoterivit, € |
| `k` | Myyntikatetavoite (%) | wizard / oletus, desimaalina (oletus 35 → 0,35) |
| `p` | Myyntipalkkio (%) | wizard / oletus, desimaalina (oletus 7 → 0,07) |
| `P` | Kokonaishinta (alv0) | **laskettu**, € |
| `a` | ALV (%) | asetukset, desimaalina (oletus 25,5) |
| `d` | Työpäivän pituus | asetukset, h/pv (oletus 8) |

### 6.2 Materiaalit

```
M = Σ (määrä_i × yksikköhinta_alv0_i)
```

Jos tuoterivejä ei ole:

```
M = 0
```

### 6.3 Urakkahinta tekijöille

```
U = t × n × h        (kun t > 0, n > 0 ja h > 0)
```

Käyttäjä arvioi työryhmän keston tunneissa. Urakkahinta on henkilötuntien arvo: kesto × työntekijöiden määrä × tuntihinta.

**Esimerkki:** kesto 40 h, työryhmä 2 hlö, tuntihinta 30 €/h → `U = 40 × 2 × 30 = 2 400 €`

### 6.4 Kokonaishinta (alv0)

Kokonaishinta koostuu neljästä osasta:

```
P = U + M + myyntikate_€ + myyntipalkkio_€
```

Myyntikate ja myyntipalkkio lasketaan **prosentteina kokonaishinnasta (alv0)**:

```
myyntikate_€ = P × k
myyntipalkkio_€ = P × p
```

Yhdistettynä:

```
P = U + M + P × k + P × p
P × (1 - k - p) = U + M
```

```
P = (U + M) / (1 - k - p)
```

**Esimerkki:** k = 35 %, p = 7 %

```
P = (U + M) / (1 - 0,35 - 0,07) = (U + M) / 0,58
```

**Rajoite:** k + p < 100 %. Jos summa ≥ 100 %, näytetään virheilmoitus.

> **Tarkistus:** `U + M + P×k + P×p = P` (summan on täsmättävä).

### 6.5 ALV ja kokonaishinta (alv)

```
ALV = P × a
```

```
kokonaishinta_alv = P + ALV
```

### 6.6 Materiaalit ALV:lla

```
materiaalit_alv = M × (1 + a)
```

(Eri ALV-kannat tuotteittain eivät kuulu v1:een.)

### 6.7 Myyntikate ja myyntipalkkio (€)

```
myyntikate_€ = P × k
```

```
myyntipalkkio_€ = P × p
```

Myyntikate (%) ja myyntipalkkio (%) vastaavat aina syötettyjä tavoitearvoja, koska ne lasketaan suoraan kokonaishinnasta.

### 6.8 Työkesto (pv)

```
työkesto_pv = t / d    (kun d > 0)
```

Työryhmän kesto (`t`) on arvioitu työtuntien määrä koko ryhmälle. Kalenteripäivät = kesto jaettuna työpäivän pituudella.

**Pyöristys:** näytetään 1 desimaali (esim. 40,0 h, 5,0 pv).

### 6.9 Kaavojen laskentajärjestys

```
1. M                    ← tuoterivit
2. U = t × n × h        ← urakkahinta
3. P = (U + M) / (1 - k - p)   ← kokonaishinta alv0
4. myyntikate_€, myyntipalkkio_€ ← P × k, P × p
5. ALV, kokonaishinta_alv
6. materiaalit_alv
7. työkesto_pv
```

---

## 7. Laskentoesimerkki

### Syötteet

| Kenttä | Arvo |
|--------|------|
| Työryhmän arvioitu kesto | 40 h |
| Työryhmän koko | 2 hlö |
| Tuntihinta (asetuksista) | 30 €/h |
| Tuote: Kipsilevy, 20 kpl × 12,50 € | |
| Myyntikatetavoite | 35 % |
| Myyntipalkkio | 7 % |
| ALV | 25,5 % |
| Työpäivän pituus | 8 h |

### Laskenta

```
U = 40 × 2 × 30 = 2400 €

M = 20 × 12,50 = 250 €

P = (2400 + 250) / (1 - 0,35 - 0,07) = 2650 / 0,58 = 4568,97 €

myyntikate_€ = 4568,97 × 0,35 = 1599,14 €
myyntipalkkio_€ = 4568,97 × 0,07 = 319,83 €

Tarkistus: 2400 + 250 + 1599,14 + 319,83 = 4568,97 € ✓

ALV = 4568,97 × 0,255 = 1165,09 €
kokonaishinta_alv = 4568,97 + 1165,09 = 5734,06 €

materiaalit_alv = 250 × 1,255 = 313,75 €

työkesto_pv = 40 / 8 = 5,0 pv
```

**Huom.** Kokonaishinta esitetään yhteenvedossa eriteltynä: urakka + materiaalit + myyntikate + myyntipalkkio = kokonaishinta (alv0).

---

## 8. Yhteenvetonäkymän kentät

| # | Kenttä | Tyyppi |
|---|--------|--------|
| 1 | Työryhmän arvioitu kesto (h) | syöte |
| 2 | Työryhmän koko (hlö) | syöte |
| 3 | Urakkahinta tekijöille (alv0) | laskettu |
| 4 | Materiaalit (alv0) | laskettu |
| 5 | Myyntikate (€) | laskettu |
| 6 | Myyntikate (%) | syöte (tavoite) |
| 7 | Myyntipalkkio (€) | laskettu |
| 8 | Myyntipalkkio (%) | syöte (tavoite) |
| 9 | **Kokonaishinta (alv0)** | laskettu |
| 10 | ALV | laskettu |
| 11 | Kokonaishinta (alv) | laskettu |
| 12 | Työkesto (pv) | laskettu |

Yhteenvedossa näytetään myös kokonaishinnan erittely:

```
Kokonaishinta (alv0) = urakkahinta + materiaalit + myyntikate + myyntipalkkio
```

---

## 9. Tekninen arkkitehtuuri (v1 + valmistelu jatkoa varten)

### 9.1 Laskentaputki

Laskenta toteutetaan funktiona `runPipeline(context)`, joka v1:ssä ajaa kiinteät kaavat. Myöhemmin samaan putkeen lisätään custom-kenttien vaikutukset ennen hintalaskentaa.

```
[Syötteet: t (kesto), n (työryhmä), tuoterivit → M, h/k/p (asetuksista + wizard)]
        ↓
[U = t × n × h]
        ↓
[Custom-kenttien vaikutukset]  ← tyhjä v1:ssä
        ↓
[P = (U+M)/(1-k-p), myyntikate, palkkio, ALV, työkesto]
        ↓
[Tulos]
```

### 9.2 Tietokanta (SQLite)

```sql
products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL,
  unit_price_vat0 REAL NOT NULL,
  description   TEXT,
  created_at    INTEGER NOT NULL
)

calculations (
  id            TEXT PRIMARY KEY,
  project_name  TEXT,
  customer      TEXT,
  group_duration_h REAL NOT NULL,       -- syöte (t): työryhmän arvioitu kesto
  contract_price_vat0 REAL NOT NULL,    -- laskettu (U = t × n × h)
  margin_percent REAL NOT NULL,         -- myyntikatetavoite (k)
  commission_percent REAL NOT NULL,
  crew_size     INTEGER NOT NULL,
  hourly_rate   REAL NOT NULL,          -- asetuksista tallennushetkellä
  materials_vat0 REAL NOT NULL,
  total_price_vat0 REAL NOT NULL,       -- kokonaishinta (P)
  vat_amount    REAL NOT NULL,
  total_price_vat REAL NOT NULL,
  margin_eur    REAL NOT NULL,
  commission_eur REAL NOT NULL,
  work_duration_days REAL NOT NULL,
  created_at    INTEGER NOT NULL
)

calculation_lines (
  id            TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL REFERENCES calculations(id),
  product_id    TEXT,
  product_name  TEXT NOT NULL,
  unit          TEXT NOT NULL,
  unit_price_vat0 REAL NOT NULL,
  quantity      REAL NOT NULL,
  line_total_vat0 REAL NOT NULL
)

settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
)
```

### 9.3 Oletusasetukset

| Avain | Oletusarvo |
|-------|------------|
| `vat_percent` | 25.5 |
| `default_margin_percent` | 35 |
| `default_commission_percent` | 7 |
| `default_hourly_rate` | 30 |
| `default_crew_size` | 2 |
| `workday_hours` | 8 |

---

## 10. Hyväksymiskriteerit (v1 valmis kun)

- [ ] Visuaalinen tyyli vastaa colorajaton.fi-brändiä (`#C90000`, IBM Plex Sans, kortit, painikkeet)
- [ ] Tuotteen CRUD toimii (lisää, muokkaa, poista, listaa)
- [ ] Uusi laskenta wizardilla: kaikki vaiheet ja validointi
- [ ] Tuoterivit laskennassa: valinta, määrä, rivisumma
- [ ] Kaikki laskentakaavat (luku 6) tuottavat oikeat tulokset
- [ ] Urakkahinta lasketaan oikein: `U = kesto × työryhmän koko × tuntihinta`
- [ ] Kokonaishinta lasketaan oikein: `P = urakka + materiaalit + myyntikate + myyntipalkkio`
- [ ] Myyntikate + myyntipalkkio -rajoite (yhteensä < 100 %) estää virheellisen syötteen
- [ ] Yhteenveto näyttää kaikki 12 kenttää ja hinnan erittelyn
- [ ] Laskelma tallentuu ja näkyy historiassa
- [ ] Historiasta voi avata laskelman tiedot
- [ ] Asetukset tallentuvat ja vaikuttavat oletusarvoihin
- [ ] Sovellus toimii offline
- [ ] APK asentuu Android-puhelimeen

---

## 11. Toteutusjärjestys

1. Flutter-projekti, **ColoRajaton-teema** (luku 3), navigaatio
2. SQLite-skeema ja asetukset
3. Tuotteet-osio (CRUD)
4. Laskentamoottori (`runPipeline`) + yksikkötestit esimerkkiluvulla 7
5. Wizard + tuoterivit
6. Yhteenveto + tallennus
7. Historia
8. APK-build ja manuaalinen testaus

**Arvio:** 2–4 viikkoa.

---

## 12. Rajattu pois v1:stä (v1.1+)

- Custom-kentät ja kaavaeditori
- Kentän vaikutus: työryhmän kesto / materiaalit (kerroin tai lisä)
- Työryhmän keston automaattinen laskenta (tuotteet, custom-kentät)
- Tuoteryhmät ja haku
- PDF / Excel-vienti
- Pilvisynkka ja varmuuskopiointi
- iOS
- Eri ALV-kannat tuotteittain

---

*Dokumentti luotu vahvistusta varten. Muutokset tehdään ennen toteutusta.*
