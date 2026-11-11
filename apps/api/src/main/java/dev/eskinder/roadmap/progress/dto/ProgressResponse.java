package dev.eskinder.roadmap.progress.dto;

import dev.eskinder.roadmap.progress.ProgressStatus;
import java.time.Instant;

public record ProgressResponse(
		String roadmapId,
		int stageSequence,
		ProgressStatus status,
		Instant completedAt,
		Instant updatedAt,
		long version) {
}
