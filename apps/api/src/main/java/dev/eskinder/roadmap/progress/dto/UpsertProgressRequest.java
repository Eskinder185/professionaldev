package dev.eskinder.roadmap.progress.dto;

import dev.eskinder.roadmap.progress.ProgressStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record UpsertProgressRequest(
		@NotNull ProgressStatus status,
		@PositiveOrZero Long version) {
}
