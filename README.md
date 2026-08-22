# Urakkalaskuri

ColoRajatonin urakkalaskuri – **Expo/React Native** -sovellus tarjoushintojen laskentaan (Android).

## Ominaisuudet (v1)

- Wizard-pohjainen laskenta vaiheittain
- Tuotteet (materiaalit, yksikköhinta alv0)
- Laskentakaavat: urakka = kesto × työryhmä × tuntihinta, kokonaishinta = urakka + materiaalit + kate + palkkio
- Historia (paikallinen SQLite)
- Asetukset (ALV, kate 35 %, palkkio 7 %, tuntihinta 30 €/h)
- ColoRajaton-brändi (colorajaton.fi)

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

## Projektirakenne

```
app/              # Expo Router -näytöt
src/
  core/           # Laskenta, tietokanta, mallit
  components/     # UI-komponentit
  context/        # Sovelluksen tila
  theme/          # ColoRajaton-värit
docs/             # v1-suunnitelma ja brändi
__tests__/        # Yksikkötestit
```

## GitHub

https://github.com/sahkoposti/urakkalaskuri

## Suunnitelma

Katso [docs/v1-suunnitelma.md](docs/v1-suunnitelma.md).
