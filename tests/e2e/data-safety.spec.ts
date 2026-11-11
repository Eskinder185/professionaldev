import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Local-data safety. Everything runs in Playwright's disposable browser contexts with synthetic
 * fixtures, so no real user profile is read or modified.
 */
const RESUMES = [
  { id: "master-1", name: "Master Profile", kind: "master", resume: { contact: { name: "Synthetic Applicant" } }, settings: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", issues: [] },
  { id: "tailored-1", name: "Acme — Linux Engineer", kind: "tailored", masterId: "master-1", jobId: "greenhouse:acme:1", resume: { contact: { name: "Synthetic Applicant" } }, settings: {}, createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z", issues: [] },
];
const APPLICATIONS = [
  { id: "app-1", company: "Acme Cloud", role: "Linux Engineer", status: "Interview", date: "2026-02-03", history: [{ at: "2026-02-03T10:00:00.000Z", event: "Status changed from Applied to Interview" }], interviews: [{ id: "iv1", date: "2026-02-10T15:00", kind: "Technical", notes: "" }] },
];

async function seed(page: Page) {
  await page.goto("./settings");
  await page.evaluate(async ({ resumes, apps }) => {
    localStorage.setItem("pd:careeros:resume-documents", JSON.stringify(resumes));
    localStorage.setItem("appTracker:items", JSON.stringify(apps));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("pd-careeros-interviews", 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore("recordings", { keyPath: "id" });
        store.createIndex("sessionId", "sessionId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").put({ id: "rec-1", sessionId: "s1", blob: new Blob(["recorded-answer"], { type: "audio/webm" }), expiresAt: Date.now() + 86_400_000 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { resumes: RESUMES, apps: APPLICATIONS });
}

async function exportBackup(page: Page) {
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all data" }).click();
  return JSON.parse(readFileSync((await (await dl).path())!, "utf8"));
}

const sign = (payload: Record<string, unknown>) => ({
  ...payload,
  sha256: createHash("sha256").update(JSON.stringify({ format: payload.format, schemaVersion: payload.schemaVersion, createdAt: payload.createdAt, entries: payload.entries, media: payload.media })).digest("hex"),
});

const snapshot = (page: Page) =>
  page.evaluate(async () => {
    const recs: string[] = await new Promise((resolve) => {
      const req = indexedDB.open("pd-careeros-interviews", 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("recordings")) return resolve([]);
        const all = db.transaction("recordings").objectStore("recordings").getAllKeys();
        all.onsuccess = () => { db.close(); resolve((all.result as string[]).map(String)); };
      };
      req.onerror = () => resolve([]);
    });
    const journal = await new Promise<boolean>((resolve) => {
      const req = indexedDB.open("pd-careeros-recovery");
      req.onupgradeneeded = () => req.result.createObjectStore("journal");
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction("journal").objectStore("journal").get("restore");
        get.onsuccess = () => { db.close(); resolve(get.result !== undefined); };
      };
      req.onerror = () => resolve(false);
    });
    return { resumes: localStorage.getItem("pd:careeros:resume-documents"), apps: localStorage.getItem("appTracker:items"), recordings: recs, journal, junk: localStorage.getItem("pd:partial:junk"), recovered: sessionStorage.getItem("pd:restore:recovered") };
  });

test("round trip keeps résumé versions, application history and recorded interview data intact", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  const backup = await exportBackup(page);
  expect(backup.media["pd-careeros-interviews"]).toHaveLength(1);

  // Damage everything, then restore through the real UI path (preview first, then confirm).
  await page.evaluate(async () => {
    localStorage.setItem("pd:careeros:resume-documents", "[]");
    localStorage.setItem("appTracker:items", "[]");
    await new Promise<void>((resolve) => {
      const req = indexedDB.open("pd-careeros-interviews", 1);
      req.onsuccess = () => {
        const tx = req.result.transaction("recordings", "readwrite");
        tx.objectStore("recordings").clear();
        tx.oncomplete = () => { req.result.close(); resolve(); };
      };
    });
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole("heading", { name: "Restore preview" })).toBeVisible();
  // A successful restore reloads the page on purpose; wait for that reload so the reads below never race it.
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Restore verified backup" }).click();
  await reloaded;
  await expect.poll(async () => (await snapshot(page)).resumes).toBe(before.resumes);

  const after = await snapshot(page);
  expect(after.apps).toBe(before.apps);
  expect(JSON.parse(after.apps!)[0].history[0].event).toContain("Applied to Interview");
  expect(JSON.parse(after.resumes!).map((r: { id: string }) => r.id)).toEqual(["master-1", "tailored-1"]);
  expect(after.recordings).toEqual(["rec-1"]);
  expect(after.journal).toBe(false); // a finished restore leaves no recovery journal behind
});

test("a restore that fails part-way rolls everything back and says so", async ({ page }) => {
  await seed(page);
  const good = await exportBackup(page);
  // A correctly signed backup whose recording row cannot be written (the store requires an `id`).
  const poisoned = sign({ ...good, entries: { ...good.entries, "appTracker:items": "[]" }, media: { ...good.media, "pd-careeros-interviews": [{ key: "bad", value: { noId: true } }] } });
  const before = await snapshot(page);

  await page.locator('input[type="file"]').setInputFiles({ name: "poisoned.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(poisoned)) });
  await expect(page.getByRole("heading", { name: "Restore preview" })).toBeVisible();
  await page.getByRole("button", { name: "Restore verified backup" }).click();
  await expect(page.getByRole("status")).not.toContainText("Backup restored");

  const after = await snapshot(page);
  expect(after.apps).toBe(before.apps); // not replaced by "[]"
  expect(after.resumes).toBe(before.resumes);
  expect(after.recordings).toEqual(["rec-1"]);
  expect(after.journal).toBe(false);
});

test("an interrupted restore (tab closed mid-way) is rolled back on the next start", async ({ page }) => {
  await seed(page);
  const original = await snapshot(page);
  const backup = await exportBackup(page); // the state a restore began from

  // Recreate exactly what a crash leaves behind: the journal written before the restore began, plus
  // records that were already half-overwritten, one stray record and a missing recording.
  await page.evaluate(async (journalJson) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("pd-careeros-recovery", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("journal");
      req.onsuccess = () => {
        const tx = req.result.transaction("journal", "readwrite");
        tx.objectStore("journal").put(journalJson, "restore");
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem("appTracker:items", '[{"id":"half-restored","company":"X","role":"Y","status":"Saved","date":""}]');
    localStorage.setItem("pd:partial:junk", "added by the interrupted restore");
    await new Promise<void>((resolve) => {
      const req = indexedDB.open("pd-careeros-interviews", 1);
      req.onsuccess = () => {
        const tx = req.result.transaction("recordings", "readwrite");
        tx.objectStore("recordings").clear();
        tx.oncomplete = () => { req.result.close(); resolve(); };
      };
    });
  }, JSON.stringify(backup));
  expect((await snapshot(page)).journal).toBe(true);

  await page.reload();
  await expect.poll(async () => (await snapshot(page)).journal).toBe(false);
  const after = await snapshot(page);
  expect(after.apps).toBe(original.apps);
  expect(after.resumes).toBe(original.resumes);
  expect(after.recordings).toEqual(["rec-1"]);
  expect(after.junk).toBeNull();
  expect(after.recovered).not.toBeNull();
});

test("a tampered journal is never applied", async ({ page }) => {
  await seed(page);
  const backup = await exportBackup(page);
  const tampered = { ...backup, entries: { ...backup.entries, "appTracker:items": "[]" } }; // checksum no longer matches
  await page.evaluate(async (journalJson) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("pd-careeros-recovery", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("journal");
      req.onsuccess = () => {
        const tx = req.result.transaction("journal", "readwrite");
        tx.objectStore("journal").put(journalJson, "restore");
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem("pd:partial:junk", "keep me");
  }, JSON.stringify(tampered));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const after = await snapshot(page);
  expect(JSON.parse(after.apps!)[0].id).toBe("app-1"); // nothing was overwritten by the bad journal
  expect(after.junk).toBe("keep me");
});

test("IndexedDB is only a copy: a corrupted copy never replaces browser records", async ({ page }) => {
  await seed(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open("pd-careeros", 1);
    req.onsuccess = () => { const all = req.result.transaction("records").objectStore("records").getAllKeys(); all.onsuccess = () => { req.result.close(); resolve(all.result.length); }; };
    req.onerror = () => resolve(0);
  }))).toBeGreaterThan(0);

  // Corrupt the copy.
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.open("pd-careeros", 1);
    req.onsuccess = () => { const tx = req.result.transaction("records", "readwrite"); tx.objectStore("records").put("CORRUPTED", "appTracker:items"); tx.oncomplete = () => { req.result.close(); resolve(); }; };
  }));
  await page.goto("./tracker");
  await expect(page.getByText("Linux Engineer").first()).toBeVisible(); // the app still reads localStorage
  expect(JSON.parse((await snapshot(page)).apps!)[0].id).toBe("app-1");
  // The next start re-copies from the authoritative store and repairs the mirror.
  await expect.poll(() => page.evaluate(() => new Promise<string>((resolve) => {
    const req = indexedDB.open("pd-careeros", 1);
    req.onsuccess = () => { const get = req.result.transaction("records").objectStore("records").get("appTracker:items"); get.onsuccess = () => { req.result.close(); resolve(String(get.result)); }; };
  }))).toBe(JSON.stringify(APPLICATIONS));
});
