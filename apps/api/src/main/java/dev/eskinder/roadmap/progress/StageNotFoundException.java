package dev.eskinder.roadmap.progress;

public class StageNotFoundException extends RuntimeException {

	public StageNotFoundException(String roadmapId, int stageSequence) {
		super("Stage '%d' of roadmap '%s' was not found".formatted(stageSequence, roadmapId));
	}
}
