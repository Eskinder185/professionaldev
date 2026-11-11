import { expect, test } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["microphone", "camera"],
});

test.describe("CareerOS Speech-to-Text & Interview Voice Pipeline", () => {
  test("voice interview records audio, processes transcription, offers playback review, and persists report", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__CAREEROS_MOCK_TRANSCRIPTION__ = async (_audio: any, _engine: any, options: any) => {
        options?.onProgress?.({ status: "processing", progress: 60, message: "Transcribing answer with Whisper AI…" });
        return {
          text: "When I was leading the database migration, initial latency tests showed a 200 millisecond spike.",
          segments: [
            {
              id: "seg-1",
              startSec: 0,
              endSec: 1.5,
              text: "When I was leading the database migration, initial latency tests showed a 200 millisecond spike.",
            },
          ],
          durationSec: 1.5,
          engine: "whisper-browser",
          modelName: "Xenova/whisper-tiny.en",
        };
      };
    });

    await page.goto("./interviews");

    // Select Voice Interview with 1 question
    await page.getByRole("radio", { name: /^Voice interview/ }).click();
    await page.getByRole("combobox", { name: "Session length" }).selectOption({ label: "1 question" });

    // Verify On-device Whisper engine is present and selectable
    const sttSelect = page.getByRole("combobox", { name: "Transcription engine" });
    await expect(sttSelect).toBeVisible();
    await sttSelect.selectOption({ value: "whisper-browser" });
    await expect(page.getByText(/On-device Whisper runs entirely in your browser/)).toBeVisible();

    // Start practice session
    await page.getByRole("button", { name: "Start practice session" }).click();
    await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();

    // Verify microphone is off before starting
    await expect(page.getByText(/^Mic off/)).toBeVisible();

    // Start answer
    await page.getByRole("button", { name: "Start answer" }).click();
    await expect(page.getByText(/^Mic on/)).toBeVisible();
    await expect(page.getByRole("meter", { name: "Microphone input level" })).toBeVisible();

    // Wait 1.5 seconds of speaking simulation
    await page.waitForTimeout(1500);

    // Stop answer
    await page.getByRole("button", { name: "Stop answer" }).click();

    // Verify microphone turns off
    await expect(page.getByText(/^Mic off/)).toBeVisible();

    // Verify the editable transcript box appears
    const transcriptBox = page.getByRole("textbox", { name: "Transcript (editable)" });
    await expect(transcriptBox).toBeVisible();

    // Verify audio review playback is provided
    await expect(page.getByText("Review recorded answer")).toBeVisible();
    await expect(page.locator(".iv-playback-box audio")).toBeVisible();

    // Verify Retry transcription button is provided
    await expect(page.getByRole("button", { name: "Retry transcription" })).toBeVisible();

    // Candidate edits or confirms transcript text
    const sampleAnswer =
      "When I was leading the database migration, initial latency tests showed a 200 millisecond spike. My goal was to keep query latency under 50 milliseconds for 10000 concurrent users. I analyzed slow query logs, redesigned our Redis caching layer, and optimized secondary indexes. As a result, latency dropped to 32 milliseconds and uptime remained 99.99%.";
    await transcriptBox.fill(sampleAnswer);
    await page.getByRole("button", { name: "Save transcript" }).click();

    // End session and review report
    await page.getByRole("button", { name: "End session" }).click();

    // Verify Report details
    await expect(page.getByRole("heading", { name: /^Behavioral · Voice interview/ })).toBeVisible();
    await expect(page.getByText("Words", { exact: true })).toBeVisible();
    await expect(page.getByText("Speaking patterns")).toBeVisible();
    await expect(page.getByText("Includes Situation, Task, Action, Result elements of a STAR answer.")).toBeVisible();
    await expect(page.getByText("transcript edited by you")).toBeVisible();

    // Open Transcript section in report and verify saved content
    await page.getByText("Transcript", { exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Transcript for question 1" })).toHaveValue(sampleAnswer);
  });

  test("empty or silent recordings display clear guidance rather than claiming false zero answers", async ({ page }) => {
    await page.goto("./interviews");
    await page.getByRole("radio", { name: /^Voice interview/ }).click();
    await page.getByRole("combobox", { name: "Session length" }).selectOption({ label: "1 question" });
    await page.getByRole("button", { name: "Start practice session" }).click();

    await page.getByRole("button", { name: "Start answer" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Stop answer" }).click();

    await expect(page.getByRole("textbox", { name: "Transcript (editable)" })).toBeVisible();
    await page.getByRole("button", { name: "End session" }).click();

    await expect(page.getByRole("heading", { name: /^Behavioral · Voice interview/ })).toBeVisible();
    // Verify report indicates audio was recorded without recognized words and offers recovery
    await expect(page.getByText(/Audio was recorded/)).toBeVisible();
  });
});
