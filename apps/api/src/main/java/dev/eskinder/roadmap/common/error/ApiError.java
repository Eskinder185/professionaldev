package dev.eskinder.roadmap.common.error;

import java.time.Instant;
import java.util.List;

public record ApiError(
		Instant timestamp,
		int status,
		String error,
		String code,
		String message,
		String path,
		List<ValidationError> violations) {

	public ApiError {
		violations = List.copyOf(violations);
	}
}
