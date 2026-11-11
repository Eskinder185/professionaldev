import { CATALOG, downloadGb, type CatalogModel, type InstallApp } from "./catalog";

/**
 * Hardware guidance. A browser cannot read a computer's memory or graphics card reliably, so this
 * works only from what the person tells us, and says "can't tell" when they are not sure.
 *
 * The numbers are a rule of thumb, not a guarantee: a model needs roughly its download size in
 * memory plus about 2 GB of working space for the conversation. Actual speed varies with the
 * computer and what else is running.
 */

export type GpuKind = "none" | "nvidia" | "amd" | "apple" | "unknown";

export interface Hardware {
  ramGb: number | null;
  gpu: GpuKind;
  /** Graphics memory, for NVIDIA and AMD cards. */
  vramGb: number | null;
  diskGb: number | null;
}

export type Fit = "fast" | "slow" | "no" | "unknown";

export interface ModelFit {
  model: CatalogModel;
  fit: Fit;
  /** One plain sentence about why. */
  reason: string;
  /** Enough free storage for the download, or null when the person doesn't know. */
  diskOk: boolean | null;
  /** Memory the model is expected to need, in GB. */
  needGb: number;
}

export const WORKING_SPACE_GB = 2;
/** Apple silicon lets the graphics side use roughly three quarters of unified memory by default. */
const APPLE_GPU_SHARE = 0.75;

export const emptyHardware = (): Hardware => ({ ramGb: null, gpu: "unknown", vramGb: null, diskGb: null });

export function assessModel(model: CatalogModel, hardware: Hardware, app: InstallApp): ModelFit {
  const sizeGb = downloadGb(model, app);
  const need = Math.round((sizeGb + WORKING_SPACE_GB) * 10) / 10;
  const { ramGb, gpu, vramGb, diskGb } = hardware;
  const diskOk = diskGb === null ? null : diskGb >= sizeGb + 2;
  const base = { model, needGb: need, diskOk };

  if (ramGb === null) return { ...base, fit: "unknown", reason: "Add your computer’s memory to see whether this will run." };

  if (gpu === "apple") {
    if (need <= ramGb * APPLE_GPU_SHARE) return { ...base, fit: "fast", reason: `Fits comfortably in your ${ramGb} GB of memory.` };
    if (need <= ramGb) return { ...base, fit: "slow", reason: `Just fits in ${ramGb} GB, so other apps may slow down while it runs.` };
    return { ...base, fit: "no", reason: `Needs about ${need} GB; you have ${ramGb} GB.` };
  }

  if ((gpu === "nvidia" || gpu === "amd") && vramGb !== null) {
    if (need <= vramGb) return { ...base, fit: "fast", reason: `Fits in your graphics card’s ${vramGb} GB, so replies should be quick.` };
    if (need + WORKING_SPACE_GB <= ramGb) return { ...base, fit: "slow", reason: `Too big for your graphics card (${vramGb} GB), so part runs on the processor. It works, but replies are slower.` };
    return { ...base, fit: "no", reason: `Needs about ${need} GB; your graphics card has ${vramGb} GB and your computer ${ramGb} GB.` };
  }

  if (gpu === "unknown" || ((gpu === "nvidia" || gpu === "amd") && vramGb === null)) {
    // Memory is known, but not whether a graphics card will do the work.
    if (need + WORKING_SPACE_GB <= ramGb) return { ...base, fit: "slow", reason: "Should run, but we can’t tell how fast without knowing your graphics card." };
    return { ...base, fit: "no", reason: `Needs about ${need} GB of memory; you have ${ramGb} GB.` };
  }

  // No dedicated graphics: everything runs on the processor.
  if (need + WORKING_SPACE_GB <= ramGb) return { ...base, fit: "slow", reason: "Works on your processor, but replies will be slower without a graphics card." };
  return { ...base, fit: "no", reason: `Needs about ${need} GB of memory; you have ${ramGb} GB.` };
}

export interface Recommendation {
  pick: ModelFit | null;
  all: ModelFit[];
  /** Plain-language summary for the top of the step. */
  headline: string;
}

export function recommend(hardware: Hardware, app: InstallApp): Recommendation {
  const all = CATALOG.map((model) => assessModel(model, hardware, app));
  const storageOk = (item: ModelFit) => item.diskOk !== false;

  if (hardware.ramGb === null) {
    const starter = all.find((item) => item.model.key === "qwen3.5-4b") ?? all[0];
    return { pick: starter, all, headline: "We couldn’t tell what your computer can run, so here’s a size that suits most laptops. Add your details above for a better match." };
  }

  const fast = all.filter((item) => item.fit === "fast" && storageOk(item));
  if (fast.length) {
    const pick = fast[fast.length - 1];
    return { pick, all, headline: `${pick.model.name} is the most capable model your computer should run well.` };
  }
  const slow = all.filter((item) => item.fit === "slow" && storageOk(item));
  if (slow.length) {
    // A slow big model is painful; the smallest one that works is the kinder default.
    const pick = slow[0];
    return { pick, all, headline: `${pick.model.name} is the safest choice here. Expect slower replies without a strong graphics card.` };
  }
  const needsStorage = all.some((item) => item.fit !== "no" && item.diskOk === false);
  return {
    pick: null,
    all,
    headline: needsStorage
      ? "Your computer could run a model, but there isn’t enough free storage yet. Free up space, or use a cloud AI instead."
      : "This computer is probably too small for a good local AI. A cloud AI is the better choice here.",
  };
}

/** Parse the choices from the hardware form. Anything unrecognised becomes "not sure". */
export const toNumber = (value: string): number | null => {
  const n = Number(value);
  return value !== "" && Number.isFinite(n) && n > 0 ? n : null;
};
