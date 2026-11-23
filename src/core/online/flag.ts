/**
 * Online-lähetys (palvelin) on rakennusaikainen valinta. Oletus pois.
 * Päälle vain, kun EXPO_PUBLIC_ONLINE_SEND on tasan '1'. Pois päältä sovellus toimii kuten ennen.
 */
export function isOnlineSendEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EXPO_PUBLIC_ONLINE_SEND === '1';
}
