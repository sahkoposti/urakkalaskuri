# Liitteet (L1)

Pakettiversio yhä **v1.3.1**. Tämä kuvaa vain tietomallin. Valitsin, kuvateksti ja tulostus tulevat myöhemmin. Versio nousee 1.3.2:een vasta L4:ssä.

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
