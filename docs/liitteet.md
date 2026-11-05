# Liitteet (L1–L2)

Pakettiversio yhä **v1.3.1**. Valitsin ja kuvateksti tulevat myöhemmin. PDF-liitteen yhdistämistä tarjoukseen ei ole vielä kytketty tulostukseen. Versio nousee 1.3.2:een vasta L4:ssä.

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
