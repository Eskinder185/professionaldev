package dev.eskinder.roadmap.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.eskinder.roadmap.progress.dto.UpsertProgressRequest;
import dev.eskinder.roadmap.support.PostgresIntegrationTest;
import dev.eskinder.roadmap.security.AuthenticatedIdentity;
import dev.eskinder.roadmap.support.OidcTestIssuer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class ProgressPersistenceIntegrationTest extends PostgresIntegrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ProgressService progressService;

	private long userId;
	private long stageId;

	@BeforeEach
	void setUp() {
		jdbcTemplate.update("delete from user_stage_progress");
		userId = jdbcTemplate.queryForObject(
				"select id from application_users where issuer = 'local-dev' and subject = 'learner'", Long.class);
		stageId = jdbcTemplate.queryForObject("select min(id) from roadmap_stages", Long.class);
	}

	@Test
	void enforcesStatusForeignKeyAndUniqueProgressConstraints() {
		assertThatThrownBy(() -> insertProgress(userId, stageId, "INVALID"))
				.isInstanceOf(DataAccessException.class);
		assertThatThrownBy(() -> insertProgress(userId, Long.MAX_VALUE, "IN_PROGRESS"))
				.isInstanceOf(DataAccessException.class);
		assertThatThrownBy(() -> insertProgress(userId, stageId, "COMPLETED"))
				.isInstanceOf(DataAccessException.class);

		insertProgress(userId, stageId, "IN_PROGRESS");
		assertThatThrownBy(() -> insertProgress(userId, stageId, "NOT_STARTED"))
				.isInstanceOf(DataAccessException.class);
	}

	@Test
	void rollsBackFailedWriteWithoutLeavingPartialProgress() {
		assertThatThrownBy(() -> progressService.upsert(
				new AuthenticatedIdentity(OidcTestIssuer.ISSUER, LEARNER_SUBJECT),
				"missing-roadmap",
				1,
				new UpsertProgressRequest(ProgressStatus.IN_PROGRESS, null)))
				.isInstanceOf(StageNotFoundException.class);

		assertThat(jdbcTemplate.queryForObject("select count(*) from user_stage_progress", Integer.class)).isZero();
	}

	private void insertProgress(long targetUserId, long targetStageId, String status) {
		jdbcTemplate.update("""
				insert into user_stage_progress (user_id, stage_id, status, completed_at, updated_at, version)
				values (?, ?, ?, null, current_timestamp, 0)
				""", targetUserId, targetStageId, status);
	}
}
