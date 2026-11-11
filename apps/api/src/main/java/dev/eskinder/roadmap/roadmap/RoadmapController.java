package dev.eskinder.roadmap.roadmap;

import dev.eskinder.roadmap.roadmap.dto.RoadmapResponse;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/roadmaps")
public class RoadmapController {

	private static final String ROADMAP_ID_PATTERN = "[a-z0-9]+(?:-[a-z0-9]+)*";
	private final RoadmapService roadmapService;

	public RoadmapController(RoadmapService roadmapService) {
		this.roadmapService = roadmapService;
	}

	@GetMapping
	public List<RoadmapResponse> getRoadmaps() {
		return roadmapService.findAll();
	}

	@GetMapping("/{id}")
	public RoadmapResponse getRoadmap(
			@PathVariable
			@Pattern(regexp = ROADMAP_ID_PATTERN, message = "must be a lowercase URL slug")
			String id) {
		return roadmapService.findById(id);
	}
}
