import {
  validateAutoApplyMessage,
  validateSharedProfileSubset,
} from "../../../../packages/careeros-shared/schemas";
import type {
  AIConnectionSnapshot,
  AutoApplyMessage,
  AutoApplyQueueItem,
  AutoApplyResponse,
  DetectedField,
  MessageAction,
  PageStage,
  QueueStatus,
  AutofillRunState,
  ResumeAnalysisSnapshot,
  ResumeVersionSummary,
  SharedProfileSubset,
  StandardProfileFieldKey,
} from "../../../../packages/careeros-shared/types";
import { getExtensionCapabilities, isAuthorizedCareerOSSender } from "../security/permissions";
import {
  clearExtensionState,
  loadExtensionState,
  saveExtensionState,
} from "../storage/stateStore";

export interface MessageSenderContext {
  url?: string;
  origin?: string;
  id?: string;
  isInternalExtensionPage?: boolean;
}

function makeOk<T>(requestId: string, action: MessageAction, data: T): AutoApplyResponse<T> {
  return {
    protocol: "careeros-autoapply",
    version: "1.0",
    requestId,
    ok: true,
    action,
    timestamp: new Date().toISOString(),
    data,
  };
}

function makeErr(
  requestId: string,
  action: MessageAction,
  code: NonNullable<AutoApplyResponse["error"]>["code"],
  message: string,
): AutoApplyResponse {
  return {
    protocol: "careeros-autoapply",
    version: "1.0",
    requestId,
    ok: false,
    action,
    timestamp: new Date().toISOString(),
    error: { code, message },
  };
}

/**
 * Handles all versioned messages between CareerOS website, extension UI (popup/sidepanel/options),
 * and background service worker.
 */
export async function handleExtensionMessage(
  rawMessage: unknown,
  sender: MessageSenderContext = {},
): Promise<AutoApplyResponse> {
  const validation = validateAutoApplyMessage(rawMessage);
  if (!validation.ok || !validation.message) {
    return makeErr(
      "invalid",
      "HANDSHAKE",
      "INVALID_SCHEMA",
      validation.error ?? "Invalid message schema.",
    );
  }

  const msg: AutoApplyMessage = validation.message;

  // Only the service worker's verified-sender flag marks a message as internal. The `origin`
  // field is attacker-controlled when a web page relays a message, so it is never trusted alone.
  if (!sender.isInternalExtensionPage) {
    const targetUrl = sender.url ?? msg.origin;
    const senderCheck = isAuthorizedCareerOSSender(targetUrl);
    if (!senderCheck.ok) {
      return makeErr(
        msg.requestId,
        msg.action,
        "INVALID_ORIGIN",
        senderCheck.reason ?? "Unauthorized sender origin.",
      );
    }
  }

  try {
    switch (msg.action) {
      case "HANDSHAKE": {
        const originCheck = sender.url
          ? isAuthorizedCareerOSSender(sender.url)
          : { ok: true, origin: msg.origin };
        const state = await saveExtensionState((prev) => ({
          ...prev,
          connectedOrigin: originCheck.origin ?? prev.connectedOrigin ?? msg.origin,
          connectedAt: new Date().toISOString(),
        }));
        return makeOk(msg.requestId, msg.action, {
          capabilities: getExtensionCapabilities(),
          connectedOrigin: state.connectedOrigin,
          connectedAt: state.connectedAt,
          queueCount: state.queue.length,
          hasSharedProfile: Boolean(state.sharedProfile),
          activeApplicationId: state.activeApplicationId,
        });
      }

      case "GET_CAPABILITIES": {
        const state = await loadExtensionState();
        return makeOk(msg.requestId, msg.action, {
          capabilities: getExtensionCapabilities(),
          state,
        });
      }

      case "TRANSFER_PROFILE": {
        const payload = msg.payload as { profile?: unknown } | undefined;
        const profValidation = validateSharedProfileSubset(payload?.profile ?? msg.payload);
        if (!profValidation.ok || !profValidation.subset) {
          return makeErr(
            msg.requestId,
            msg.action,
            "INVALID_SCHEMA",
            profValidation.error ?? "Invalid shared profile payload.",
          );
        }
        const nextState = await saveExtensionState({
          sharedProfile: profValidation.subset,
        });
        return makeOk(msg.requestId, msg.action, {
          sharedFieldCount: nextState.sharedProfile?.sharedFields.length ?? 0,
          approvedAt: nextState.sharedProfile?.approvedAt,
        });
      }

      case "IMPORT_QUEUE": {
        const payload = msg.payload as {
          queue?: AutoApplyQueueItem[];
          activeApplicationId?: string | null;
        };
        const incomingQueue = Array.isArray(payload?.queue) ? payload.queue : [];
        const nextState = await saveExtensionState((prev) => ({
          ...prev,
          queue: incomingQueue,
          activeApplicationId:
            payload?.activeApplicationId !== undefined
              ? payload.activeApplicationId
              : incomingQueue[0]?.id ?? prev.activeApplicationId,
        }));
        return makeOk(msg.requestId, msg.action, {
          queueCount: nextState.queue.length,
          activeApplicationId: nextState.activeApplicationId,
        });
      }

      case "PREPARE_APPLICATION": {
        const payload = msg.payload as {
          application?: AutoApplyQueueItem;
          applicationId?: string;
          profile?: unknown;
        };
        let validatedProfile = undefined;
        if (payload?.profile) {
          const check = validateSharedProfileSubset(payload.profile);
          if (!check.ok || !check.subset) {
            return makeErr(
              msg.requestId,
              msg.action,
              "INVALID_SCHEMA",
              check.error ?? "Invalid profile in PREPARE_APPLICATION.",
            );
          }
          validatedProfile = check.subset;
        }

        const nextState = await saveExtensionState((prev) => {
          const updatedQueue = [...prev.queue];
          let targetId =
            payload?.applicationId ?? payload?.application?.id ?? prev.activeApplicationId;
          if (payload?.application) {
            const idx = updatedQueue.findIndex((q) => q.id === payload.application!.id);
            if (idx >= 0) {
              updatedQueue[idx] = payload.application;
            } else {
              updatedQueue.unshift(payload.application);
            }
            targetId = payload.application.id;
          }
          return {
            ...prev,
            sharedProfile: validatedProfile ?? prev.sharedProfile,
            queue: updatedQueue,
            activeApplicationId: targetId,
          };
        });

        const activeApp =
          nextState.queue.find((q) => q.id === nextState.activeApplicationId) ?? null;

        return makeOk(msg.requestId, msg.action, {
          activeApplication: activeApp,
          hasSharedProfile: Boolean(nextState.sharedProfile),
        });
      }

      case "GET_APPLICATION_STATUS": {
        const state = await loadExtensionState();
        const activeApp =
          state.queue.find((q) => q.id === state.activeApplicationId) ?? state.queue[0] ?? null;
        return makeOk(msg.requestId, msg.action, {
          activeApplicationId: state.activeApplicationId,
          activeApplication: activeApp,
          queue: state.queue,
          currentPageStage: state.currentPageStage,
          currentDetectedFields: state.currentDetectedFields,
          currentTabUrl: state.currentTabUrl,
          currentTabPlatform: state.currentTabPlatform,
          hasSharedProfile: Boolean(state.sharedProfile),
          sharedProfile: state.sharedProfile,
        });
      }

      case "UPDATE_APPLICATION_STATUS": {
        const payload = msg.payload as {
          applicationId?: string;
          status?: QueueStatus;
          pageStage?: PageStage;
          detectedFields?: DetectedField[];
          submittedAt?: string;
          confirmationText?: string;
          notes?: string;
          currentTabUrl?: string;
          currentTabPlatform?: string;
        };
        const nextState = await saveExtensionState((prev) => {
          const targetId = payload?.applicationId ?? prev.activeApplicationId;
          const nextQueue = prev.queue.map((item) => {
            if (item.id !== targetId) return item;
            const nextStatus = payload.status ?? item.status;
            return {
              ...item,
              status: nextStatus,
              pageStage: payload.pageStage ?? item.pageStage,
              detectedFields: payload.detectedFields ?? item.detectedFields,
              notes: payload.notes !== undefined ? payload.notes : item.notes,
              confirmationText: payload.confirmationText ?? item.confirmationText,
              submittedAt:
                nextStatus === "Submitted and verified"
                  ? payload.submittedAt ?? new Date().toISOString()
                  : item.submittedAt,
              updatedAt: new Date().toISOString(),
            };
          });
          return {
            ...prev,
            queue: nextQueue,
            currentPageStage: payload.pageStage ?? prev.currentPageStage,
            currentDetectedFields: payload.detectedFields ?? prev.currentDetectedFields,
            currentTabUrl: payload.currentTabUrl ?? prev.currentTabUrl,
            currentTabPlatform: payload.currentTabPlatform ?? prev.currentTabPlatform,
          };
        });

        const updatedItem =
          nextState.queue.find(
            (q) => q.id === (payload?.applicationId ?? nextState.activeApplicationId),
          ) ?? null;

        return makeOk(msg.requestId, msg.action, {
          application: updatedItem,
          queue: nextState.queue,
        });
      }

      case "CLEAR_SHARED_DATA": {
        await clearExtensionState();
        return makeOk(msg.requestId, msg.action, {
          cleared: true,
          clearedAt: new Date().toISOString(),
        });
      }

      case "INSPECT_CURRENT_FORM":
      case "EXECUTE_AUTOFILL":
      case "CONFIRM_SUBMISSION": {
        const payload = (msg.payload ?? {}) as {
          detectedFields?: DetectedField[];
          pageStage?: PageStage;
          url?: string;
          platform?: string;
          confirmed?: boolean;
          confirmationText?: string;
          applicationId?: string;
        };

        const nextState = await saveExtensionState((prev) => {
          const targetId = payload.applicationId ?? prev.activeApplicationId;
          const nextStage: PageStage =
            msg.action === "CONFIRM_SUBMISSION" && payload.confirmed
              ? "completion_confirmed"
              : payload.pageStage ?? prev.currentPageStage;

          const nextStatus: QueueStatus | undefined =
            msg.action === "CONFIRM_SUBMISSION" && payload.confirmed
              ? "Submitted and verified"
              : msg.action === "EXECUTE_AUTOFILL"
                ? "Ready for review"
                : undefined;

          const nextQueue = prev.queue.map((item) => {
            if (item.id !== targetId) return item;
            return {
              ...item,
              status: nextStatus ?? item.status,
              pageStage: nextStage,
              detectedFields: payload.detectedFields ?? item.detectedFields,
              confirmationText: payload.confirmationText ?? item.confirmationText,
              submittedAt:
                nextStatus === "Submitted and verified"
                  ? new Date().toISOString()
                  : item.submittedAt,
              updatedAt: new Date().toISOString(),
            };
          });

          return {
            ...prev,
            queue: nextQueue,
            currentPageStage: nextStage,
            currentDetectedFields: payload.detectedFields ?? prev.currentDetectedFields,
            currentTabUrl: payload.url ?? prev.currentTabUrl,
            currentTabPlatform: payload.platform ?? prev.currentTabPlatform,
          };
        });

        const activeApp =
          nextState.queue.find((q) => q.id === nextState.activeApplicationId) ?? null;

        return makeOk(msg.requestId, msg.action, {
          activeApplication: activeApp,
          pageStage: nextState.currentPageStage,
          detectedFields: nextState.currentDetectedFields,
          confirmed: Boolean(payload.confirmed),
        });
      }

      case "SYNC_ANALYSIS": {
        const payload = (msg.payload ?? {}) as {
          resumeVersions?: ResumeVersionSummary[];
          analyses?: ResumeAnalysisSnapshot[];
          aiConnection?: AIConnectionSnapshot | null;
          selectResume?: { applicationId: string; versionId: string };
        };
        if (/"apiKey"\s*:|sk-[a-zA-Z0-9]{16,}/i.test(JSON.stringify(payload))) {
          return makeErr(
            msg.requestId,
            msg.action,
            "INVALID_SCHEMA",
            "API keys and credentials must never be included in analysis sync.",
          );
        }
        const analyses = Array.isArray(payload.analyses) ? payload.analyses : [];
        const bad = analyses.find(
          (a) =>
            !a ||
            typeof a.applicationId !== "string" ||
            typeof a.resumeVersionId !== "string" ||
            typeof a.score !== "number" ||
            !Array.isArray(a.requirements),
        );
        if (bad) {
          return makeErr(msg.requestId, msg.action, "INVALID_SCHEMA", "Malformed analysis snapshot.");
        }
        const nextState = await saveExtensionState((prev) => {
          const merged = { ...prev.analyses };
          for (const a of analyses) {
            merged[a.applicationId] = { ...(merged[a.applicationId] ?? {}), [a.resumeVersionId]: a };
          }
          const versions = Array.isArray(payload.resumeVersions)
            ? payload.resumeVersions
            : prev.resumeVersions;
          const pick = payload.selectResume;
          const pickedVersion = pick ? versions.find((v) => v.id === pick.versionId) : undefined;
          return {
            ...prev,
            analyses: merged,
            queue:
              pick && pickedVersion
                ? prev.queue.map((q) =>
                    q.id === pick.applicationId
                      ? {
                          ...q,
                          selectedResumeId: pickedVersion.id,
                          selectedResumeName: pickedVersion.name,
                          resumeFitsOnePage: pickedVersion.fitsOnePage,
                          updatedAt: new Date().toISOString(),
                        }
                      : q,
                  )
                : prev.queue,
            resumeVersions: versions,
            aiConnection:
              payload.aiConnection !== undefined ? payload.aiConnection : prev.aiConnection,
            lastSyncedAt: new Date().toISOString(),
          };
        });
        return makeOk(msg.requestId, msg.action, {
          analysisCount: Object.values(nextState.analyses).reduce(
            (n, byVersion) => n + Object.keys(byVersion).length,
            0,
          ),
          lastSyncedAt: nextState.lastSyncedAt,
        });
      }

      case "SYNC_AI_CONFIGURATION": {
        const payload = (msg.payload ?? {}) as {
          aiConnection?: AIConnectionSnapshot | null;
        };
        if (/"apiKey"\s*:|sk-[a-zA-Z0-9-]{12,}|AIza[0-9A-Za-z_-]{20,}/i.test(JSON.stringify(payload))) {
          return makeErr(
            msg.requestId,
            msg.action,
            "INVALID_SCHEMA",
            "API keys and credentials must never be included in AI configuration sync.",
          );
        }
        const incoming = payload.aiConnection ?? (msg.payload as AIConnectionSnapshot | null);
        const nextState = await saveExtensionState((prev) => ({
          ...prev,
          aiConnection: incoming
            ? {
                provider: String(incoming.provider ?? prev.aiConnection?.provider ?? "ollama"),
                providerLabel: String(incoming.providerLabel ?? prev.aiConnection?.providerLabel ?? "Ollama (Local)"),
                baseUrl: String(incoming.baseUrl ?? prev.aiConnection?.baseUrl ?? "http://127.0.0.1:11434/v1"),
                model: String(incoming.model ?? prev.aiConnection?.model ?? ""),
                connected: Boolean(incoming.connected),
                isLocal: Boolean(incoming.isLocal),
                keyless: Boolean(incoming.keyless),
                localOnlyMode:
                  typeof incoming.localOnlyMode === "boolean"
                    ? incoming.localOnlyMode
                    : prev.aiConnection?.localOnlyMode ?? false,
                taskModels:
                  incoming.taskModels && typeof incoming.taskModels === "object"
                    ? incoming.taskModels
                    : prev.aiConnection?.taskModels ?? {},
                credentialMode: incoming.credentialMode ?? prev.aiConnection?.credentialMode,
                credentialBadge: incoming.credentialBadge ?? prev.aiConnection?.credentialBadge,
                capabilities: Array.isArray(incoming.capabilities)
                  ? incoming.capabilities
                  : prev.aiConnection?.capabilities,
                discoveredModels: Array.isArray(incoming.discoveredModels)
                  ? incoming.discoveredModels
                  : prev.aiConnection?.discoveredModels,
                updatedAt: new Date().toISOString(),
              }
            : null,
          lastSyncedAt: new Date().toISOString(),
        }));
        return makeOk(msg.requestId, msg.action, {
          aiConnection: nextState.aiConnection,
          lastSyncedAt: nextState.lastSyncedAt,
        });
      }

      case "GET_AI_CONFIGURATION": {
        const state = await loadExtensionState();
        return makeOk(msg.requestId, msg.action, {
          aiConnection: state.aiConnection,
          lastSyncedAt: state.lastSyncedAt,
        });
      }

      case "SET_SELECTED_RESUME": {
        if (!sender.isInternalExtensionPage) {
          return makeErr(msg.requestId, msg.action, "UNAUTHORIZED", "Internal extension pages only.");
        }
        const payload = (msg.payload ?? {}) as { applicationId?: string; versionId?: string };
        const nextState = await saveExtensionState((prev) => {
          const version = prev.resumeVersions.find((v) => v.id === payload.versionId);
          if (!version) return prev;
          return {
            ...prev,
            queue: prev.queue.map((q) =>
              q.id === payload.applicationId
                ? {
                    ...q,
                    selectedResumeId: version.id,
                    selectedResumeName: version.name,
                    resumeFitsOnePage: version.fitsOnePage,
                    updatedAt: new Date().toISOString(),
                  }
                : q,
            ),
          };
        });
        const item = nextState.queue.find((q) => q.id === payload.applicationId) ?? null;
        if (!item || item.selectedResumeId !== payload.versionId) {
          return makeErr(
            msg.requestId,
            msg.action,
            "EXECUTION_ERROR",
            "Unknown application or résumé version. Sync from CareerOS first.",
          );
        }
        return makeOk(msg.requestId, msg.action, { application: item });
      }

      case "UPDATE_SHARED_PROFILE": {
        if (!sender.isInternalExtensionPage) {
          return makeErr(msg.requestId, msg.action, "UNAUTHORIZED", "Internal extension pages only.");
        }
        const payload = (msg.payload ?? {}) as {
          values?: Partial<Record<StandardProfileFieldKey, string>>;
          removeFields?: StandardProfileFieldKey[];
          skills?: string[];
          certifications?: string[];
          clearSections?: Array<"education" | "experience" | "skills" | "certifications" | "answers">;
          removeAnswerIds?: string[];
        };
        const nextState = await saveExtensionState((prev) => {
          const base: SharedProfileSubset = prev.sharedProfile ?? {
            approvedAt: new Date().toISOString(),
            sharedFields: [],
            values: {},
          };
          const values = { ...base.values };
          const shared = new Set<StandardProfileFieldKey>(base.sharedFields);
          const unconfirmed = new Set(prev.unconfirmedProfileFields);
          for (const [k, v] of Object.entries(payload.values ?? {})) {
            if (typeof v !== "string") continue;
            values[k as StandardProfileFieldKey] = v;
            shared.add(k as StandardProfileFieldKey);
            unconfirmed.add(k);
          }
          for (const k of payload.removeFields ?? []) {
            delete values[k];
            shared.delete(k);
            unconfirmed.delete(k);
          }
          const next: SharedProfileSubset = { ...base, values, sharedFields: [...shared] };
          if (Array.isArray(payload.skills)) {
            next.skills = payload.skills.filter((x) => typeof x === "string");
            unconfirmed.add("skills");
          }
          if (Array.isArray(payload.certifications)) {
            next.certifications = payload.certifications.filter((x) => typeof x === "string");
            unconfirmed.add("certifications");
          }
          for (const section of payload.clearSections ?? []) {
            if (section === "education") next.education = [];
            if (section === "experience") next.experience = [];
            if (section === "skills") next.skills = [];
            if (section === "certifications") next.certifications = [];
            if (section === "answers") next.preparedAnswers = {};
            unconfirmed.delete(section);
          }
          if (payload.removeAnswerIds?.length && next.preparedAnswers) {
            const answers = { ...next.preparedAnswers };
            for (const id of payload.removeAnswerIds) delete answers[id];
            next.preparedAnswers = answers;
          }
          return { ...prev, sharedProfile: next, unconfirmedProfileFields: [...unconfirmed] };
        });
        return makeOk(msg.requestId, msg.action, {
          sharedFieldCount: nextState.sharedProfile?.sharedFields.length ?? 0,
          unconfirmedProfileFields: nextState.unconfirmedProfileFields,
        });
      }

      case "UPDATE_AUTOFILL_RUN": {
        if (!sender.isInternalExtensionPage) {
          return makeErr(msg.requestId, msg.action, "UNAUTHORIZED", "Internal extension pages only.");
        }
        const run = (msg.payload as { run?: AutofillRunState | null } | undefined)?.run ?? null;
        await saveExtensionState((prev) => ({ ...prev, autofillRun: run }));
        return makeOk(msg.requestId, msg.action, { stored: Boolean(run) });
      }

      default:
        return makeErr(
          msg.requestId,
          msg.action,
          "UNSUPPORTED_ACTION",
          `Unhandled action: ${String(msg.action)}`,
        );
    }
  } catch (err) {
    return makeErr(
      msg.requestId,
      msg.action,
      "EXECUTION_ERROR",
      err instanceof Error ? err.message : "Unexpected extension error",
    );
  }
}
