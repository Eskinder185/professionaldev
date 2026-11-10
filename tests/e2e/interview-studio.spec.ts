import { expect, test, type Page } from "@playwright/test";

// Chromium's synthetic devices: a test tone and a test pattern. No real camera or microphone data is used.
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["microphone", "camera"],
});

const ANSWER =
  "When I was working at the campus help desk, there was a printer outage before finals. My goal was to restore printing for 300 students. I investigated the server logs, rolled back a failed driver update, and documented the fix. As a result, printing was restored in 40 minutes.";

async function choose(page: Page, mode: "Text interview" | "Voice interview" | "Camera + voice", count = "1 question") {
  await page.goto("./interviews");
  await page.getByRole("radio", { name: new RegExp(`^${mode.replace("+", "\\+")}`) }).click();
  await page.getByRole("combobox", { name: "Session length" }).selectOption({ label: count });
}

test("text interview produces an evidence-based report that persists", async ({ page }) => {
  await choose(page, "Text interview");
  await page.getByRole("combobox", { name: "Interview type" }).selectOption("behavioral");
  await page.getByRole("button", { name: "Start practice session" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  await page.getByRole("button", { name: "Start answer" }).click();
  await page.getByRole("textbox", { name: "Your answer" }).fill(ANSWER);
  await page.getByRole("textbox", { name: "Notes" }).fill("Mention the rollback plan.");
  await page.getByRole("button", { name: "Stop answer" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { name: /^Behavioral · Text interview/ })).toBeVisible();
  await expect(page.getByText("Includes Situation, Task, Action, Result elements of a STAR answer.")).toBeVisible();
  await expect(page.getByText("Typed answer: speaking pace and filler words don't apply.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open report" }).first().click();
  await page.getByText("Transcript", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Transcript for question 1" })).toHaveValue(ANSWER);
  await expect(page.getByText("Notes: Mention the rollback plan.")).toBeVisible();
});

test("voice interview turns the microphone on only when answering and supports an edited transcript", async ({ page }) => {
  await choose(page, "Voice interview");
  await page.getByRole("button", { name: "Start practice session" }).click();
  await expect(page.getByText(/^Mic off/)).toBeVisible();
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText(/^Mic on/)).toBeVisible();
  await expect(page.getByRole("meter", { name: "Microphone input level" })).toBeVisible();
  await expect(page.getByText(/Recording · saved on this device/)).toHaveCount(0);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText(/^Paused/)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByText(/^Mic muted/)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await expect(page.getByText(/^Mic off/)).toBeVisible();
  await page.getByRole("textbox", { name: "Transcript (editable)" }).fill(ANSWER);
  await page.getByRole("button", { name: "Save transcript" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByText("transcript edited by you")).toBeVisible();
  await expect(page.getByText("Speaking patterns")).toBeVisible();
  await expect(page.locator(".iv-metrics")).toContainText("Words");
});

test("denied microphone permission is explained and practice continues", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); }, enumerateDevices: async () => [] },
    });
  });
  await choose(page, "Voice interview");
  await page.getByRole("button", { name: "Start practice session" }).click();
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByRole("alert")).toContainText("Microphone permission was denied");
  await page.getByRole("button", { name: "Stop answer" }).click();
  await expect(page.getByRole("textbox", { name: "Transcript (editable)" })).toBeVisible();
});

test("browsers without speech recognition show an honest unavailable state", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  });
  await choose(page, "Voice interview");
  await expect(page.getByText(/does not provide speech recognition/)).toBeVisible();
  await page.getByRole("button", { name: "Start practice session" }).click();
  await expect(page.getByText(/Live transcription isn't available in this browser/)).toBeVisible();
});

test("live transcription needs explicit consent when the browser uses a cloud speech service", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      static started = 0;
      continuous = false; interimResults = false; lang = "en-US";
      onresult: ((event: unknown) => void) | null = null; onerror = null; onend = null;
      start() { FakeRecognition.started++; (window as unknown as { __sttStarts: number }).__sttStarts = FakeRecognition.started; setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "I reset the password" }], { isFinal: true })] }), 300); }
      stop() {} abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  });
  await choose(page, "Voice interview");
  await expect(page.getByText(/sends audio to the browser vendor's speech service/).first()).toBeVisible();
  await page.getByRole("button", { name: "Start practice session" }).click();
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText("Live transcription is off because you didn't allow the browser's speech service.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sttStarts?: number }).__sttStarts ?? 0)).toBe(0);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await page.getByRole("button", { name: "End session" }).click();

  await page.getByRole("button", { name: "Back to Interview Studio" }).click();
  await page.getByRole("checkbox", { name: "Allow the browser's speech service for live transcription" }).check();
  await page.getByRole("button", { name: "Start practice session" }).click();
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.locator(".iv-live")).toContainText("I reset the password");
  await expect(page.locator(".iv-live time").first()).toHaveText(/^0:0\d$/);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await expect(page.getByRole("textbox", { name: "Transcript (editable)" })).toHaveValue("I reset the password");
});

test("recordings are saved only with consent and can be replayed and deleted", async ({ page }) => {
  await choose(page, "Voice interview");
  await page.getByRole("checkbox", { name: "Save recordings on this device for replay" }).check();
  await page.getByRole("button", { name: "Start practice session" }).click();
  await page.getByRole("button", { name: "Start answer" }).click();
  await expect(page.getByText(/Recording · saved on this device/)).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop answer" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByText("Replay", { exact: true }).click();
  await expect(page.locator(".iv-replay audio")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete recording" }).click();
  await expect(page.getByText("No recording was saved for this answer.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete session" }).click();
  await expect(page.getByText("Session deleted.")).toBeVisible();
});

test("camera mode keeps the camera optional and runs on-device presentation tracking", async ({ page }) => {
  test.setTimeout(90_000);
  await choose(page, "Camera + voice");
  await page.getByRole("checkbox", { name: "Camera presentation feedback (on-device)" }).check();
  await page.getByRole("button", { name: "Start practice session" }).click();
  await expect(page.getByText("Camera is off. Turn it on when you're ready; it's optional.")).toBeVisible();
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await expect(page.getByText(/^Camera on/)).toBeVisible();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth), { timeout: 10_000 }).toBeGreaterThan(0);
  // The synthetic camera shows a test pattern, so the model should run and report no face.
  await expect(page.locator(".iv-face-status")).toContainText("Face not detected", { timeout: 60_000 });
  await page.getByRole("button", { name: "Presentation feedback on" }).click();
  await expect(page.locator(".iv-face-status")).toHaveCount(0);
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await expect(page.getByText(/^Camera off/)).toBeVisible();
});

test("voice mode never shows camera controls", async ({ page }) => {
  await choose(page, "Voice interview");
  await page.getByRole("button", { name: "Start practice session" }).click();
  await expect(page.getByRole("button", { name: /camera/i })).toHaveCount(0);
});

for (const width of [320, 375, 768, 1440]) {
  test(`interview studio fits at ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, "viewport sweep runs on desktop");
    await page.setViewportSize({ width, height: 900 });
    await choose(page, "Camera + voice");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Start practice session" }).click();
    await expect(page.getByRole("toolbar", { name: "Session controls" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
