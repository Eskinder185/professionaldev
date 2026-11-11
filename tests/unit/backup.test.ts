import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { BACKUP_FORMAT, isCareerKey, parseBackup, previewRestore, verifyBackup, type BackupPayload } from "../../src/features/storage/backup";

async function signed(payload: BackupPayload) {
  const hash = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
  return { ...payload, sha256: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") };
}

const fixture = (): BackupPayload => ({
  format: BACKUP_FORMAT,
  schemaVersion: 3,
  createdAt: "2026-11-10T12:00:00.000Z",
  entries: { "pd:career:resume:draft": "{broken but preserved", "appTracker:items": "[]" },
  media: { "pd:speech": [], "pd-careeros-interviews": [], "pd-careeros": [] },
});

describe("CareerOS backup", () => {
  beforeAll(() => vi.stubGlobal("crypto", webcrypto));
  afterAll(() => vi.unstubAllGlobals());
  it("recognizes legacy and current owned keys", () => {
    expect(isCareerKey("appTracker:items")).toBe(true);
    expect(isCareerKey("pd:career:resume:draft")).toBe(true);
    expect(isCareerKey("unrelated-app:secret")).toBe(false);
  });

  it("verifies exact raw records and previews collisions", async () => {
    localStorage.setItem("appTracker:items", "old");
    const backup = await verifyBackup(await signed(fixture()));
    expect(backup.entries["pd:career:resume:draft"]).toBe("{broken but preserved");
    expect(previewRestore(backup)).toEqual({ entries: 2, media: 0, replacing: 1 });
  });

  it("rejects corruption, duplicate records, and unrelated keys", async () => {
    const good = await signed(fixture());
    await expect(verifyBackup({ ...good, entries: { ...good.entries, "appTracker:items": "changed" } })).rejects.toThrow("checksum");
    const duplicate = fixture();
    duplicate.media["pd:speech"] = [{ key: "one", value: "a" }, { key: "one", value: "b" }];
    await expect(verifyBackup(await signed(duplicate))).rejects.toThrow("Duplicate");
    const foreign = fixture();
    foreign.entries["foreign:key"] = "value";
    await expect(verifyBackup(await signed(foreign))).rejects.toThrow("invalid browser records");
  });

  it("keeps compatibility with the prior Settings JSON export", async () => {
    const result = await parseBackup({ format: "professionaldev-local-storage-v2", entries: { "appTracker:items": "[]" }, videoBlobKeys: ["old-video"] });
    expect(result.backup.entries["appTracker:items"]).toBe("[]");
    expect(result.warning).toContain("no checksum or recording files");
    await expect(verifyBackup(result.backup)).resolves.toBeDefined();
  });
});
