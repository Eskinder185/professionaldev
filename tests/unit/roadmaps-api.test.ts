import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../src/lib/api/http";
import { getRoadmap, listRoadmaps } from "../../src/lib/api/roadmaps";
import type { ApiErrorResponse, RoadmapResponse } from "../../src/lib/api/types";

const roadmap: RoadmapResponse = {
  id: "java-spring-backend",
  title: "Java and Spring Backend",
  description: "Build a tested API.",
  targetRole: "Backend Java Developer",
  estimatedWeeks: 14,
  stages: [
    {
      sequence: 1,
      title: "Modern Java",
      outcomes: ["Use records"],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiError(status: number, code: string): ApiErrorResponse {
  return {
    timestamp: "2026-10-23T21:00:00Z",
    status,
    error: status === 404 ? "Not Found" : "Request failed",
    code,
    message: `API error ${status}`,
    path: "/api/v1/roadmaps/test",
    violations: status === 400 ? [{ field: "id", message: "must be a lowercase URL slug" }] : [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("roadmap API client", () => {
  it("returns a validated roadmap collection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([roadmap]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listRoadmaps()).resolves.toEqual([roadmap]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/roadmaps",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("retrieves one roadmap from the centralized resource path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(roadmap));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRoadmap("java-spring-backend")).resolves.toEqual(roadmap);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/roadmaps/java-spring-backend", expect.any(Object));
  });

  it("maps a 400 response to a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(apiError(400, "VALIDATION_FAILED"), 400)));

    await expect(getRoadmap("INVALID_ID")).rejects.toMatchObject({
      kind: "validation",
      status: 400,
      response: { code: "VALIDATION_FAILED" },
    });
  });

  it("maps a 404 response to a missing-resource error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(apiError(404, "ROADMAP_NOT_FOUND"), 404)));

    await expect(getRoadmap("missing-roadmap")).rejects.toMatchObject({
      kind: "not-found",
      status: 404,
      response: { code: "ROADMAP_NOT_FOUND" },
    });
  });

  it("maps a 500 response to a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(apiError(500, "INTERNAL_ERROR"), 500)));

    await expect(listRoadmaps()).rejects.toMatchObject({ kind: "server", status: 500 });
  });

  it("maps a fetch rejection to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(listRoadmaps()).rejects.toMatchObject({ kind: "network" });
  });

  it("rejects a successful response that violates the DTO contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([{ id: 42 }])));

    await expect(listRoadmaps()).rejects.toMatchObject({ kind: "malformed-response" });
  });

  it("reports request cancellation explicitly", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })),
    );

    const request = listRoadmaps({ signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    await expect(request).rejects.toMatchObject({ kind: "aborted" });
  });
});
