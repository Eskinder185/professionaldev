export const CURRENT_STORAGE_VERSION = 1;
export const MIGRATION_VERSION_KEY = "pd:migrations:version";
export const MIGRATION_BACKUP_KEY_PREFIX = "pd:migrations:backup:v";

const HISTORICALLY_DELETED_PREFIXES = [
  "pd:career:resume:",
  "pd:career:pitch:",
  "pd:speech:",
] as const;

type MigrationStorage = Pick<Storage, "getItem" | "setItem" | "length" | "key">;

export type MigrationResult = {
  fromVersion: number;
  toVersion: number;
  migrated: boolean;
  backupKey?: string;
};

function readVersion(storage: MigrationStorage): number {
  const parsed = Number.parseInt(storage.getItem(MIGRATION_VERSION_KEY) ?? "0", 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function collectHistoricalValues(storage: MigrationStorage): Record<string, string> {
  const values: Record<string, string> = {};

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !HISTORICALLY_DELETED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }

  return values;
}

/**
 * Applies browser-storage migrations without deleting user data.
 *
 * Version 1 replaces the old startup cleanup. It preserves every existing key
 * and snapshots values that older releases attempted to delete, giving future
 * migrations an explicit recovery point before any transformation is proposed.
 */
export function runMigrations(storage?: MigrationStorage): MigrationResult {
  const targetStorage = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  if (!targetStorage) {
    return { fromVersion: 0, toVersion: 0, migrated: false };
  }

  const fromVersion = readVersion(targetStorage);
  if (fromVersion >= CURRENT_STORAGE_VERSION) {
    return { fromVersion, toVersion: fromVersion, migrated: false };
  }

  let backupKey: string | undefined;
  const historicalValues = collectHistoricalValues(targetStorage);

  if (Object.keys(historicalValues).length > 0) {
    backupKey = `${MIGRATION_BACKUP_KEY_PREFIX}${CURRENT_STORAGE_VERSION}`;
    if (targetStorage.getItem(backupKey) === null) {
      targetStorage.setItem(
        backupKey,
        JSON.stringify({ sourceVersion: fromVersion, values: historicalValues }),
      );
    }
  }

  targetStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_STORAGE_VERSION));

  return {
    fromVersion,
    toVersion: CURRENT_STORAGE_VERSION,
    migrated: true,
    backupKey,
  };
}

