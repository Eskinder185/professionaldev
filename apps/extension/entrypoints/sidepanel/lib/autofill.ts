import type {
  AutofillRunResult,
  AutofillRunState,
  AutoApplyMessage,
  AutoApplyQueueItem,
  DetectedField,
  PageContext,
  SharedProfileSubset,
} from "../../../../../packages/careeros-shared/types";
import { dispatch, readPageContext, sendToTab, type TargetTab } from "./bridge";

const BATCH_SIZE = 4;

export type FieldClass = AutofillRunResult["status"];

/** Which fields CareerOS may fill on its own: high-confidence, ready, non-file, non-sensitive. */
export function autoFillableIds(fields: DetectedField[]): string[] {
  return fields
    .filter(
      (f) =>
        f.reviewStatus === "Ready" &&
        f.confidence !== "sensitive_manual" &&
        f.confidence !== "unsupported" &&
        f.inputType !== "file" &&
        f.preparedValue.trim().length > 0,
    )
    .map((f) => f.id);
}

/** Classifies every field into exactly one review status. Never "filled" without a verified read-back. */
export function classifyField(f: DetectedField, filledReadBack?: string): AutofillRunResult {
  const base = { fieldId: f.id, label: f.label };
  if (f.inputType === "file") {
    const attached = f.currentDomValue.trim();
    return attached
      ? { ...base, status: "filled", readBack: attached, note: "File attached" }
      : {
          ...base,
          status: "file",
          insertedValue: f.preparedValue || undefined,
          note: "Browsers don't let extensions attach files. Attach it yourself, then check the filename.",
        };
  }
  if (f.confidence === "sensitive_manual") {
    return { ...base, status: "manual", note: f.sensitiveReason ?? "Legally significant or personal question. Answer it yourself." };
  }
  if (f.confidence === "unsupported" || f.inputType === "unknown") {
    return { ...base, status: "unsupported", note: "CareerOS can't safely fill this control." };
  }
  if (filledReadBack !== undefined) {
    return filledReadBack === f.preparedValue || f.currentDomValue === f.preparedValue
      ? { ...base, status: "filled", insertedValue: f.preparedValue, readBack: filledReadBack }
      : {
          ...base,
          status: "failed",
          insertedValue: f.preparedValue,
          readBack: filledReadBack,
          note: "The page did not keep the value CareerOS entered.",
        };
  }
  if (f.reviewStatus === "Missing information" || !f.preparedValue.trim()) {
    return { ...base, status: "missing", note: "No approved information for this field in your profile." };
  }
  if (f.reviewStatus === "Filled and verified" || f.verifiedFilled) {
    return { ...base, status: "filled", insertedValue: f.preparedValue, readBack: f.currentDomValue };
  }
  return { ...base, status: "confirm", insertedValue: f.preparedValue, note: f.evidence };
}

export interface RunHandle {
  cancel(): void;
  done: Promise<AutofillRunState>;
}

function newRun(page: PageContext, app: AutoApplyQueueItem | null): AutofillRunState {
  const now = new Date().toISOString();
  return {
    runId: `run-${Date.now()}`,
    applicationId: app?.id ?? null,
    url: page.url,
    phase: "inspecting",
    step: "Reading the form",
    total: 0,
    processed: 0,
    results: [],
    validationIssues: [],
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Runs Start Autofill: inspect → fill in small batches (so it can be cancelled and progress is real)
 * → re-inspect and read every value back. It never touches the employer's Submit button.
 */
export function startAutofill(opts: {
  tab: TargetTab;
  page: PageContext;
  profile: SharedProfileSubset | null;
  app: AutoApplyQueueItem | null;
  onUpdate: (run: AutofillRunState) => void;
}): RunHandle {
  let cancelled = false;
  let run = newRun(opts.page, opts.app);

  const push = (patch: Partial<AutofillRunState>): Promise<unknown> => {
    run = { ...run, ...patch, updatedAt: new Date().toISOString() };
    // Persist so the panel can recover after a restart; the UI updates immediately either way.
    const stored = dispatch("UPDATE_AUTOFILL_RUN", { run });
    opts.onUpdate(run);
    return stored;
  };

  const done = (async (): Promise<AutofillRunState> => {
    try {
      push({});
      const first = await readPageContext(opts.tab, opts.profile, opts.app);
      if (!first.ok) throw new Error(first.message);
      const ids = autoFillableIds(first.context.fields);
      push({ phase: "filling", step: "Filling approved fields", total: ids.length, processed: 0 });

      const overrides: Record<string, string> = {};
      const insertedValues: Record<string, string> = {};
      const attempted = new Set<string>();
      for (const f of first.context.fields) {
        if (ids.includes(f.id)) insertedValues[f.id] = f.preparedValue;
      }

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = ids.slice(i, i + BATCH_SIZE);
        const label = first.context.fields.find((f) => f.id === batch[0])?.label ?? "field";
        push({ step: `Filling “${label}”${batch.length > 1 ? ` and ${batch.length - 1} more` : ""}`, processed: i });
        const message: Partial<AutoApplyMessage> & { payload: Record<string, unknown> } = {
          action: "EXECUTE_AUTOFILL",
          payload: {
            sharedProfile: opts.profile,
            activeApplication: opts.app,
            approvedFieldIds: batch,
            onlyFieldIds: batch,
            overrideValues: overrides,
            applicationId: opts.app?.id,
          },
        };
        const res = await sendToTab<{ ok?: boolean }>(opts.tab.id!, message);
        if (!res?.ok) throw new Error("The page did not respond while filling.");
        batch.forEach((id) => attempted.add(id));
        // Let framework re-renders settle before the next batch.
        await new Promise((r) => setTimeout(r, 60));
      }

      push({ phase: "verifying", step: "Reading values back from the page", processed: ids.length });
      const after = await readPageContext(opts.tab, opts.profile, opts.app);
      if (!after.ok) throw new Error(after.message);

      const results: AutofillRunResult[] = after.context.fields.map((f) => {
        if (attempted.has(f.id)) {
          // Compare the live DOM value to what we inserted. Anything else is not "filled".
          return classifyField(f, f.currentDomValue);
        }
        return classifyField(f);
      }).map((r) => {
        const inserted = insertedValues[r.fieldId];
        return inserted !== undefined && r.status === "filled" ? { ...r, insertedValue: inserted } : r;
      });

      // Persist the outcome on the queue item (status becomes "Ready for review", never "Submitted").
      await dispatch("EXECUTE_AUTOFILL", {
        applicationId: opts.app?.id,
        detectedFields: after.context.fields,
        pageStage: after.context.pageStage === "completion_confirmed" ? "completion_confirmed" : "user_review_required",
        url: after.context.url,
        platform: after.context.platform,
      });

      const final: Partial<AutofillRunState> = {
        phase: cancelled ? "cancelled" : "done",
        step: cancelled ? "Cancelled" : "Ready for your review",
        results,
        validationIssues: after.context.validationIssues,
        processed: ids.length,
      };
      await push(final);
      return run;
    } catch (err) {
      push({
        phase: "failed",
        step: "Autofill stopped",
        error: err instanceof Error ? err.message : "Unexpected error",
      });
      return run;
    }
  })();

  return {
    cancel() {
      cancelled = true;
      run = { ...run, step: "Cancelling after the current field…" };
      opts.onUpdate(run);
    },
    done,
  };
}

/** Fills one field the user explicitly confirmed (optionally with an edited value) and verifies it. */
export async function fillSingleField(opts: {
  tab: TargetTab;
  fieldId: string;
  value: string;
  profile: SharedProfileSubset | null;
  app: AutoApplyQueueItem | null;
}): Promise<{ ok: boolean; readBack: string; message: string }> {
  const message = {
    action: "EXECUTE_AUTOFILL",
    payload: {
      sharedProfile: opts.profile,
      activeApplication: opts.app,
      approvedFieldIds: [opts.fieldId],
      onlyFieldIds: [opts.fieldId],
      overrideValues: { [opts.fieldId]: opts.value },
      applicationId: opts.app?.id,
    },
  };
  const res = await sendToTab<{ ok?: boolean; payload?: { detectedFields?: DetectedField[] } }>(opts.tab.id!, message);
  const field = res?.payload?.detectedFields?.find((f) => f.id === opts.fieldId);
  if (!res?.ok || !field) return { ok: false, readBack: "", message: "The page did not respond." };
  const ok = field.currentDomValue === opts.value;
  return {
    ok,
    readBack: field.currentDomValue,
    message: ok ? "Inserted and verified." : "The page did not keep the value. Enter it manually.",
  };
}

/** Outlines fields that need attention on the page, then scrolls the first one into view. */
export async function highlightOnPage(tab: TargetTab, items: Array<{ selector: string; status: FieldClass }>): Promise<void> {
  if (!tab.id) return;
  try {
    await sendToTab(tab.id, { careerosRequest: "HIGHLIGHT_FIELDS", payload: { items } });
  } catch {
    /* page may have navigated */
  }
}
