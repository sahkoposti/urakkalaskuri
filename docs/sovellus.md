# Urakkalaskuri – sovelluksen kuvaus

ColoRajatonin tarjouslaskuri (Expo / React Native, Android). Nykyinen versio **v1.2.3**.

Tämä sivu kuvaa **miten sovellus toimii nyt**. JSON-kentät ja kaavat: [lomakepohja-json-ohje.md](./lomakepohja-json-ohje.md). Kehitysympäristö: [README.md](../README.md).

---

## Näytöt

| Polku | Mitä se tekee |
|-------|----------------|
| Koti | Uusi laskenta, historia, tuotteet, asetukset |
| Wizard | Lomakepohjan sivut järjestyksessä. Viimeinen sivu: **Laske** |
| Laskelman tiedot | Yhteinen näkymä wizardin jälkeen ja historiasta. Roskakori nimen vieressä poistaa laskelman (vahvistus). **Sulje** → historia |
| Historia | Tallennetut laskelmat. Avaa laskelma nähdäksesi tiedot tai poistaaksesi sen |
| Tuotteet | Materiaalit (nimi, yksikkö, hinta alv0, valinnaiset attribuutit) |
| Asetukset | Yleinen (ALV, liukuva kate, palkkio, tuntihinta, työryhmä, työpäivä), teema, lomake |

Kesken jäänyt uusi laskenta: punainen palkki **Jatka laskentaa**. **Uusi laskenta** kysyy vahvistuksen, jos luonnos on olemassa (luonnos ja istunto tyhjennetään).

---

## Laskenta ja tallennus

**Laske** tallentaa SQLite-laskelman heti ja avaa yhteisen erittelysivun.

| Miten avattiin | Tallennus |
|----------------|-----------|
| Uusi laskenta | Uusi rivi (`createId`) |
| Historia → **Muokkaa** | Sama `id`, alkuperäinen `createdAt` säilyy |
| **Jatka laskentaa** kesken jääneestä muokkauksesta | Sama `id` kuin muokattavalla rivillä |
| **Jatka laskentaa** uudesta luonnoksesta | Uusi rivi ensimmäisellä Laske-kerralla |

Luonnos (`wizard_drafts`) sisältää tarvittaessa `editCalculationId`. Historia-muokkaus kirjoittaa luonnosta, jotta **Jatka laskentaa** ei luo toista riviä. Toinen **Laske** päivittää saman rivin (`INSERT OR REPLACE`).

**Sulje** erittelyssä tyhjentää wizard-istunnon ja vie historiaan.

**Poista** (roskakorikuvake asiakkaan nimen rivillä oikealla) kysyy vahvistuksen ja poistaa laskelman sekä sen materiaalirivit. Onnistunut poisto palaa historialistaan. Jos sama laskelma oli muokattavana, wizard-istunto ja luonnos tyhjennetään.

---

## Hinnoittelun erittely

Yhteinen kortti (wizard + historia):

1. Työn kesto (pv) – näytössä **tasapäiviin ylöspäin** (1,1 → 2). Laskenta käyttää tarkkaa arvoa.
2. Urakkahinta (alv0), materiaalit (alv0)
3. Myyntikate € ja % – **toteutunut** kate (jos alennus, jo alennuksen jälkeen)
4. Myyntipalkkio
5. Jos alennus > 0 %: hinta ennen alennusta + alennusrivi
6. Kokonaishinnat (alv0 / ALV / alv). Yksityinen: korostus sis. ALV. Yritys: korostus alv0; käänteinen ALV tarvittaessa.

Lomaketiedot-osio tulee tallennetusta `formSnapshot`:sta.

---

## Alennus

Järjestelmäkenttä `alennus_prosentti` (0–100 %). Oletuslomakkeella kestosivulla.

- Kaavat laskevat ensin listahinnan.
- Sovellus vähentää alennuksen myyntihinnasta; kate on jäännös kustannusten ja palkkion jälkeen.
- **Älä** kerro alennusta `kokonaishinta` / `liukuva_myyntihinta`-kaavaan – se tehtäisiin kahdesti.
- JSON: lisää sivulle `"field_system_alennus_prosentti"`.

---

## Liukuva kate

Asetukset → Yleinen: alaraja € / kate %, yläraja € / kate %.

Kaava: `liukuva_myyntihinta(suorat_kustannukset_alv0)` → myyntihinta alv0. Muuttujat: `asetukset.myyntikate_alaraja_eur`, `_prosentti`, `ylaraja_eur`, `_prosentti`, plus palkkio.

---

## Lomake

- **Sivut** = wizard-vaiheet. Kentät ovat globaaleja; sivu viittaa `fieldIds`.
- **Asiakassivu** (`system: "customer"`) ei voi poistaa.
- **Materiaalirivit** (`system: "materials"`) ovat valinnaisia. Oletuspohjassa ei ole rivi-sivua; maalit voidaan laskea kentillä + `add_material_fixed`.
- Järjestelmäkentät (kesto, hinnat, alennus) lisätään tuonnissa automaattisesti. Piilotetut (kate, palkkio, ALV, alennus €) eivät näy Kentät-listassa.
- Pohjan `version` kasvaa tallennettaessa. Vanhaa laskelmaa muokatessa näytetään varoitus, jos versio eroaa.
- **Kentät**-asetuksissa jokainen sivu (esim. Asiakas) on oletuksena suljettu. Otsikko ja nuoli ovat samalla rivillä; nuolta painamalla sivun kentät avautuvat. Sovellus muistaa, mitkä sivut olivat auki (`settings`-avain `fields_page_expanded`).
- Lasketun kentän manuaalinen arvo wizardissa: teemavärinen reset-nuoli palauttaa kaavan tuloksen.

---

## Tietokanta (paikallinen SQLite)

- `calculations` + `calculation_lines`
- `products` (attribuutit JSON:ssa, esim. menekki, työkerroin)
- `settings` (avain–arvo; lomakepohja avaimessa `form_definition`, Kentät-sivujen avaus `fields_page_expanded`)
- `wizard_drafts` (yksi kesken oleva laskenta)

Ei pilvisynkkaa.

---

## Teema ja brändi

Asetukset → Teema: korostus-, pää-, teksti- ja pintaväri, taustakuva. Fontti IBM Plex Sans. Logo ColoRajaton.

Kuvakkeet: `@expo/vector-icons` (Ionicons). UI käyttää `ThemedIcon`-komponenttia (`src/components/ThemedIcon.tsx`), joka värittää kuvakkeen teemavärillä. Uusi kuvake: lisää Ionicons-nimi karttaan ja käytä `<ThemedIcon name="…" />`. SF Symbols (`expo-symbols`) ei näy Androidilla.
