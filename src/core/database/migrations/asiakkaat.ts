import type { MigrationStep } from './types';

/**
 * Asiakastaulun CREATE ja asiakasrivien täydennys ovat funktiossa
 * `migrateProductStructures` (laskenta), samassa execAsync-kutsussa kuin
 * product_structures. SQL:ää ei pilkota, joten tällä moduulilla ei ole omaa vaihetta.
 */
export const asiakkaatMigrations: MigrationStep[] = [];
