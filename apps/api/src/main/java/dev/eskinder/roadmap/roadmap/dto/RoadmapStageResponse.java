package dev.eskinder.roadmap.roadmap.dto;

import java.util.List;

public record RoadmapStageResponse(
		int sequence,
		String title,
		List<String> outcomes) {

	public RoadmapStageResponse {
		outcomes = List.copyOf(outcomes);
	}
}
