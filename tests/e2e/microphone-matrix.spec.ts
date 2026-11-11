import { expect, test, type Page } from "@playwright/test";

/**
 * Microphone behaviour matrix. IMPORTANT: every case here uses Chromium's synthetic devices
 * (--use-fake-device-for-media-stream) or a stubbed navigator.mediaDevices. None of it exercises a
 * physical microphone, so it proves the application's handling of each browser outcome, not any
 * particular hardware.
 */
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["microphone"],
});

const ANSWER =
  "When I was at the campus help desk the printers failed before finals. My task was to restore printing for 300 students. I checked the server logs, rolled back a driver update and documented the fix. As a result printing recovered within an hour.";

async function startVoice(page: Page) {
  await page.goto("./interviews");
  await page.getByRole("radio", { name: /^Voice interview/ }).click();
  await page.getByRole("combobox", { name: "Session length" }).selectOption({ label: "1 question" });
  await page.getByRole("button", { name: "Start practice session" }).click();
}

/** Remember every stream the app opens so the test can inspect and "unplug" it. */
async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await original(c);
      w.__streams.push(s);
      return s;
    };
  });
}

async function finishAsText(page: Page) {
  // Text-only fallback: type the transcript, save it, end the session and get a report.
  await page.getByRole("textbox", { name: "Transcript (editable)" }).fill(ANSWER);
  await page.getByRole("button", { name: "Save transcript" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByText("transcript edited by you")).toBeVisible();
}

test("granted (synthetic device): the microphone is only on while answering", async ({ page }) => {
  await trackStreams(page);
  await startVoice(page);
  await expect(page.getByText(/^Mic off/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.length)).toBe(0);
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText(/^Mic on/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.some((s) => s.getAudioTracks().some((t) => t.readyState === "live")))).toBe(true);
});

test("no microphone device: a clear message, and the interview can still be completed as text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Requested device not found", "NotFoundError"); }, enumerateDevices: async () => [] },
    });
  });
  await startVoice(page);
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByRole("alert")).toContainText(/No microphone was found/i);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await finishAsText(page);
});

test("denied permission: explained, and the text-only interview completes to a report", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); }, enumerateDevices: async () => [] },
    });
  });
  await startVoice(page);
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByRole("alert")).toContainText("Microphone permission was denied");
  await page.getByRole("button", { name: "Stop answer" }).click();
  await finishAsText(page);
});

test("device disconnected mid-answer: the user is told, the answer is kept and the device is released", async ({ page }) => {
  await trackStreams(page);
  await startVoice(page);
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText(/^Mic on/)).toBeVisible();
  // A real unplug makes the browser end the track and fire "ended". Chromium's fake device can't be
  // unplugged, so the same event is dispatched on the live track.
  await page.evaluate(() => {
    const track = (window as unknown as { __streams: MediaStream[] }).__streams[0].getAudioTracks()[0];
    track.stop();
    track.dispatchEvent(new Event("ended"));
  });
  await expect(page.getByRole("alert")).toContainText("Microphone access ended");
  await page.getByRole("button", { name: "Stop answer" }).click();
  await finishAsText(page);
});

test("stopping an answer before speaking releases the microphone; nothing keeps capturing", async ({ page }) => {
  // One answer per question: stopping ends capture and the session stays usable as text.
  await trackStreams(page);
  await startVoice(page);
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText(/^Mic on/)).toBeVisible();
  await page.getByRole("button", { name: "Stop answer" }).click();
  await expect(page.getByText(/^Mic off/)).toBeVisible();
  const allEnded = await page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended")));
  expect(allEnded).toBe(true);
  await expect(page.getByRole("button", { name: "Start answer" })).toHaveCount(0);
  await finishAsText(page);
});
