/**
 * Models the install helper may recommend.
 *
 * Every entry was checked by hand against primary sources on CATALOG_VERIFIED_ON:
 *  - Ollama's library tag pages (names, download sizes, context length)
 *  - LM Studio's model pages (its own identifiers and sizes)
 *  - The publishers' model cards on Hugging Face (licence)
 * Nothing here is a guess. If a model cannot be verified, it does not belong in this list.
 * Re-check before changing anything: model libraries move quickly.
 */

export const CATALOG_VERIFIED_ON = "2026-11-10";

export const SOURCES = {
  ollamaDownload: "https://ollama.com/download",
  ollamaLibrary: "https://ollama.com/library",
  ollamaFaq: "https://docs.ollama.com/faq",
  lmStudioHome: "https://lmstudio.ai/",
  lmStudioServer: "https://lmstudio.ai/docs/developer/core/server",
  lmStudioDownloadModel: "https://lmstudio.ai/docs/app/basics/download-model",
} as const;

export interface CatalogModel {
  /** Stable key, in order of capability (and hardware need). */
  key: "qwen3.5-2b" | "qwen3.5-4b" | "qwen3.5-9b" | "gemma4-12b";
  name: string;
  maker: string;
  /** Exact tag for `ollama pull`. */
  ollamaTag: string;
  /** Exact identifier inside LM Studio. */
  lmStudioId: string;
  /** Download size range shown by Ollama's library, in GB. */
  ollamaGb: readonly [number, number];
  /** Download size shown by LM Studio, in GB. */
  lmStudioGb: number;
  contextK: number;
  license: "Apache-2.0";
  licenseUrl: string;
  ollamaUrl: string;
  summary: string;
}

export const CATALOG: readonly CatalogModel[] = [
  {
    key: "qwen3.5-2b",
    name: "Qwen 3.5 · 2B",
    maker: "Alibaba (Qwen)",
    ollamaTag: "qwen3.5:2b",
    lmStudioId: "qwen/qwen3.5-2b",
    ollamaGb: [2.7, 3.1],
    lmStudioGb: 2.0,
    contextK: 256,
    license: "Apache-2.0",
    licenseUrl: "https://huggingface.co/Qwen/Qwen3.5-2B",
    ollamaUrl: "https://ollama.com/library/qwen3.5",
    summary: "The smallest option. Runs almost anywhere, but is limited for résumé rewriting.",
  },
  {
    key: "qwen3.5-4b",
    name: "Qwen 3.5 · 4B",
    maker: "Alibaba (Qwen)",
    ollamaTag: "qwen3.5:4b",
    lmStudioId: "qwen/qwen3.5-4b",
    ollamaGb: [3.3, 4.0],
    lmStudioGb: 3.75,
    contextK: 256,
    license: "Apache-2.0",
    licenseUrl: "https://huggingface.co/Qwen/Qwen3.5-4B",
    ollamaUrl: "https://ollama.com/library/qwen3.5",
    summary: "A good starting point for most laptops.",
  },
  {
    key: "qwen3.5-9b",
    name: "Qwen 3.5 · 9B",
    maker: "Alibaba (Qwen)",
    ollamaTag: "qwen3.5:9b",
    lmStudioId: "qwen/qwen3.5-9b",
    ollamaGb: [6.6, 7.6],
    lmStudioGb: 7.0,
    contextK: 256,
    license: "Apache-2.0",
    licenseUrl: "https://huggingface.co/Qwen/Qwen3.5-9B",
    ollamaUrl: "https://ollama.com/library/qwen3.5",
    summary: "Noticeably better writing and reasoning. Needs a stronger computer.",
  },
  {
    key: "gemma4-12b",
    name: "Gemma 4 · 12B",
    maker: "Google",
    ollamaTag: "gemma4:12b",
    lmStudioId: "google/gemma-4-12b",
    ollamaGb: [7.7, 8.0],
    lmStudioGb: 7.4,
    contextK: 256,
    license: "Apache-2.0",
    licenseUrl: "https://huggingface.co/google/gemma-4-12B-it",
    ollamaUrl: "https://ollama.com/library/gemma4",
    summary: "The most capable option here. Best on a computer with a strong graphics card or lots of memory.",
  },
];

export type InstallApp = "ollama" | "lmstudio";

/** Largest download for this model in the chosen app, in GB. */
export const downloadGb = (model: CatalogModel, app: InstallApp): number => (app === "ollama" ? model.ollamaGb[1] : model.lmStudioGb);

/** Download size as shown to the person: a range for Ollama, one figure for LM Studio. */
export const sizeLabel = (model: CatalogModel, app: InstallApp): string =>
  app === "ollama" ? `${model.ollamaGb[0].toFixed(1)}–${model.ollamaGb[1].toFixed(1)} GB` : `${model.lmStudioGb.toFixed(2)} GB`;

export const modelId = (model: CatalogModel, app: InstallApp): string => (app === "ollama" ? model.ollamaTag : model.lmStudioId);
