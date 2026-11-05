# Liitteet (L1–L4)

Pakettiversio **v1.3.2**. Kuvat pienennetään lisäyshetkellä (`expo-image-manipulator` 14.0.8): pisin sivu enintään 1600 px, JPEG 0,7, uusi tiedosto ilman EXIF-tietoja. Vain käsitelty tiedosto tallennetaan. PDF kopioidaan ja puretaan `prepareAttachmentPdf`-funktiolla. Raja on 20 kuvaa laskelmaa kohti, 10 Mt / 25 Mt / 50 sivua (`checkAttachmentLimits`).

Asettelu (2 kuvaa/sivu tai 1 iso kuva) tallennetaan laskelman `form_snapshot`-avaimeen `attachmentPageLayout`. Puuttuva avain on 2 kuvaa/sivu. Avain kopioituu laskelman mukana. Uutta SQL-saraketta ei ole.

Taulu `attachments`. Migraatio on `CREATE TABLE IF NOT EXISTS` (`ensureAttachmentsTable`) ja nostaa `PRAGMA user_version` arvoon 3, jos se on pienempi. Ajo kahdesti ei tyhjennä rivejä eikä laske versiota.

| Sarake | Merkitys |
|--------|----------|
| `id` | Liitteen tunniste |
| `calculation_id` | Laskelma |
| `kind` | `image` tai `pdf` |
| `destination` | `offer`, `card`, `both` tai `none`. Uuden liitteen oletus on `none` (Ei kumpaankaan) |
| `caption` | Kuvateksti, enintään 120 merkkiä. Raja tarkistetaan tietovarastossa |
| `file_rel_path` | Suhteellinen polku `Paths.document`-juuresta |
| `mime` | Tiedoston tyyppi |
| `size_bytes` | Koko tavuina |
| `width`, `height` | Kuvan mitat. PDF:llä tyhjä |
| `sort_order` | Järjestys laskelman sisällä |
| `created_at` | Luontiaika |

Indeksi: `(calculation_id, sort_order)`.

Tiedosto on `Paths.document/attachments/<calculationId>/<id>.<ext>`. Tietokannassa on vain suhteellinen polku. Käynnistyksen orpojen siivous kattaa myös tämän kansion: levyllä oleva tiedosto ilman riviä poistetaan, puuttuvaa tiedostoa vastaavaa riviä ei poisteta.

Laskelman poisto poistaa liiterivit samassa tapahtumassa ja sen jälkeen kansion. Laskelman kopio kopioi liitteet uusiksi tiedostoiksi ja tunnisteiksi. Kohde, kuvateksti ja järjestys säilyvät. Jos yhden tiedoston kopiointi epäonnistuu, laskelman kopio valmistuu silti ja epäonnistuminen palautetaan kutsujalle. `removeAllAttachments(calculationId)` poistaa kopioidut liitteet yhdellä kutsulla.

## PDF-liite tarjoukseen

Lisäyshetkellä PDF avataan ja siitä tallennetaan uusi, salaamaton kopio. Salasanaa ei säilytetä. Vain omistajan salasanalla suojattu tiedosto (tyhjä käyttäjäsalasana) aukeaa tyhjällä salasanalla. Käyttäjän salasana hylätään, eikä salasanaa kysytä.

Rajat: yksi PDF enintään 10 Mt, liitteet yhteensä enintään 25 Mt, liitesivuja yhteensä enintään 50 tarjousta kohti. Yhdistäminen liittää sivut tarjouksen perään annetussa järjestyksessä, säilyttää sivukoot eikä leimaa alatunnistetta. Tulos ei ole salattu.

| Syy | Viesti |
|-----|--------|
| Salasana | Tiedosto on suojattu salasanalla. Poista suojaus ja lisää tiedosto uudelleen. |
| Ei PDF | Tiedosto ei ole kelvollinen PDF. |
| Vioittunut | PDF-tiedosto on vioittunut. |
| Koko | Yksi PDF enintään 10 Mt, yhteensä enintään 25 Mt. |
| Sivumäärä | Enintään 50 liitesivua. |
| Yhdistäminen epäonnistuu | Liitteiden yhdistäminen epäonnistui. Tarjous voidaan jakaa ilman liitteitä. |

Jos yhdistäminen heittää, kutsuja saa virheilmoituksen eikä poikkeusta. Tarjous voidaan jakaa ilman liitteitä.

## Tulosteen Liitteet-osio

Kohde `offer` tai `both` menee tarjoukseen, `card` tai `both` korttiin. `none` ei tulostu. Järjestys on `sort_order`.

Kuvan pisin sivu pienennetään enintään 1600 pikseliin lisäyshetkellä, JPEG-laatu on 0,7, eikä kuvaa suurenneta. Päätös on `imageResizePlan(leveys, korkeus)`. Uusi JPEG-tiedosto korvaa alkuperäisen, joten EXIF ei jää mukaan. `loadImageDataUri` lukee valmiin JPEG:n sellaisenaan, kun mitat mahtuvat rajaan. Muuten se kirjoittaa kuvan uudelleen.

Kuvien arvioitu koko on tiedostokoko × 4/3. Yli 15 Mt antaa varoituksen. Kuvat otetaan silti mukaan.

PDF:ään mahtuu 20 kuvaa. Ylimääräiset jätetään pois ja varoitus palautetaan.

Asettelu on `two_per_page` (oletus) tai `one_per_page`. Osio alkaa uudelta sivulta tarjouksessa KTV-sivun jälkeen ja kortissa kortin jälkeen. Kuvateksti on `Kuva N` ja valinnainen teksti. HTML escapoidaan. PDF-liitteen nimi listataan rivillä `Liitteenä: nimi`, koska sivut liitetään yhdistämisessä tulosteen perään.

Jos kohteeseen ei ole liitteitä, tarjouksen ja kortin HTML on sama kuin ennen osiota. Osion CSS on vain osiossa, ei yhteisessä tyylissä.

Sivunumero `Sivu x/y` laskee HTML-sivut, myös kuvaliitteet. `knownTotalPages` korvaa `counter(pages)`:n kuten ennen. Yhdistetyissä PDF-sivuissa ei ole alatunnistetta.

Puuttuva kuvatiedosto ohitetaan. Puuttuva tai lukukelvoton PDF ohitetaan. Jos yhdistäminen epäonnistuu, tarjous tallennetaan ilman niitä PDF-sivuja. Tulos sisältää `warnings`. Käyttöliittymä näyttää ne valmiin dokumentin näkymässä. Tarjouksen voi jakaa.

| Tilanne | Viesti |
|---------|--------|
| Yli 20 kuvaa | Ylimääräiset jätettiin pois. Enintään 20 kuvaa. |
| Kuvien arvio yli 15 Mt | Kuvien arvioitu koko ylittää 15 Mt. |
| Kuva puuttuu | Kuvaa ei voitu lisätä: nimi. |
| PDF puuttuu | PDF-liitettä ei voitu lukea: nimi. Tarjous voidaan jakaa ilman tätä liitettä. |
| Yhdistäminen epäonnistuu | Liitteiden yhdistäminen epäonnistui. Tarjous voidaan jakaa ilman liitteitä. |

## Kirjasto tietoturvakatselmusta varten

| | |
|--|--|
| Paketti | `@cantoo/pdf-lib` |
| Versio | `2.11.1` täsmälleen, ei `^` eikä `~` |
| Lisenssi | MIT |
| Ylläpitäjät (npm) | sharcoux, ribeirofmatheus, matheusrdsantos, gabrielnsd, felipecantoo, nicodemos234 |
| Riippuvuudet | `culori`, `fflate`, `node-html-better-parser`, `tslib` |
| Jakelu | CJS (`cjs/index.js`), Jestissä ilman selainkentän muunnosta |

`npm audit --omit=dev` projektissa päättyy yhä koodiin 1: 29 olemassa olevaa Expo- ja React Native -haavoittuvuutta (1 matala, 15 keskitaso, 12 korkea, 1 kriittinen). Raportissa ei ole `@cantoo/pdf-lib`-pakettia eikä sen riippuvuuksia. Kirjaston oma esikatsaus oli 0 haavoittuvuutta.

## L4: valinta ja oikeudet

Paketit (SDK 54, `npx expo install`): `expo-image-picker` 17.0.11, `expo-document-picker` 14.0.8, `expo-image-manipulator` 14.0.8. `@cantoo/pdf-lib` pysyy 2.11.1.

`app.json` lisää pluginin `expo-image-picker`:

- `cameraPermission`: `Sovellus tarvitsee kameran liitekuvien ottamiseen.`
- `photosPermission`: `Sovellus tarvitsee kuvat liitteiden valitsemiseen.`
- `microphonePermission`: `false` (estää `RECORD_AUDIO`)

Kirjaston oma Android-manifesti (`expo-image-picker`) yhdistää silti `CAMERA`, `READ_EXTERNAL_STORAGE` ja `WRITE_EXTERNAL_STORAGE`. `READ_MEDIA_*` ei tule. `allowBackup` ei muutu (sitä ei ole `app.json`-tiedostossa). `versionCode` ei ole repossa; `eas.json` sanoo `appVersionSource: remote`.

Dokumentit-välilehdellä on osio Liitteet: kuvateksti (enintään 120), kohde (Tarjous / Urakkakortti / Molemmat / Ei kumpaankaan, oletus Ei kumpaankaan), nuolet, poisto vahvistuksella, napit Ota kuva, Valitse kuvia (monivalinta) ja Valitse tiedosto (PDF/kuva). Tarjous- ja korttilomakkeella rivi `Liitteet: N tarjoukseen, M kortille` sulkee lomakkeen ja jättää käyttäjän Dokumentit-välilehdelle. Kopioi laskelma tallentaa kopion heti; epäonnistuminen siivoaa kopioidut tiedostot. Jos liitteitä kopioitui, ilmoituksessa on kertanäpäytys Poista kopioidut liitteet.

## Laitechecklist (ei ajettu tässä PR:ssä)

- Kamera: lupa, kuva pienenee ja EXIF katoaa.
- Galleria: monivalinta, ei `READ_MEDIA_*`-lupaa.
- Tiedostovalitsin: kuva ja PDF, myös omistajasalattu PDF (tyhjä käyttäjäsalasana kelpaa, käyttäjäsalasana hylätään suomeksi).
- 20 kuvan raja ja 21. kuvan hylkäys.
- Tarjous ja urakkakortti, joissa on liitteitä; yhdistetty PDF aukeaa.
- Jako Gmailiin.
- Laskelman kopiointi ja Poista kopioidut liitteet.
- Ensimmäinen Metro-käännös: `@cantoo/pdf-lib` ja `fflate` mukana bundlessa.
- Ensimmäinen Android-ajo: pdf-lib lukee expo-printin tulosteen.
- Varmuuskopio (`allowBackup` ennallaan) ja oikeudet: `CAMERA` sekä kirjaston `READ_EXTERNAL_STORAGE` ja `WRITE_EXTERNAL_STORAGE`; ei `RECORD_AUDIO` eikä `READ_MEDIA_*`.
