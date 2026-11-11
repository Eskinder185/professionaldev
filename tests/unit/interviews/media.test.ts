import { describe, expect, it } from "vitest";
import { formatMediaError, getSupportedMimeType } from "../../../src/hooks/useMediaRecorder";

describe("media recorder format negotiation and error handling", () => {
  it("determines supported mime types without throwing", () => {
    // MediaRecorder may or may not be defined in headless node environment
    const audioMime = getSupportedMimeType(false);
    const videoMime = getSupportedMimeType(true);

    // In Node vitest without browser mock, both will safely return undefined rather than throw
    expect(audioMime === undefined || typeof audioMime === "string").toBe(true);
    expect(videoMime === undefined || typeof videoMime === "string").toBe(true);
  });

  it("formats permission denial errors with clear actionable instructions", () => {
    const error = new DOMException("Permission denied", "NotAllowedError");
    const micMsg = formatMediaError(error, false);
    expect(micMsg).toContain("Microphone permission was denied");
    expect(micMsg).toContain("browser address bar settings");

    const camMsg = formatMediaError(error, true);
    expect(camMsg).toContain("Camera or microphone permission was denied");
  });

  it("formats device not found errors clearly", () => {
    const error = new DOMException("Requested device not found", "NotFoundError");
    const msg = formatMediaError(error, false);
    expect(msg).toContain("No microphone detected");
    expect(msg).toContain("connect an input device");
  });

  it("formats busy device errors clearly", () => {
    const error = new DOMException("Device already in use", "NotReadableError");
    const msg = formatMediaError(error, false);
    expect(msg).toContain("in use by another application");
  });

  it("handles unsupported environment errors gracefully", () => {
    const error = new DOMException("Not supported", "NotSupportedError");
    const msg = formatMediaError(error, false);
    expect(msg).toContain("Media recording is not supported");
  });

  it("falls back to error message for generic errors", () => {
    const error = new Error("Custom audio pipeline fault");
    expect(formatMediaError(error, false)).toBe("Custom audio pipeline fault");
  });
});
