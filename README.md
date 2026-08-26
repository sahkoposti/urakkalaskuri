# Urakkalaskuri

ColoRajatonin urakkalaskuri – **Expo/React Native** -sovellus tarjoushintojen laskentaan (Android).

## Ominaisuudet (v1)

- Dynaaminen wizard lomakepohjan (`FormDefinition`) sivuilla – ei kiinteää 3-vaiheista mallia
- Tuotteet (nimi, yksikkö, yksikköhinta alv0; valinnaiset attribuutit menekki, työkerroin)
- Laskenta järjestelmäkaavoilla: `calculationPipeline` (`runFormCalculation` → `resolveFormContextWithEffects` → `runProductionPipeline` → `buildResultFromFormulaContext`)
- Historia (paikallinen SQLite) + `form_snapshot` tallennetuissa laskelmissa
- Asetukset (ALV, kate 35 %, palkkio 7 %, tuntihinta 30 €/h)
- Hinnat näytetään `formatCurrency`-funktiolla (tasan 2 desimaalia)
- ColoRajaton-brändi (colorajaton.fi)

## v1.1 (Phase B pääosin valmis)

- **Lomakeasetukset:** sivut, globaalit kentät, kenttävaikutusten editori, valintalistat, lasketut kentät (`Laskenta`), tuotelista (`product_select`), kaavavalidointi, kentän kopiointi, debug-laskenta
- **Järjestelmäkentät:** kesto, hinnat, ALV – suomenkielisillä kaavoilla (`asetukset.*`), palautettavissa oletukseen
- **Tuotteet:** „Kopioi tuote”, kaavamuuttujat `menekki`, `yksikkohinta`, `tyokerroin`
- **Puuttuu vielä:** Lomakeasetukset → Esikatselu, Oletusarvot, Ulkoverhous-pohja
- Katso [docs/v1.1-suunnitelma.md](docs/v1.1-suunnitelma.md)

## v1.2 (käynnissä)

- **Ehdollinen kenttänäkyvyys:** `showWhen` (boolean/select/number, `eq`/`neq`/`gt`/…). Piilotettu numerokenttä on kaavoissa `0`.
- **Kaavafunktiot:** `min`, `max`, `round`, `if` + vertailuoperaattorit
- **Lomakepohja:** JSON-tuonti/vienti (kiinteä tuontikenttä) + oletuslomakkeen palautus
- **Muokkaus:** tallennetun laskelman `fieldValues` palautuu wizardiin; versionvaroitus
- **Kentät:** sijoitus sivulle luonnissa (myös Asiakas); uusi/kopio tallentuu vasta Tallenna
- **Laskentakenttä:** muokattava numero lomakkeella, live-päivitys kun kaavan syötteet muuttuvat
- Katso [docs/v1.2-suunnitelma.md](docs/v1.2-suunnitelma.md)

## Kehitysympäristö

### Vaatimukset

- [Node.js](https://nodejs.org/) (LTS)
- Puhelimessa **Expo Go** -sovellus (Android/iOS)

Ei tarvita Visual Studioa eikä Android Studioa kehitykseen.

### Käynnistys

```powershell
cd C:\Users\eemil\.cursor\projects\Urakkalaskuri
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
docs/             # Suunnitelmat (v1, v1.1, v1.2) ja brändi
__tests__/        # Yksikkötestit
```

## GitHub

https://github.com/sahkoposti/urakkalaskuri

## Suunnitelma

- [v1](docs/v1-suunnitelma.md)
- [v1.1 – modulaarinen lomake](docs/v1.1-suunnitelma.md) *(Phase B pääosin valmis)*
- [v1.2 – ehdollinen näkyvyys ym.](docs/v1.2-suunnitelma.md) *(aloitettu)*
