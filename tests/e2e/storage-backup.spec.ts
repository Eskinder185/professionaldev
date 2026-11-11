import { expect, test } from "@playwright/test";

test("exports and restores browser records and saved recordings", async ({ page }) => {
  await page.goto("./settings");
  await page.evaluate(async () => {
    localStorage.setItem("pd:career:resume:draft", '{"name":"Synthetic Applicant"}');
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
      tx.objectStore("recordings").put({ id: "synthetic", sessionId: "test", blob: new Blob(["audio"], { type: "audio/webm" }), expiresAt: Date.now() + 86400000 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all data" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync(path!, "utf8"));
  expect(data.entries["pd:career:resume:draft"]).toBe('{"name":"Synthetic Applicant"}');
  expect(data.media["pd-careeros-interviews"]).toHaveLength(1);
  expect(data.media["pd-careeros-interviews"][0].value.blob.base64).toBe("YXVkaW8=");

  await page.evaluate(() => localStorage.setItem("pd:career:resume:draft", "changed"));
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.getByRole("heading", { name: "Restore preview" })).toBeVisible();
  await expect(page.getByText(/browser records have the same keys/)).toBeVisible();
  // A successful restore reloads the page on purpose; wait for that reload so the read below never races it.
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Restore verified backup" }).click();
  await reloaded;
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pd:career:resume:draft"))).toBe('{"name":"Synthetic Applicant"}');
});

test("rejects a modified backup before restore", async ({ page }) => {
  await page.goto("./settings");
  const invalid = {
    format: "careeros-backup-v3", schemaVersion: 3, createdAt: new Date().toISOString(),
    entries: { "pd:test": "changed" },
    media: { "pd:speech": [], "pd-careeros-interviews": [], "pd-careeros": [] },
    sha256: "0".repeat(64),
  };
  await page.locator('input[type="file"]').setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole("status")).toContainText("checksum does not match");
  await expect(page.getByRole("heading", { name: "Restore preview" })).toHaveCount(0);
});

test("copies legacy values to IndexedDB without removing their originals", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pd:career:resume:legacy", "{malformed draft"));
  await page.goto("./settings");
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("pd-careeros", 1);
      // Create the store exactly as the app does if this read happens to be the first open, so the test never
      // leaves behind an empty version-1 database that would block the app's own copy.
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("records")) req.result.createObjectStore("records"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction("records", "readonly").objectStore("records").get("pd:career:resume:legacy");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  })).toBe("{malformed draft");
  expect(await page.evaluate(() => localStorage.getItem("pd:career:resume:legacy"))).toBe("{malformed draft");
});
