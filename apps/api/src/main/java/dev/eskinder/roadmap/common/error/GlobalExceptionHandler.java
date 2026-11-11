package dev.eskinder.roadmap.common.error;

import dev.eskinder.roadmap.roadmap.RoadmapNotFoundException;
import dev.eskinder.roadmap.progress.ProgressConflictException;
import dev.eskinder.roadmap.progress.ProgressPrincipalNotFoundException;
import dev.eskinder.roadmap.progress.StageNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(StageNotFoundException.class)
	public ResponseEntity<ApiError> handleStageNotFound(StageNotFoundException exception, HttpServletRequest request) {
		return buildResponse(HttpStatus.NOT_FOUND, "STAGE_NOT_FOUND", exception.getMessage(), request.getRequestURI(), List.of());
	}

	@ExceptionHandler(ProgressPrincipalNotFoundException.class)
	public ResponseEntity<ApiError> handlePrincipalNotFound(
			ProgressPrincipalNotFoundException exception,
			HttpServletRequest request) {
		return buildResponse(HttpStatus.FORBIDDEN, "PRINCIPAL_NOT_PROVISIONED", exception.getMessage(), request.getRequestURI(), List.of());
	}

	@ExceptionHandler(ProgressConflictException.class)
	public ResponseEntity<ApiError> handleProgressConflict(
			ProgressConflictException exception,
			HttpServletRequest request) {
		return buildResponse(HttpStatus.CONFLICT, "PROGRESS_CONFLICT", exception.getMessage(), request.getRequestURI(), List.of());
	}

	@ExceptionHandler(RoadmapNotFoundException.class)
	public ResponseEntity<ApiError> handleRoadmapNotFound(
			RoadmapNotFoundException exception,
			HttpServletRequest request) {
		return buildResponse(
				HttpStatus.NOT_FOUND,
				"ROADMAP_NOT_FOUND",
				exception.getMessage(),
				request.getRequestURI(),
				List.of());
	}

	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ApiError> handleConstraintViolation(
			ConstraintViolationException exception,
			HttpServletRequest request) {
		List<ValidationError> violations = exception.getConstraintViolations().stream()
				.map(violation -> new ValidationError(
						lastPathSegment(violation.getPropertyPath().toString()),
						violation.getMessage()))
				.toList();

		return buildResponse(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"Request validation failed",
				request.getRequestURI(),
				violations);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiError> handleMethodArgumentNotValid(
			MethodArgumentNotValidException exception,
			HttpServletRequest request) {
		List<ValidationError> violations = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> new ValidationError(error.getField(), error.getDefaultMessage()))
				.toList();
		return buildResponse(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"Request validation failed",
				request.getRequestURI(),
				violations);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiError> handleUnreadableMessage(
			HttpMessageNotReadableException exception,
			HttpServletRequest request) {
		return buildResponse(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"Request body is malformed or contains an unsupported value",
				request.getRequestURI(),
				List.of());
	}

	private ResponseEntity<ApiError> buildResponse(
			HttpStatus status,
			String code,
			String message,
			String path,
			List<ValidationError> violations) {
		ApiError error = new ApiError(
				Instant.now(),
				status.value(),
				status.getReasonPhrase(),
				code,
				message,
				path,
				violations);
		return ResponseEntity.status(status).body(error);
	}

	private String lastPathSegment(String propertyPath) {
		int separator = propertyPath.lastIndexOf('.');
		return separator >= 0 ? propertyPath.substring(separator + 1) : propertyPath;
	}
}
