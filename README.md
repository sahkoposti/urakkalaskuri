# Urakkalaskuri

ColoRajatonin urakkalaskuri – **Expo/React Native** -sovellus tarjoushintojen laskentaan (Android).

Nykyinen versio on **v1.2.4** (`app.json` / `package.json`).

| Dokumentti | Sisältö |
|------------|---------|
| [docs/sovellus.md](docs/sovellus.md) | Miten sovellus toimii (näytöt, tallennus, hinnoittelu, alennus) |
| [docs/lomakepohja-json-ohje.md](docs/lomakepohja-json-ohje.md) | Lomakepohjan JSON, kaavat, efektit |
| [docs/examples/peruslaskenta-lomakepohja.json](docs/examples/peruslaskenta-lomakepohja.json) | Esimerkkipohja |
| [docs/v1.3-suunnitelma.md](docs/v1.3-suunnitelma.md) | Seuraava: PDF-tarjous ja urakkakortti |
| [docs/archive/](docs/archive/README.md) | Vanhat suunnitelmat |

## Ominaisuudet

- Dynaaminen wizard lomakepohjan (`FormDefinition`) sivuilla
- **Laske** tallentaa laskelman heti; yhteenveto ja historia käyttävät samaa erittelysivua. Kopiointi vain asiakastiedoista. **Sulje** → historia
- Asiakas: puhelin, sähköposti, osoite, postinumero ja postitoimipaikka (Varsinais-Suomi täyttyy postinumerosta; voi kirjoittaa itse)
- Historia: muokkaus päivittää saman rivin; **Jatka laskentaa** jatkaa luonnosta ilman duplikaattia; laskelman **Poista** (roskakori, vahvistus) palaa listaan
- **Lomakeasetukset:** sivut, kentät (sivut oletuksena suljettu, avaus muistetaan), näkyvyys (`showWhen`), efektit, valintalistat, lasketut kentät, `product_select`, JSON-tuonti/vienti, debug
- **Kaavat:** `min`, `max`, `round`, `if`, `sqrt`, `liukuva_myyntihinta`, vertailut. Puuttuva muuttuja ja jako nollalla = `0`
- **Liukuva kate** asetuksissa (alaraja/yläraja € ja %)
- **Alennus %** (0–100) järjestelmäkenttänä; yhteenveto näyttää rivin vain kun alennus > 0; kate on alennuksen jälkeinen
- Työn arvioitu kesto yhteenvedossa: säävarauskerroin (oletus 1,3) ennen pyöristystä ylöspäin; hinnoittelu ilman kerrointa
- Tuotteet: nimi, yksikkö, hinta alv0, valinnaiset attribuutit (menekki, työkerroin)
- Asetukset: ALV, kate, palkkio, tuntihinta, työryhmän koko, työpäivän pituus, säävarauskerroin, teema
- Paikallinen SQLite, `form_snapshot` muokkausta varten

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
    calculation/     # putki, liukuva kate, alennus, pricingSkeleton
    customer/        # Varsinais-Suomen postinumerot
    form/            # lomakepohja, kaavat, efektit
    wizard/          # tallennus, luonnos, historia → wizard
  components/        # UI (ThemedIcon = Ionicons, CalculationDetailView)
  context/           # App-tila
  theme/
docs/
  sovellus.md
  lomakepohja-json-ohje.md
__tests__/
```

## GitHub

https://github.com/sahkoposti/urakkalaskuri
