import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_VERIFIED_ON, modelId, sizeLabel } from "../../../src/features/ai/install/catalog";
import { assessModel, recommend, type Hardware } from "../../../src/features/ai/install/recommend";

const hw = (over: Partial<Hardware>): Hardware => ({ ramGb: null, gpu: "unknown", vramGb: null, diskGb: null, ...over });
const pickKey = (hardware: Hardware, app: "ollama" | "lmstudio" = "ollama") => recommend(hardware, app).pick?.model.key ?? null;

describe("catalog", () => {
  it("lists only the four verified models, in order of capability", () => {
    expect(CATALOG.map((m) => m.ollamaTag)).toEqual(["qwen3.5:2b", "qwen3.5:4b", "qwen3.5:9b", "gemma4:12b"]);
    expect(CATALOG.map((m) => m.lmStudioId)).toEqual(["qwen/qwen3.5-2b", "qwen/qwen3.5-4b", "qwen/qwen3.5-9b", "google/gemma-4-12b"]);
    expect(CATALOG.every((m) => m.license === "Apache-2.0" && m.licenseUrl.startsWith("https://huggingface.co/"))).toBe(true);
    expect(CATALOG_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows each app's own size and identifier", () => {
    const nine = CATALOG[2];
    expect(sizeLabel(nine, "ollama")).toBe("6.6–7.6 GB");
    expect(sizeLabel(nine, "lmstudio")).toBe("7.00 GB");
    expect(modelId(nine, "lmstudio")).toBe("qwen/qwen3.5-9b");
  });
});

describe("recommend", () => {
  it("picks the largest model that fits a strong graphics card", () => {
    expect(pickKey(hw({ ramGb: 32, gpu: "nvidia", vramGb: 16, diskGb: 100 }))).toBe("gemma4-12b");
    expect(pickKey(hw({ ramGb: 16, gpu: "nvidia", vramGb: 8, diskGb: 100 }))).toBe("qwen3.5-4b");
  });

  it("uses most of unified memory on Apple silicon", () => {
    expect(pickKey(hw({ ramGb: 16, gpu: "apple", diskGb: 100 }))).toBe("gemma4-12b");
    expect(pickKey(hw({ ramGb: 8, gpu: "apple", diskGb: 100 }))).toBe("qwen3.5-4b");
  });

  it("chooses the smallest working model, with a speed warning, when there is no graphics card", () => {
    const result = recommend(hw({ ramGb: 16, gpu: "none", diskGb: 100 }), "ollama");
    expect(result.pick?.model.key).toBe("qwen3.5-2b");
    expect(result.pick?.fit).toBe("slow");
    expect(result.headline).toMatch(/slower replies/);
  });

  it("says a computer is too small instead of recommending something that will not run", () => {
    const result = recommend(hw({ ramGb: 4, gpu: "none", diskGb: 100 }), "ollama");
    expect(result.pick).toBeNull();
    expect(result.headline).toMatch(/cloud AI/);
    expect(result.all.every((item) => item.fit === "no")).toBe(true);
  });

  it("does not recommend a download that will not fit on the disk", () => {
    expect(pickKey(hw({ ramGb: 32, gpu: "nvidia", vramGb: 16, diskGb: 5.5 }))).toBe("qwen3.5-2b");
    const none = recommend(hw({ ramGb: 32, gpu: "nvidia", vramGb: 16, diskGb: 3 }), "ollama");
    expect(none.pick).toBeNull();
    expect(none.headline).toMatch(/free storage/);
  });

  it("falls back to a middle size and says so when the person is not sure", () => {
    const result = recommend(hw({}), "ollama");
    expect(result.pick?.model.key).toBe("qwen3.5-4b");
    expect(result.headline).toMatch(/couldn.t tell/);
    expect(result.all.every((item) => item.fit === "unknown")).toBe(true);
  });

  it("does not claim speed when the graphics card is unknown", () => {
    const fit = assessModel(CATALOG[1], hw({ ramGb: 16, gpu: "unknown" }), "ollama");
    expect(fit.fit).toBe("slow");
    expect(fit.reason).toMatch(/can.t tell how fast/);
  });

  it("treats LM Studio's own sizes separately", () => {
    // 9B is 7.0 GB in LM Studio (+2 = 9) and up to 7.6 GB in Ollama (+2 = 9.6).
    const hardware = hw({ ramGb: 12, gpu: "nvidia", vramGb: 9.5 });
    expect(assessModel(CATALOG[2], hardware, "lmstudio").fit).toBe("fast");
    expect(assessModel(CATALOG[2], hardware, "ollama").fit).toBe("slow");
  });
});
