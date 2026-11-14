import type * as SQLite from 'expo-sqlite';

import { asiakkaatMigrations } from './migrations/asiakkaat';
import { coreMigrations } from './migrations/core';
import { dokumentitMigrations } from './migrations/dokumentit';
import { laskentaMigrations } from './migrations/laskenta';
import { liitteetMigrations } from './migrations/liitteet';
import { tuotteetMigrations } from './migrations/tuotteet';
import type { MigrationStep } from './migrations/types';

const byId = new Map<string, MigrationStep>(
  [
    ...coreMigrations,
    ...laskentaMigrations,
    ...tuotteetMigrations,
    ...asiakkaatMigrations,
    ...dokumentitMigrations,
    ...liitteetMigrations,
  ].map((item) => [item.id, item]),
);

/**
 * Global order matches connection.ts openDatabase + migrateDatabase at 13a0c86.
 * Module arrays only group steps; this list is the execution order.
 */
export const MIGRATION_ORDER = [
  'core.createBaseTables',
  'laskenta.migrateCalculationColumns',
  'tuotteet.migrateProductAttributes',
  'tuotteet.migrateProductPrices',
  'tuotteet.migrateProductSortOrder',
  'core.deleteWizardStepOrderSetting',
  'laskenta.migrateProductStructures',
  'laskenta.migrateStripCustomerFormPages',
  'dokumentit.ensureDocumentsTable',
  'liitteet.ensureAttachmentsTable',
  'laskenta.ensureCalculationStatusColumn',
  'core.seedDefaultSettings',
] as const;

export const orderedMigrationSteps: MigrationStep[] = MIGRATION_ORDER.map((id) => {
  const found = byId.get(id);
  if (!found) throw new Error(`Missing migration step ${id}`);
  return found;
});

export async function runDatabaseInit(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const migrationStep of orderedMigrationSteps) {
    await migrationStep.run(db);
  }
}
