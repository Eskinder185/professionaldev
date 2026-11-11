import { requestJson } from "./http";
import type { RoadmapResponse, RoadmapStageResponse } from "./types";

const ROADMAPS_PATH = "/api/v1/roadmaps";

interface RequestOptions {
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRoadmapStage(value: unknown): value is RoadmapStageResponse {
  return (
    isRecord(value) &&
    Number.isInteger(value.sequence) &&
    typeof value.title === "string" &&
    isStringArray(value.outcomes)
  );
}

function isRoadmap(value: unknown): value is RoadmapResponse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.targetRole === "string" &&
    Number.isInteger(value.estimatedWeeks) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRoadmapStage)
  );
}

function isRoadmapCollection(value: unknown): value is RoadmapResponse[] {
  return Array.isArray(value) && value.every(isRoadmap);
}

export function listRoadmaps(options: RequestOptions = {}): Promise<RoadmapResponse[]> {
  return requestJson(ROADMAPS_PATH, isRoadmapCollection, options.signal);
}

export function getRoadmap(id: string, options: RequestOptions = {}): Promise<RoadmapResponse> {
  return requestJson(`${ROADMAPS_PATH}/${encodeURIComponent(id)}`, isRoadmap, options.signal);
}
