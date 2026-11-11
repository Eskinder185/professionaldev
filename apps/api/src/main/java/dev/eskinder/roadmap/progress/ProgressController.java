package dev.eskinder.roadmap.progress;

import dev.eskinder.roadmap.progress.dto.ProgressResponse;
import dev.eskinder.roadmap.progress.dto.UpsertProgressRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import java.security.Principal;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;
import dev.eskinder.roadmap.security.CurrentIdentityResolver;

@Validated
@RestController
@RequestMapping("/api/v1/progress")
public class ProgressController {

	private static final String ROADMAP_ID_PATTERN = "[a-z0-9]+(?:-[a-z0-9]+)*";

	private final ProgressService progressService;
	private final CurrentIdentityResolver identityResolver;

	public ProgressController(ProgressService progressService, CurrentIdentityResolver identityResolver) {
		this.progressService = progressService;
		this.identityResolver = identityResolver;
	}

	@GetMapping
	public List<ProgressResponse> getProgress(Authentication authentication) {
		return progressService.findAllForIdentity(identityResolver.resolve(authentication));
	}

	@PutMapping("/roadmaps/{roadmapId}/stages/{stageSequence}")
	public ResponseEntity<ProgressResponse> putProgress(
			Authentication authentication,
			@PathVariable
			@jakarta.validation.constraints.Pattern(
					regexp = ROADMAP_ID_PATTERN,
					message = "must be a lowercase URL slug")
			String roadmapId,
			@PathVariable @Positive int stageSequence,
			@Valid @RequestBody UpsertProgressRequest request) {
		ProgressWriteResult result = progressService.upsert(
				identityResolver.resolve(authentication), roadmapId, stageSequence, request);
		if (result.created()) {
			return ResponseEntity.created(URI.create(
					"/api/v1/progress/roadmaps/" + roadmapId + "/stages/" + stageSequence))
					.body(result.response());
		}
		return ResponseEntity.ok(result.response());
	}
}
