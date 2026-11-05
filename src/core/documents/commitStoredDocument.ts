/**
 * Tiedosto on jo siirretty. Rivi kirjoitetaan sen jälkeen.
 * Jos INSERT epäonnistuu, tiedosto poistetaan ja virhe näytetään kutsujalle.
 */
export async function commitStoredDocument<T>(
  relativePath: string,
  insert: () => Promise<T>,
  removeFile: (relativePath: string) => void,
): Promise<T> {
  try {
    return await insert();
  } catch (error) {
    try {
      removeFile(relativePath);
    } catch {
      // Tallennusvirhe on se, jonka käyttäjä näkee.
    }
    throw error;
  }
}
