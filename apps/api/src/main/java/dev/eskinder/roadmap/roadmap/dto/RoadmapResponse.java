package dev.eskinder.roadmap.roadmap.dto;

import java.util.List;

public record RoadmapResponse(
		String id,
		String title,
		String description,
		String targetRole,
		int estimatedWeeks,
		List<RoadmapStageResponse> stages) {

	public RoadmapResponse {
		stages = List.copyOf(stages);
	}
}
