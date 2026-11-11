package dev.eskinder.roadmap.roadmap.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RoadmapRepository extends JpaRepository<RoadmapEntity, Long> {

	@EntityGraph(attributePaths = {"stages", "stages.outcomes"})
	@Query("select distinct roadmap from RoadmapEntity roadmap order by roadmap.id")
	List<RoadmapEntity> findAllWithStagesAndOutcomes();

	@EntityGraph(attributePaths = {"stages", "stages.outcomes"})
	Optional<RoadmapEntity> findBySlug(String slug);
}
