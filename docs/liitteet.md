# Liitteet (L1–L4)

Nykyinen versio on **1.3.4**. Liitteiden toiminta on sama kuin 1.3.3:ssa: tarjouksen ja urakkakortin PDF, liitteen valinta yhdellä **Lisää liite** -painikkeella (kamera, galleria tai tiedosto), kuvankäsittely ja asettelu. Tarjouksen sivujako on taiton laskentaa, ei ajon aikana mitattu korkeus eikä laitteella varmistettu: kaksi kuvaa sivulla, kun kuvan enimmäiskorkeus ja pisin kuvateksti (merkki em-levyisenä, fontti +1 pt) mahtuvat kahdesti käytettävään korkeuteen; muuten yksi kuva sivulla. Yli kolmen rivin kuvateksti pakottaa yhden kuvan sivulle. Urakkakortissa on neljä pientä kuvaa sivulla. Asettelun valintaa ei näytetä. Vanha `attachmentPageLayout` ei kaada tulostetta: tarjous päättää asettelun itse. Kuvat pienennetään lisäyshetkellä (`expo-image-manipulator` 14.0.8): pisin sivu enintään 1600 px, JPEG 0,7, uusi tiedosto ilman EXIF-tietoja. Vain käsitelty tiedosto tallennetaan. PDF kopioidaan ja puretaan `prepareAttachmentPdf`-funktiolla. Raja on 20 kuvaa laskelmaa kohti, 10 Mt / tiedosto, 25 Mt yhteensä ja 50 sivua (`checkAttachmentLimits`). Yli 15 Mt:n kuvakokonaisuus varoittaa, mutta kuvat otetaan mukaan.

Vanha avain `form_snapshot.attachmentPageLayout` saa jäädä laskelmalle. Tuloste ei lue sitä. Uutta SQL-saraketta ei ole.

Taulu `attachments`. Migraatio on `CREATE TABLE IF NOT EXISTS` (`ensureAttachmentsTable`) ja nostaa `PRAGMA user_version` arvoon 3, jos se on pienempi. Ajo kahdesti ei tyhjennä rivejä eikä laske versiota.

| Sarake | Merkitys |
|--------|----------|
| `id` | Liitteen tunniste |
| `calculation_id` | Laskelma |
| `kind` | `image` tai `pdf` |
| `destination` | `offer`, `card`, `both` tai `none`. Uuden liitteen oletus on `card` (urakkakortti). Vanha `none` säilyy. |
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

Tarjouksen `two_per_page` tai `one_per_page` päätetään liitesetin kuvateksteistä. Päätös on laskettu sääntö (`offerAttachmentLayoutForCaptions`): kuvateksti rivitetään tarjouksen tekstileveydelle niin, että jokainen merkki on em-levyinen caption-pistekoossa (+1 pt). Yli kolmen rivin kuvateksti tai kahden blokkikorkeuden ylitys (kuvan 72 mm + kuvateksti + otsikko + 6 mm taiton väli + 8 mm varmuus, käytettävissä 223 mm) antaa yhden kuvan sivulle. Lyhyt kuvateksti antaa kaksi. Tätä ei ole mitattu ajonaikaisesti eikä tarkistettu oikealla laitteella. Urakkakortti ei lue valintaa: kortin Liitteet on 2×2-ruudukko, neljä kuvaa sivulla (kuva enintään 86 mm, kuvateksti enintään kaksi riviä ja ylimääräinen katkaistaan). Osio alkaa uudelta sivulta tarjouksessa KTV-sivun jälkeen ja kortissa kortin jälkeen. Tarjouksen yhden kuvan enimmäiskorkeus on 175 mm. Kuva ei katkea sivujen väliin (`break-inside: avoid`). Kuvateksti on `Kuva N` ja valinnainen teksti. HTML escapoidaan. PDF-liitteen nimi listataan rivillä `Liitteenä: nimi`, koska sivut liitetään yhdistämisessä tulosteen perään.

Jokaisen tulosteen vasen ja oikea reuna on 3 mm aiempaa leveämpi (`PDF_HORIZONTAL_MARGIN_EXTRA_MM`). Kortin sivumarginaali on 17 mm (oli 14 mm). Tarjouksen tekstisisennys on 21 mm paperin reunasta (oli 18 mm); vasen palkki pysyy 2,5 mm.

Rakenteen oma lisäteksti (`offer_settings:<id>.additionalInfoText`) tulostuu kortin rakenteen osioon otsikolla Muuta, kuten tarjouksessa. Yrityksen Lisätiedot-ehtoja ei tulosteta kortille.

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
- Tiedostovalitsin: kuva ja PDF, myös omistajasalattu PDF (tyhjä käyttäjäsalasana kelpaa). Käyttäjän salasana hylätään viestillä `Tiedosto on suojattu salasanalla. Poista suojaus ja lisää tiedosto uudelleen.`
- Rajat: 10 Mt / tiedosto, 25 Mt yhteensä, 50 sivua. Yli 15 Mt:n kuvakokonaisuus varoittaa. 20 kuvan katto ja 21. kuvan hylkäys.
- Tarjouksen asettelun vaihto: 2 kuvaa/sivu tai 1 iso kuva. Yksi iso kuva sivulla on hyväksytty, eikä kahta pakoteta.
- Urakkakortti: neljä pientä kuvaa sivulla (keskimäärin 3–4). Laitteella 4 kuvaa mahtuu yhdelle liitesivulle, 5 kahdelle, myös pitkällä kuvatekstillä.
- Marginaalit: kortin vasen ja oikea 17 mm, tarjouksen tekstisisennys 21 mm. Teksti ei osu palkkiin eikä reunaan.
- Varapolku: puuttuva tiedosto tai epäonnistunut yhdistäminen tuottaa silti tarjouksen. Valmis-näkymässä on suomenkielinen varoitus, ja tarjouksen voi jakaa.
- Asetteluavain `form_snapshot.attachmentPageLayout` säilyy laskelman kopiossa.
- Sovellusversio näyttää 1.3.4.
- Tarjous ja urakkakortti, joissa on liitteitä; yhdistetty PDF aukeaa.
- Jako Gmailiin.
- Laskelman kopiointi ja Poista kopioidut liitteet.
- Ensimmäinen Metro-käännös: `@cantoo/pdf-lib` ja `fflate` mukana bundlessa.
- Ensimmäinen Android-ajo: pdf-lib lukee expo-printin tulosteen.
- Varmuuskopio (`allowBackup` ennallaan) ja oikeudet: `CAMERA` sekä kirjaston `READ_EXTERNAL_STORAGE` ja `WRITE_EXTERNAL_STORAGE`; ei `RECORD_AUDIO` eikä `READ_MEDIA_*`.
