package dev.eskinder.roadmap.roadmap;

import dev.eskinder.roadmap.roadmap.dto.RoadmapResponse;
import dev.eskinder.roadmap.roadmap.dto.RoadmapStageResponse;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapEntity;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapRepository;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapStageEntity;
import dev.eskinder.roadmap.roadmap.persistence.StageOutcomeEntity;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoadmapService {

	private final RoadmapRepository roadmapRepository;

	public RoadmapService(RoadmapRepository roadmapRepository) {
		this.roadmapRepository = roadmapRepository;
	}

	@Transactional(readOnly = true)
	public List<RoadmapResponse> findAll() {
		return roadmapRepository.findAllWithStagesAndOutcomes().stream()
				.map(this::toResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public RoadmapResponse findById(String id) {
		return roadmapRepository.findBySlug(id)
				.map(this::toResponse)
				.orElseThrow(() -> new RoadmapNotFoundException(id));
	}

	private RoadmapResponse toResponse(RoadmapEntity roadmap) {
		List<RoadmapStageResponse> stages = roadmap.getStages().stream()
				.sorted(Comparator.comparingInt(RoadmapStageEntity::getSequence))
				.map(stage -> new RoadmapStageResponse(
						stage.getSequence(),
						stage.getTitle(),
						stage.getOutcomes().stream()
								.sorted(Comparator.comparingInt(StageOutcomeEntity::getSequence))
								.map(StageOutcomeEntity::getText)
								.toList()))
				.toList();

		return new RoadmapResponse(
				roadmap.getSlug(),
				roadmap.getTitle(),
				roadmap.getDescription(),
				roadmap.getTargetRole(),
				roadmap.getEstimatedWeeks(),
				stages);
	}
}
