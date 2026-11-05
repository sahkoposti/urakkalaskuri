# Liitteet (L1–L3)

Pakettiversio yhä **v1.3.1**. Valitsin ja kuvateksti tulevat myöhemmin. Kuvien pikselityö (expo-image-manipulator) tulee L4:ssä. Versio nousee 1.3.2:een vasta L4:ssä.

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

Kuvan pisin sivu pienennetään enintään 1600 pikseliin, JPEG-laatu on 0,7, eikä kuvaa suurenneta. Päätös on `imageResizePlan(leveys, korkeus)`. Oletuslataus palauttaa alkuperäisen tiedoston data-URI:na. Pienennys tehdään vasta L4:ssä injektoidussa `loadImageDataUri`-toteutuksessa.

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
