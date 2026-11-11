export type FeatureId =
  | 'asiakkaat'
  | 'tuotteet'
  | 'tuoterakenteet'
  | 'laskenta'
  | 'historia'
  | 'tarjous'
  | 'urakkakortti'
  | 'materiaalit'
  | 'liitteet'
  | 'asetukset';

export type FeatureDefinition = {
  readonly id: FeatureId;
  readonly label: string;
  readonly enabled: boolean;
};

/**
 * Käytössä olevat ominaisuusmoduulit. Moduulin poisto = poista rivi listasta.
 * Moduuli ei koskaan poista tauluja tai sarakkeita tietokannasta.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  { id: 'asiakkaat', label: 'Asiakkaat', enabled: true },
  { id: 'tuotteet', label: 'Tuotteet', enabled: true },
  { id: 'tuoterakenteet', label: 'Tuoterakenteet', enabled: true },
  { id: 'laskenta', label: 'Laskenta', enabled: true },
  { id: 'historia', label: 'Historia', enabled: true },
  { id: 'tarjous', label: 'Tarjous', enabled: true },
  { id: 'urakkakortti', label: 'Urakkakortti', enabled: true },
  { id: 'materiaalit', label: 'Materiaalit', enabled: true },
  { id: 'liitteet', label: 'Liitteet', enabled: true },
  { id: 'asetukset', label: 'Asetukset', enabled: true },
] as const;

const enabledIds = new Set<FeatureId>(
  FEATURES.filter((feature) => feature.enabled).map((feature) => feature.id),
);

export function isFeatureEnabled(id: FeatureId): boolean {
  return enabledIds.has(id);
}
