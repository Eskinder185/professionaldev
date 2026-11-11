package dev.eskinder.roadmap.security;

import dev.eskinder.roadmap.common.error.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
class SecurityErrorWriter {

	private final ObjectMapper objectMapper;

	SecurityErrorWriter(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code, String message)
			throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), new ApiError(
				Instant.now(), status.value(), status.getReasonPhrase(), code, message,
				request.getRequestURI(), List.of()));
	}
}
