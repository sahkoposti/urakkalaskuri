import type * as SQLite from 'expo-sqlite';

export type MigrationModuleId =
  | 'core'
  | 'asiakkaat'
  | 'tuotteet'
  | 'laskenta'
  | 'dokumentit'
  | 'liitteet';

/** Same structural db surface the old connection helpers used. */
export type DocumentsDb = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync(sql: string, ...args: unknown[]): Promise<Record<string, unknown> | null>;
  getAllAsync(sql: string, ...args: unknown[]): Promise<readonly Record<string, unknown>[]>;
};

export type MigrationStep = {
  id: string;
  module: MigrationModuleId;
  run: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

export function step(
  id: string,
  module: MigrationModuleId,
  run: MigrationStep['run'],
): MigrationStep {
  return { id, module, run };
}
