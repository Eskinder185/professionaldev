package dev.eskinder.roadmap.roadmap;

public class RoadmapNotFoundException extends RuntimeException {

	public RoadmapNotFoundException(String id) {
		super("Roadmap '%s' was not found".formatted(id));
	}
}
