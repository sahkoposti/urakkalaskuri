# Urakkalaskuri – Versio 1 suunnitelma

> **Tila:** MVP toteutettu, jatkokehitys käynnissä  
> **Brändi:** ColoRajaton / [colorajaton.fi](https://colorajaton.fi)  
> **Alusta:** Android (Expo Go / APK)  
> **Tallennus:** Paikallinen (SQLite), offline  
> **Kehys:** Expo SDK 54 (React Native) + Expo Router + TypeScript

---

## 1. Tavoite

Urakkalaskuri on puhelinsovellus, jolla urakoitsija laskee tarjoushinnan vaiheittain. Käyttäjä vastaa kysymyksiin yksi kerrallaan (wizard), valitsee tarvittaessa tuotteita materiaalikustannuksiin ja saa yhteenvedon kaikista hinnoista, kateesta ja työn kestosta.

Versio 1 on **lokaali ensin -MVP**: ei pilveä, ei kirjautumista. Arkkitehtuuri valmistellaan modulaarisuutta varten (custom-muuttujat, kaavat, teeman soveltaminen koko sovellukseen).

Sovelluksen visuaalinen tyyli noudattaa [colorajaton.fi](https://colorajaton.fi)-sivuston brändiä (ColoRajaton).

---

## 2. Sovelluksen osiot

| Osa | Kuvaus | v1 |
|-----|--------|-----|
| **Etusivu** | Navigaatio: Uusi laskenta, Historia, Tuotteet, Asetukset | Kyllä |
| **Tuotteet** | Tuotteiden hallinta (nimi, yksikkö, yksikköhinta alv0) | Kyllä |
| **Laskenta (wizard)** | Vaiheittainen syöttö + tuoterivit, kesken jääneen tallennus | Kyllä |
| **Yhteenveto** | Lasketut tulokset + tallennus | Kyllä |
| **Historia** | Aiempien laskelmien lista ja avaus | Kyllä |
| **Asetukset** | Yleinen, Laskenta, Teema (ks. luku 4.2) | Kyllä |
| Custom-muuttujat / kaavaeditori | Käyttäjän määrittelemät kentät ja vaikutukset | Ei (v1.1+, paikka valmiina) |
| Teeman soveltaminen koko UI:hin | Tallennetut värit/taustakuva käyttöön | Ei (v1.1+) |
| PDF-vienti / pilvisynkka | | Ei |

---

## 3. Visuaalinen tyyli (colorajaton.fi)

Brändi, värit ja typografia otetaan suoraan colorajaton.fi-sivuston Elementor-teemasta. Tarkat CSS-arvot: `docs/colorajaton-css-extract.txt`.

### 3.1 Brändi

| Elementti | Arvo |
|-----------|------|
| Yritys | ColoRajaton |
| Logo | PNG läpinäkyvällä taustalla (`assets/images/logo-colorajaton.png`) |
| R-ikoni | `assets/images/icon-r.png` (sovelluskuvake) |
| Yleisilme | Siisti, ammattimainen, valkoinen pohja, punainen korostus |

### 3.2 Väripaletti

| Token | Hex | Käyttö |
|-------|-----|--------|
| `primary` | `#000000` | Otsikot |
| `secondary` | `#FFFFFF` | Taustat, kortit |
| `text` | `#3C3C3C` | Leipäteksti |
| `accent` | `#C90000` | Painikkeet, korostus |
| `surface` | `#F9FAFA` | Näkymän tausta |
| `border` | `#E1E8ED` | Reunat |

Teema-asetuksissa voi tallentaa omat hex-värit (soveltaminen koko sovellukseen v1.1+).

### 3.3 Typografia

**IBM Plex Sans** (`@expo-google-fonts/ibm-plex-sans`) kaikissa näkymissä.

### 3.4 Komponentit

- **PrimaryButton** – punainen tausta, valkoinen teksti, radius 5 px  
- **OutlinedButton** – punainen reunus ja teksti  
- **AppCard** – valkoinen kortti varjolla  
- **SectionTitle** – otsikko + punainen alleviivaus  
- **ConfirmDialog** – teeman mukainen vahvistusikkuna (ei natiivi Alert laskenta-dialogeissa)

---

## 4. Näytöt

```
Etusivu
├── Uusi laskenta → Wizard → Yhteenveto
├── Historia → Laskelman tiedot (luku)
├── Tuotteet → Tuotelista → Lisää/Muokkaa tuote
└── Asetukset
    ├── Yleinen
    ├── Lomakeasetukset (v1.1, korvaa Laskenta)
    │   ├── Sivut (lomakepohjan sivut ja järjestys)
    │   ├── Kentät (kentät, valintalistat, kaavat)
    │   └── Debug (live-laskenta)
    └── Teema (logo, värit, taustakuva, himmeys)
```

### 4.1 Wizard-vaiheet (oletusjärjestys, säädettävissä)

| ID | Vaihe | Syöte | Pakollinen |
|----|-------|-------|------------|
| `customer` | Asiakas | nimi, puh, sähköposti, osoite, lisätiedot | Nimi kyllä |
| `duration` | Työryhmän arvioitu kesto | päivää (desimaali ok) | Kyllä |
| `materials` | Materiaalit – tuoterivit | tuote + määrä | Ei |
| `margin` | Myyntikatetavoite (%) | % | Kyllä (oletus asetuksista) |
| `commission` | Myyntipalkkio (%) | % | Kyllä (oletus asetuksista) |

**Huom.** Työryhmän koko ja tuntihinta tulevat **asetuksista** (Yleinen), eivät wizardista. Kesto muunnetaan tunneiksi: `päivät × työpäivän pituus`.

**Kesken jäänyt laskenta:** poistuessa kysytään tallennusta. Luonnos näkyy yläpalkin punaisessa bannerissa „Jatka laskentaa →”. Uusi laskenta poistaa luonnoksen vahvistuksella.

### 4.2 Asetukset

#### Yleinen
| Kenttä | Oletus |
|--------|--------|
| ALV (%) | 25,5 |
| Myyntikatetavoite (%) | 35 |
| Myyntipalkkio (%) | 7 |
| Tuntihinta (alv0) €/h | 30 |
| Oletustyöryhmän koko (hlö) | 2 |
| Työpäivän pituus (h) | 8 |

#### Laskenta → Järjestys *(poistettu v1.1:ssä)*

Wizard-vaiheiden järjestys hallitaan **Lomakeasetukset → Sivut** -näkymässä (`form_definition.pages`). Vanha `wizard_step_order` säilyy v1-wizardin yhteensopivuuden vuoksi, kunnes dynaaminen lomake korvaa kovakoodatun wizardin.

#### Lomakeasetukset (v1.1)

Modulaarinen lomake: sivut, kentät, valintalistojen kertoimet, kaavat.  
**→ Katso:** [v1.1-suunnitelma.md](./v1.1-suunnitelma.md)

#### Teema
| Kenttä | Kuvaus | v1 |
|--------|--------|-----|
| Logo | Esikatselu, oletus ColoRajaton | Esikatselu |
| Korostus-, pää-, teksti-, pintaväri | Hex-arvot | Tallennus |
| Taustakuvan URI | Polku/URI | Tallennus |
| Taustakuvan himmeys | 0–100 % | Tallennus |

Kuvan valinta galleriasta ja teeman soveltaminen koko sovellukseen: v1.1+.

---

## 5. Tuotteet

Tuotteen kentät: nimi, yksikkö, yksikköhinta (alv0), kuvaus (valinnainen). CRUD + materiaalirivit laskennassa.

```
rivisumma_alv0 = määrä × yksikköhinta_alv0
```

---

## 6. Laskentakaavat

### 6.1 Muuttujat

| Symboli | Merkitys | Lähde |
|---------|----------|-------|
| `t` | Työryhmän kesto (h) | wizard: päivät × työpäivän pituus |
| `n` | Työryhmän koko | asetukset |
| `h` | Tuntihinta (alv0) | asetukset |
| `U` | Urakkahinta (alv0) | `t × n × h` |
| `M` | Materiaalit (alv0) | tuoterivit |
| `k`, `p` | Kate ja palkkio (%) | wizard / oletus |
| `P` | Kokonaishinta (alv0) | `(U + M) / (1 - k - p)` |
| `a` | ALV (%) | asetukset |
| `d` | Työpäivän pituus (h) | asetukset |

**Rajoite:** k + p < 100 %.

### 6.2 Laskentajärjestys

```
1. M  ← tuoterivit
2. U = t × n × h
3. P = (U + M) / (1 - k - p)
4. myyntikate_€, myyntipalkkio_€, ALV, työkesto_pv
```

Toteutus: `src/core/calculation/calculationEngine.ts` → `runCalculation()`.

---

## 7. Tekninen arkkitehtuuri

### 7.1 Projektirakenne

```
app/                    # Expo Router -näytöt
  settings/             # Asetukset (hub + aliosiot)
  wizard/
  products/
  history/
src/
  core/
    calculation/
    database/
    models/
    wizard/
  components/
  context/
  theme/
assets/images/
docs/
```

### 7.2 Tietokanta (SQLite)

**Taulut:** `products`, `calculations`, `calculation_lines`, `settings`, `wizard_drafts`

**Settings-avaimet (valinta):**

| Avain | Kuvaus |
|-------|--------|
| `vat_percent`, `default_margin_percent`, … | Yleiset (ks. 4.2) |
| `wizard_step_order` | JSON: `WizardStepId[]` |
| `theme_accent_color`, `theme_primary_color`, … | Teema |
| `theme_background_image_uri`, `theme_background_opacity` | Taustakuva |

**wizard_drafts:** yksi rivi (`id = current`), JSON-payload kesken jääneelle laskennalle.

### 7.3 WizardStepId

```typescript
type WizardStepId = 'customer' | 'duration' | 'materials' | 'margin' | 'commission';
```

Järjestys: `settings.wizardStepOrder` (normalisoidaan `normalizeWizardStepOrder()`).

### 7.4 Modulaarisuus (v1.1+)

```
[Syötteet + tuoterivit]
        ↓
[Custom-muuttujien vaikutukset]  ← settings/calculation/variables
        ↓
[runCalculation / runPipeline]
        ↓
[Tulos]
```

---

## 8. Hyväksymiskriteerit

### Toteutettu (MVP)
- [x] ColoRajaton-teema, logo, IBM Plex Sans
- [x] Tuotteiden CRUD
- [x] Wizard 5 vaihetta, validointi, päivät → tunnit
- [x] Laskentakaavat + yksikkötestit
- [x] Yhteenveto + erittely + tallennus
- [x] Historia
- [x] Asetukset: Yleinen, Laskenta (järjestys), Teema (tallennus)
- [x] Kesken jääneen laskennan tallennus ja jatko
- [x] Expo Go (SDK 54)

### Avoinna / v1.1
- [ ] Custom-muuttujat ja kaavat
- [ ] Teeman soveltaminen koko UI:hin
- [ ] Logon ja taustakuvan valinta galleriasta
- [ ] APK (EAS Build) + Play Store
- [ ] PDF-vienti

---

## 9. Toteutusjärjestys (päivitetty)

1. ~~Expo-projekti, teema, navigaatio~~  
2. ~~SQLite, asetukset, tuotteet~~  
3. ~~Laskentamoottori + testit~~  
4. ~~Wizard + yhteenveto + historia~~  
5. ~~Luonnos, vahvistusdialogit, asetusten osiot~~  
6. Custom-muuttujat + kaavaeditori  
7. Teeman soveltaminen + kuvavalinta  
8. EAS Build (APK)

---

## 10. Rajattu pois v1:stä (v1.1+)

- Custom-kentät, muuttujat ja kaavaeditori (UI-valmius asetuksissa)
- Dynaaminen teema kaikissa näkymissä
- Logon/taustakuvan upload
- Tuoteryhmät, PDF, pilvi, iOS
- Eri ALV-kannat tuotteittain

---

*Viimeksi päivitetty: elokuu 2026 – vastaa nykyistä Expo-toteutusta.*
