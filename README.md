# Urakkalaskuri

ColoRajatonin urakkalaskuri – **Expo/React Native** -sovellus tarjoushintojen laskentaan (Android).

Nykyinen versio on **v1.2** (`app.json` / `package.json` 1.2.0). Suunnitelma: [docs/v1.2-suunnitelma.md](docs/v1.2-suunnitelma.md).

## Ominaisuudet

- Dynaaminen wizard lomakepohjan (`FormDefinition`) sivuilla
- **Lomakeasetukset:** sivut, globaalit kentät, kenttävaikutukset, valintalistat, lasketut kentät (`Laskenta`), tuotelista (`product_select`), kaavavalidointi, kentän kopiointi, debug-laskenta
- **Ehdollinen näkyvyys:** `showWhen` (`eq` / `neq` / `gt` / …). Piilotettu kenttä on kaavoissa `0`
- **Kaavafunktiot:** `min`, `max`, `round`, `if`, `sqrt` + vertailut. Puuttuva muuttuja ja jako nollalla ovat `0`; tuotteen puuttuva työkerroin on `1`
- Tuotteet (nimi, yksikkö, yksikköhinta alv0; valinnaiset attribuutit menekki, työkerroin). Editorin `work_factor` voittaa vanhan SQLite-avaimen `tyokerroin`
- Laskenta: `calculationPipeline` (`runFormCalculation` → `resolveFormContextWithEffects` → `runProductionPipeline` → `buildResultFromFormulaContext`)
- Lomakepohjan JSON-tuonti/vienti + oletuslomakkeen palautus
- Historia (paikallinen SQLite) + `form_snapshot`; muokkaus palauttaa `fieldValues`; versionvaroitus
- Asetukset (ALV, kate 35 %, palkkio 7 %, tuntihinta 30 €/h)
- **Teema:** korostus-, pää-, teksti- ja pintaväri sekä taustakuva (URI) vaikuttavat UI:hin
- Kentän ohjeteksti näkyy wizardissa kentän alla
- Hinnat `formatCurrency`-funktiolla (tasan 2 desimaalia)
- ColoRajaton-brändi (colorajaton.fi)

Myöhemmin (ei v1.2-estettä): Esikatselu, Oletusarvot, Ulkoverhous-pohja, PDF-vienti, useita lomakepohjia. Lista: [docs/v1.2-suunnitelma.md](docs/v1.2-suunnitelma.md).

## Kehitysympäristö

### Vaatimukset

- [Node.js](https://nodejs.org/) (LTS)
- Puhelimessa **Expo Go** -sovellus (Android/iOS)

Ei tarvita Visual Studioa eikä Android Studioa kehitykseen.

### Käynnistys

```powershell
cd <projektin-kansio>
npm install
npm start
```

Skannaa terminaalissa näkyvä QR-koodi **Expo Go** -sovelluksella.

> **Expo Go -yhteensopivuus:** Projekti käyttää **Expo SDK 54**, joka vastaa Play Store -version Expo Go -sovellusta. Jos saat virheen *incompatible version*, varmista että Play Store -Expo Go on ajan tasalla – tai asenna SDK 54 -versio: `npx expo-go download android 54`.

### Testit

```powershell
npm test
```

## APK-build (tuotanto)

Asenna EAS CLI ja kirjaudu Expo-tilille:

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

Build tapahtuu pilvessä – paikallista Android SDK:ta ei tarvita.

APK: käytä profiilia **preview**. **production** tekee AAB:n Play Storeen. GitHubin uusin `main` on lähde, kun build käynnistetään Expo-sivustolta (**Build from GitHub**).

## Projektirakenne

```
app/              # Expo Router -näytöt
src/
  core/
    calculation/  # calculationPipeline.ts (tuotantolaskenta)
    form/         # Lomakepohja, kaavat, efektit, debug-putki
  components/     # UI-komponentit
  context/        # Sovelluksen tila
  theme/          # ColoRajaton-värit
docs/
  v1.2-suunnitelma.md   # Nykyinen suunnitelma
  archive/              # v1, v1.1 ja brändi-CSS-kaappaus
__tests__/        # Yksikkötestit
```

## GitHub

https://github.com/sahkoposti/urakkalaskuri

## Dokumentaatio

- [v1.2 – nykyinen](docs/v1.2-suunnitelma.md)
- [Arkisto: v1](docs/archive/v1-suunnitelma.md), [v1.1](docs/archive/v1.1-suunnitelma.md)
