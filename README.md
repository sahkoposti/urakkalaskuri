# Urakkalaskuri

ColoRajatonin urakkalaskuri – Flutter/Android-sovellus tarjoushintojen laskentaan.

## Ominaisuudet (v1)

- Wizard-pohjainen laskenta vaiheittain
- Tuotteet (materiaalit, yksikköhinta alv0)
- Laskentakaavat: urakka = kesto × työryhmä × tuntihinta, kokonaishinta = urakka + materiaalit + kate + palkkio
- Historia (paikallinen SQLite)
- Asetukset (ALV, kate 35 %, palkkio 7 %, tuntihinta 30 €/h)
- ColoRajaton-brändi (colorajaton.fi)

## GitHub-repositorio

Projekti on valmis pushattavaksi GitHubiin. **Kerran kirjauduttuasi** GitHub CLI:hin:

```powershell
gh auth login
gh repo create urakkalaskuri --public --source=. --remote=origin --push
```

Jos repo on jo olemassa omalla tililläsi:

```powershell
git remote add origin https://github.com/KAYTTAJA/urakkalaskuri.git
git push -u origin main
```

Tämän jälkeen voit jatkaa projektia **Cursor Cloud Agentissa** kloonaamalla saman GitHub-repon.

## Kehitysympäristö

### Paikallinen kehitys

1. Asenna [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable)
2. Asenna Android SDK / Android Studio (APK-buildiin)
3. Kloonaa repo ja asenna riippuvuudet:

```bash
git clone https://github.com/YOUR_USER/urakkalaskuri.git
cd urakkalaskuri
flutter pub get
flutter test
flutter run
```

### Pilvessä (Cursor Cloud Agent)

Projekti on suunniteltu pilvikehitykseen:

- Kaikki lähdekoodi versionhallinnassa GitHubissa
- `flutter pub get` + `flutter test` toimivat ilman fyysistä laitetta
- APK-build vaatii Android SDK:n (CI tai paikallinen build)

**Cursor Cloud Agent -käyttö:**

1. Avaa repo Cursorissa (Clone from GitHub)
2. Käynnistä Cloud Agent samassa repossa
3. Agent voi jatkaa kehitystä, ajaa testejä ja tehdä committeja

## APK-build

```bash
flutter build apk --release
```

Tuotos: `build/app/outputs/flutter-apk/app-release.apk`

## Projektirakenne

```
lib/
  core/           # Laskenta, tietokanta, mallit
  features/       # Näytöt (home, wizard, products, history, settings)
  theme/          # ColoRajaton-teema
  app/            # Reititys
docs/             # v1-suunnitelma ja brändi
test/             # Yksikkötestit
```

## Suunnitelma

Katso [docs/v1-suunnitelma.md](docs/v1-suunnitelma.md).
