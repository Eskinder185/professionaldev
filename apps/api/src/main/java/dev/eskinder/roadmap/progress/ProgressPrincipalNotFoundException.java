package dev.eskinder.roadmap.progress;

public class ProgressPrincipalNotFoundException extends RuntimeException {

	public ProgressPrincipalNotFoundException(String subject) {
		super("Authenticated subject '%s' is not provisioned".formatted(subject));
	}
}
