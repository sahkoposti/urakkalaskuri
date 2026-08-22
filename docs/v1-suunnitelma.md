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
| **Laskenta (wizard)** | Dynaaminen lomakepohja (`FormDefinition.pages`) + tuoterivit historiasta/luonnoksesta | Kyllä |
| **Yhteenveto** | Lasketut tulokset + tallennus | Kyllä |
| **Historia** | Aiempien laskelmien lista ja avaus | Kyllä |
| **Asetukset** | Yleinen, Lomakeasetukset (v1.1), Teema | Kyllä |
| Custom-muuttujat / kaavaeditori | Käyttäjän määrittelemät kentät ja vaikutukset | v1.1 (Lomakeasetukset) |
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

### 4.1 Wizard-sivut (dynaaminen lomakepohja)

Wizard ei ole enää kiinteä 3-vaiheinen malli (asiakas → kesto → materiaalit). Sivut, otsikot ja kentät tulevat **`FormDefinition.pages`** -määrittelystä (Lomakeasetukset → Sivut).

Oletuspohja **Peruslaskenta** (`defaultFormDefinition.ts`) sisältää tyyppillisesti:

| Sivu | Sisältö |
|------|---------|
| Asiakas (`system: customer`) | nimi, yhteystiedot, asiakastyyppi |
| Käyttäjän sivut | esim. Pinta-alat (numero-, valinta- ja laskentakentät) |
| Kesto | järjestelmäkenttä `tyoryhma_kesto_pv` |

Materiaalikustannukset tulevat **järjestelmäkaavoista** (`materiaalit_alv0` ← `materiaalirivit_yhteensa` + kenttävaikutukset), ei erillisestä kiinteästä materiaalisivusta. Vanhat tuoterivit säilyvät historiassa ja luonnoksissa; uudessa laskennassa materiaalit voidaan lisätä esim. `add_material_fixed` -vaikutuksella tai lasketulla kaavalla.

**Huom.** Työryhmän koko, tuntihinta, myyntikate (%) ja myyntipalkkio (%) tulevat **Yleinen**-asetuksista. Kesto muunnetaan tunneiksi kaavalla: `tyoryhma_kesto_pv × asetukset.tyopaivan_pituus`.

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

Wizard-vaiheiden järjestys hallitaan **Lomakeasetukset → Sivut** -näkymässä (`form_definition.pages`). Vanha `wizard_step_order` säilyy tietokannassa legacy-yhteensopivuuden vuoksi; wizard käyttää `form_definition.pages`.

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

Tuotteen kentät: nimi, yksikkö, yksikköhinta (alv0), kuvaus (valinnainen). Valinnaiset **laskenta-attribuutit** (`Product.attributes`): menekki, työkerroin (ei materiaalikerrointa). CRUD + **Kopioi tuote** (`duplicateProduct`).

Kaavoissa tuotekentän attribuutit: `{key}.menekki`, `{key}.yksikkohinta`, `{key}.tyokerroin` (legacy-alias `consumption`, `unit_price`, `work_factor` toimii).

Materiaalirivit laskennassa:

```
rivisumma_alv0 = määrä × yksikköhinta_alv0
materiaalit_alv0 = materiaalirivit_yhteensa (+ kenttävaikutukset laskennan lopussa)
```

---

## 6. Laskentakaavat

Hinnat lasketaan **järjestelmäkenttien kaavoilla** (`systemFields.ts`), ei erillisellä `calculationEngine`-moduulilla. Tuotantopolku: `src/core/calculation/calculationPipeline.ts`.

| Funktio | Rooli |
|---------|-------|
| `runFormCalculation` | Wizardin/yhteenvedon pääsisäänkäynti |
| `resolveFormContextWithEffects` | Kaavat → efektit → järjestelmäkaavat uudelleen |
| `runProductionPipeline` | Syötteet + tuotteet + lomakekaavat → konteksti |
| `buildResultFromFormulaContext` | Konteksti → `CalculationResult` |

### 6.1 Muuttujat

| Symboli / avain | Merkitys | Lähde |
|-----------------|----------|-------|
| `tyoryhma_kesto_pv`, `tyoryhma_kesto_h` | Työryhmän kesto | lomake / järjestelmäkaava |
| `asetukset.tyoryhman_koko` | Työryhmän koko | Yleinen-asetukset |
| `asetukset.tuntihinta` | Tuntihinta (alv0) | Yleinen-asetukset |
| `urakka_hinta_alv0` | Urakkahinta (alv0) | `tyoryhma_kesto_h × asetukset.tyoryhman_koko × asetukset.tuntihinta` |
| `materiaalirivit_yhteensa` | Tuoterivit (alv0) | wizard-luonnos / historia |
| `materiaalit_alv0` | Materiaalit yhteensä | `materiaalirivit_yhteensa` + efektit |
| `asetukset.myyntikate_prosentti`, `asetukset.myyntipalkkio_prosentti` | Kate ja palkkio (%) | Yleinen-asetukset |
| `kokonaishinta` | Kokonaishinta (alv) | järjestelmäkaava |
| `asetukset.alv_prosentti` | ALV (%) | Yleinen-asetukset |
| `asetukset.tyopaivan_pituus` | Työpäivän pituus (h) | Yleinen-asetukset |

Legacy-alias `settings.*` toimii rinnakkain. **Rajoite:** kate + palkkio < 100 %.

### 6.2 Laskentajärjestys

```
1. Syötteet + product_select → konteksti (tuoteattribuutit)
2. Computed-kentät (topologinen järjestys)
3. Kenttävaikutukset kerätään (add_material_fixed, multiply_materials, add_duration, multiply_duration)
4. Materiaalit ja kesto päivitetään efektien jälkeen
5. Järjestelmäkaavat uudelleen lopullisilla arvoilla
6. buildResultFromFormulaContext → tulos
```

**Huom.** `add_material` on legacy-tyyppi; migraatio ohittaa sen. Hinnat näytetään `formatCurrency`-funktiolla (2 desimaalia).

---

## 7. Tekninen arkkitehtuuri

### 7.1 Projektirakenne

```
app/                    # Expo Router -näytöt
  settings/calculation/ # Lomakeasetukset
  wizard/
  products/
  history/
src/
  core/
    calculation/        # calculationPipeline.ts
    form/               # FormDefinition, kaavat, efektit
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
| `wizard_step_order` | JSON: `WizardStepId[]` (legacy) |
| `form_definition` | Aktiivinen lomakepohja (JSON) |
| `theme_accent_color`, `theme_primary_color`, … | Teema |
| `theme_background_image_uri`, `theme_background_opacity` | Taustakuva |

**wizard_drafts:** yksi rivi (`id = current`), JSON-payload kesken jääneelle laskennalle.

### 7.3 WizardStepId (legacy)

```typescript
type WizardStepId = 'customer' | 'duration' | 'materials';
```

Vanha `settings.wizardStepOrder` säilyy tietokannassa. **Wizard käyttää nyt `form_definition.pages`**, ei kiinteää step-järjestystä.

### 7.4 Modulaarisuus (v1.1)

```
[Syötteet + tuoterivit (historia/luonnos)]
        ↓
[Lomakepohjan kentät + kaavat]  ← Lomakeasetukset
        ↓
[resolveFormContextWithEffects / runFormCalculation]
        ↓
[CalculationResult + form_snapshot]
```

Katso: [v1.1-suunnitelma.md](./v1.1-suunnitelma.md)

---

## 8. Hyväksymiskriteerit

### Toteutettu (MVP + v1.1-ydin)
- [x] ColoRajaton-teema, logo, IBM Plex Sans
- [x] Tuotteiden CRUD + Kopioi tuote
- [x] Dynaaminen wizard (`FormDefinition`), validointi, kesto kaavoilla
- [x] Laskentaputki (`calculationPipeline`) + yksikkötestit
- [x] Yhteenveto + erittely + tallennus (`form_snapshot`)
- [x] Historia + muokkaus
- [x] Asetukset: Yleinen, Lomakeasetukset, Teema (tallennus)
- [x] Kesken jääneen laskennan tallennus ja jatko
- [x] Expo Go (SDK 54)
- [x] Hinnat: `formatCurrency` (2 desimaalia)

### Avoinna / v1.1 loppu
- [ ] Lomakeasetukset: Esikatselu, Oletusarvot, Ulkoverhous-pohja
- [ ] Lomakepohjan versionvaroitus muokkauksessa
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

- Custom-kentät, muuttujat ja kaavaeditori (toteutettu Lomakeasetuksissa v1.1:ssä)
- Dynaaminen teema kaikissa näkymissä
- Logon/taustakuvan upload
- Tuoteryhmät, PDF, pilvi, iOS
- Eri ALV-kannat tuotteittain

---

*Viimeksi päivitetty: elokuu 2026 – vastaa nykyistä Expo-toteutusta.*
