# Lomake-editori (v1.1)

Uusi laskenta käyttää **Asetukset → Lomakeasetukset** -pohjaa.

1. **Sivut** – lisää, nimeä ja järjestä. Asiakas- ja materiaalisivut ovat järjestelmäsivuja.
2. **Kentät** – numero, teksti, valinta, kyllä/ei, tuotevalinta, tuote+määrä, laskettu, otsikko.
3. **Kaava** – esim. `(pinta_ala - aukot) * kerroin` tai `pinta_ala / maali.consumption`. Funktiot: `min()`, `max()`, `round()`. Desimaali kaavassa pisteellä.
4. **Tuote** – aseta menekki ja kertoimet tuotteen tiedoissa. Tuotevalinta tuo arvot kaavoihin nimellä `kenttä.consumption`.
5. **Vaikutus** – laskettu määrä voidaan lisätä materiaaliriviksi.
6. **Yhteenveto** – kytke „Näytä yhteenvetolomakkeella”.
7. **Debug** – esimerkkiarvo kentittäin, live-laskenta kaavassa.
8. **Ulkoverhous** – valmis PDF-pohja asennettavissa Lomakeasetuksista. Oletusmitat: Oletusarvot.

Kate, palkkio ja ALV tulevat Yleinen-asetuksista.
