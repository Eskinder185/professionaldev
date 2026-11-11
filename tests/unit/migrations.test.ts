import { beforeEach, describe, expect, it } from "vitest";
import {
  CURRENT_STORAGE_VERSION,
  MIGRATION_BACKUP_KEY_PREFIX,
  MIGRATION_VERSION_KEY,
  runMigrations,
} from "../../src/utils/migrations";

const backupKey = `${MIGRATION_BACKUP_KEY_PREFIX}${CURRENT_STORAGE_VERSION}`;

describe("runMigrations", () => {
  beforeEach(() => localStorage.clear());

  it("preserves representative historical and current user data", () => {
    const historicalData = {
      "pd:career:resume:draft": '{"summary":"Keep my resume"}',
      "pd:career:pitch:draft": "Keep my pitch",
      "pd:speech:history": '[{"blobKey":"recording-1"}]',
      "pd:resources:skills:list": '[{"name":"TypeScript"}]',
    };

    Object.entries(historicalData).forEach(([key, value]) => localStorage.setItem(key, value));

    const result = runMigrations();

    expect(result).toMatchObject({
      fromVersion: 0,
      toVersion: CURRENT_STORAGE_VERSION,
      migrated: true,
      backupKey,
    });
    Object.entries(historicalData).forEach(([key, value]) => {
      expect(localStorage.getItem(key)).toBe(value);
    });
  });

  it("backs up exact raw values before recording the migration version", () => {
    localStorage.setItem("pd:career:resume:draft", "not-json-but-still-user-data");
    localStorage.setItem("unrelated:key", "untouched");

    runMigrations();

    expect(JSON.parse(localStorage.getItem(backupKey) ?? "{}")).toEqual({
      sourceVersion: 0,
      values: {
        "pd:career:resume:draft": "not-json-but-still-user-data",
      },
    });
    expect(localStorage.getItem(MIGRATION_VERSION_KEY)).toBe(String(CURRENT_STORAGE_VERSION));
    expect(localStorage.getItem("unrelated:key")).toBe("untouched");
  });

  it("is idempotent across reloads and does not overwrite its backup", () => {
    localStorage.setItem("pd:career:pitch:draft", "original");
    runMigrations();
    const originalBackup = localStorage.getItem(backupKey);

    localStorage.setItem("pd:career:pitch:draft", "edited after migration");
    const secondResult = runMigrations();

    expect(secondResult).toEqual({
      fromVersion: CURRENT_STORAGE_VERSION,
      toVersion: CURRENT_STORAGE_VERSION,
      migrated: false,
    });
    expect(localStorage.getItem(backupKey)).toBe(originalBackup);
    expect(localStorage.getItem("pd:career:pitch:draft")).toBe("edited after migration");
  });

  it("does not create an empty backup when no historical keys exist", () => {
    localStorage.setItem("pd:self:strengths:answers", '{"q1":4}');

    runMigrations();

    expect(localStorage.getItem(backupKey)).toBeNull();
    expect(localStorage.getItem("pd:self:strengths:answers")).toBe('{"q1":4}');
  });
});
