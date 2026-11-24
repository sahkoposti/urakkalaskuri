/**
 * Online-lähetys (palvelin) on rakennusaikainen valinta. Oletus pois.
 * Päälle vain, kun EXPO_PUBLIC_ONLINE_SEND on tasan '1'. Pois päältä sovellus toimii kuten ennen.
 *
 * Tärkeää (T-40): muuttuja luetaan suoraan muodossa `process.env.EXPO_PUBLIC_ONLINE_SEND`, jotta Expo
 * korvaa sen rakennusvaiheessa vakiolla. Epäsuora luku (`env.X`, `process.env[name]`) jäisi
 * puhelimessa tyhjäksi. Lippua ei aseteta eas.json-profiileissa eikä CI:ssä.
 */
export function isOnlineSendEnabled(raw: string | undefined = process.env.EXPO_PUBLIC_ONLINE_SEND): boolean {
  return raw === '1';
}
