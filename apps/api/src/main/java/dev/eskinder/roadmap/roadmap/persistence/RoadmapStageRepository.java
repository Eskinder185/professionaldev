package dev.eskinder.roadmap.roadmap.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoadmapStageRepository extends JpaRepository<RoadmapStageEntity, Long> {

	@Query("""
			select stage from RoadmapStageEntity stage
			join fetch stage.roadmap roadmap
			where roadmap.slug = :roadmapId and stage.sequence = :stageSequence
			""")
	Optional<RoadmapStageEntity> findByRoadmapIdAndSequence(
			@Param("roadmapId") String roadmapId,
			@Param("stageSequence") int stageSequence);
}
