package dev.eskinder.roadmap.progress.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserStageProgressRepository extends JpaRepository<UserStageProgressEntity, Long> {

	@EntityGraph(attributePaths = {"stage", "stage.roadmap"})
	@Query("""
			select progress from UserStageProgressEntity progress
			where progress.user.issuer = :issuer and progress.user.subject = :subject
			order by progress.stage.roadmap.id, progress.stage.sequence
			""")
	List<UserStageProgressEntity> findAllForIdentity(
			@Param("issuer") String issuer,
			@Param("subject") String subject);

	@EntityGraph(attributePaths = {"stage", "stage.roadmap"})
	@Query("""
			select progress from UserStageProgressEntity progress
			where progress.user.issuer = :issuer
			  and progress.user.subject = :subject
			  and progress.stage.id = :stageId
			""")
	Optional<UserStageProgressEntity> findForIdentityAndStageId(
			@Param("issuer") String issuer,
			@Param("subject") String subject,
			@Param("stageId") long stageId);
}
