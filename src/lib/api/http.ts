import type { ApiErrorResponse } from "./types";

export type ApiErrorKind =
  | "validation"
  | "not-found"
  | "server"
  | "http"
  | "network"
  | "malformed-response"
  | "aborted";

export class ApiClientError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly response?: ApiErrorResponse,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ResponseValidator<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidationError(value: unknown): boolean {
  return isRecord(value) && typeof value.field === "string" && typeof value.message === "string";
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    typeof value.timestamp === "string" &&
    typeof value.status === "number" &&
    typeof value.error === "string" &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.path === "string" &&
    Array.isArray(value.violations) &&
    value.violations.every(isValidationError)
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorKindForStatus(status: number): ApiErrorKind {
  if (status === 400) return "validation";
  if (status === 404) return "not-found";
  if (status >= 500) return "server";
  return "http";
}

function isAbortFailure(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === "AbortError");
}

export async function requestJson<T>(
  path: string,
  validate: ResponseValidator<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (isAbortFailure(error, signal)) {
      throw new ApiClientError("aborted", "Request was cancelled", undefined, undefined, error);
    }

    throw new ApiClientError("network", "Unable to reach the roadmap API", undefined, undefined, error);
  }

  const body = await readJson(response);

  if (!response.ok) {
    const apiError = isApiErrorResponse(body) ? body : undefined;
    throw new ApiClientError(
      errorKindForStatus(response.status),
      apiError?.message ?? `Roadmap API request failed with status ${response.status}`,
      response.status,
      apiError,
    );
  }

  if (!validate(body)) {
    throw new ApiClientError(
      "malformed-response",
      "Roadmap API returned data that does not match its contract",
      response.status,
    );
  }

  return body;
}
