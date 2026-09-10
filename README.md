# Urakkalaskuri

ColoRajatonin urakkalaskuri – **Expo/React Native** -sovellus tarjoushintojen laskentaan (Android).

Pakettiversio **v1.2.4** (`app.json` / `package.json`). Laskelma = asiakas + toimitusajankohta + matka-aika + tuoterakennerivit.

| Dokumentti | Sisältö |
|------------|---------|
| [docs/sovellus.md](docs/sovellus.md) | Miten sovellus toimii nyt |
| [docs/tuoterakenteet.md](docs/tuoterakenteet.md) | Tuoterakenteiden malli (toteutettu) |
| [docs/lomakepohja-json-ohje.md](docs/lomakepohja-json-ohje.md) | Lomakepohjan JSON, kaavat, efektit |
| [docs/yhtenaisyystarkistus.md](docs/yhtenaisyystarkistus.md) | Katselmus 9.9.2026: kaksoisarkkitehtuuri ja siivousehdotukset |
| [docs/examples/peruslaskenta-lomakepohja.json](docs/examples/peruslaskenta-lomakepohja.json) | Esimerkkipohja |
| [docs/v1.3-suunnitelma.md](docs/v1.3-suunnitelma.md) | Seuraava: PDF-tarjous ja urakkakortti |
| [docs/v1.2-suunnitelma.md](docs/v1.2-suunnitelma.md) | Historiallinen v1.2 (yksi globaali wizard) |
| [docs/archive/](docs/archive/README.md) | Vanhat suunnitelmat |

## Ominaisuudet

- Laskentasivu: asiakas, toimitusajankohta, tuoterakennerivit. **Yhteenveto** tallentaa laskelman
- Rivin lomake tuoterakenteen sivujen mukaan; keskeneräinen tallennus; Valmis laskee rivin hinnat
- Asiakasrekisteri (haku nimellä, päivityskysymys vanhoille laskelmille)
- Historia: muokkaus päivittää saman rivin; **Jatka laskentaa** jatkaa luonnosta ilman duplikaattia
- Yhteenveto: kokonaissumma + jokaisen tuoterakenteen erittely ja lomaketiedot
- **Tuoterakenteet:** oma lomake, myyntipalkkio-%; JSON-tuonti/vienti rakenteen lomakeasetuksista
- **Kaavat:** `min`, `max`, `round`, `if`, `sqrt`, `liukuva_myyntihinta`. Puuttuva muuttuja ja jako nollalla = `0`
- **Liukuva kate** (alaraja/yläraja € ja %)
- **Alennus %** rivillä ja lomakkeella; kate on alennuksen jälkeinen
- Työn arvioitu kesto yhteenvedossa: säävarauskerroin (oletus 1,3) ennen pyöristystä ylöspäin
- Tuotteet: ostohinta, myyntihinta, kate, menekki, työkerroin; tuote voi kuulua useaan rakenteeseen; järjestys ↑↓ (sama tuotelistakentässä)
- Asetukset: ALV, kate, palkkio, tuntihinta, työryhmä, työpäivä, säävaraus, teema
- Paikallinen SQLite

## Kehitysympäristö

### Vaatimukset

- [Node.js](https://nodejs.org/) (LTS)
- Puhelimessa **Expo Go** (Android/iOS)

### Käynnistys

```powershell
cd <projektin-kansio>
npm install
npm start
```

Skannaa QR-koodi **Expo Go** -sovelluksella. SDK **54**.

### Testit

```powershell
npm test
```

PowerShellissä älä ketjuta komentoja `&&`-operaattorilla.

## APK-build

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

**preview** = APK, **production** = AAB. GitHubin `main` on lähde, kun build käynnistetään Expo-sivustolta.

## Projektirakenne

```
app/                 # Expo Router -näytöt
src/
  core/
    calculation/     # putki, liukuva kate, alennus
    customer/        # rekisteri, postinumerot
    database/        # paikallinen SQLite
    form/            # lomakepohja, kaavat, efektit
    models/          # jaetut tyypit
    product/         # attribuutit, rakenteet, ostohinta/myyntihinta
    structure/       # rivin hinnoittelu, lomake → rivi
    utils/
    wizard/          # luonnos, composer → CalculationRecord
  components/
  context/           # App-tila (vie myös db-olion)
  hooks/
  theme/
docs/
__tests__/
```

## GitHub

https://github.com/sahkoposti/urakkalaskuri
