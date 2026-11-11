export interface RoadmapStageResponse {
  sequence: number;
  title: string;
  outcomes: string[];
}

export interface RoadmapResponse {
  id: string;
  title: string;
  description: string;
  targetRole: string;
  estimatedWeeks: number;
  stages: RoadmapStageResponse[];
}

export interface ValidationErrorResponse {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  violations: ValidationErrorResponse[];
}
