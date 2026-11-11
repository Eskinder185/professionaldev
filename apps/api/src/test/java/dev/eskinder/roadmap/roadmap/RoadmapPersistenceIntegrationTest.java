package dev.eskinder.roadmap.roadmap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.eskinder.roadmap.roadmap.dto.RoadmapResponse;
import dev.eskinder.roadmap.roadmap.dto.RoadmapStageResponse;
import dev.eskinder.roadmap.support.PostgresIntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import java.util.List;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class RoadmapPersistenceIntegrationTest extends PostgresIntegrationTest {

	@Autowired
	private RoadmapService roadmapService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@Test
	void appliesFlywayMigrationsToAnEmptyPostgresDatabase() {
		List<String> versions = jdbcTemplate.queryForList(
				"select version from flyway_schema_history where success order by installed_rank",
				String.class);

		assertThat(versions).containsExactly("1", "2", "3", "4");
		assertThat(jdbcTemplate.queryForObject("select count(*) from roadmaps", Integer.class)).isEqualTo(3);
		assertThat(jdbcTemplate.queryForObject("select count(*) from roadmap_stages", Integer.class)).isEqualTo(9);
		assertThat(jdbcTemplate.queryForObject("select count(*) from stage_outcomes", Integer.class)).isEqualTo(18);
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from application_users where issuer = 'local-dev'", Integer.class)).isEqualTo(2);
		assertThat(jdbcTemplate.queryForList(
				"select issuer from application_users where issuer = 'local-dev' order by subject", String.class))
				.containsOnly("local-dev");
	}

	@Test
	void exposesTheExactSeededCatalogAndOrdering() {
		assertThat(roadmapService.findAll()).containsExactly(
				new RoadmapResponse(
						"aws-solutions-architect-associate",
						"AWS Solutions Architect - Associate",
						"Build practical AWS architecture skills and prepare for the associate certification.",
						"Cloud Engineer",
						12,
						List.of(
								new RoadmapStageResponse(1, "Cloud foundations", List.of("Explain IAM and shared responsibility", "Use core AWS terminology")),
								new RoadmapStageResponse(2, "Architecture labs", List.of("Build a VPC and EC2 workload", "Host a static site in S3")),
								new RoadmapStageResponse(3, "Exam readiness", List.of("Review architecture tradeoffs", "Complete timed practice exams")))),
				new RoadmapResponse(
						"comptia-security-plus",
						"CompTIA Security+",
						"Develop security fundamentals through domain study and hands-on analysis.",
						"Cybersecurity Analyst",
						10,
						List.of(
								new RoadmapStageResponse(1, "Security concepts", List.of("Identify common threats", "Explain security controls")),
								new RoadmapStageResponse(2, "Operations labs", List.of("Inspect network traffic with Wireshark", "Practice introductory SIEM searches")),
								new RoadmapStageResponse(3, "Exam readiness", List.of("Map gaps to exam objectives", "Complete performance-based practice")))),
				new RoadmapResponse(
						"java-spring-backend",
						"Java and Spring Backend",
						"Progress from Java language fundamentals to a tested Spring Boot REST API.",
						"Backend Java Developer",
						14,
						List.of(
								new RoadmapStageResponse(1, "Modern Java", List.of("Model data with classes and records", "Use collections and exceptions")),
								new RoadmapStageResponse(2, "Spring Boot", List.of("Build controller and service layers", "Use dependency injection")),
								new RoadmapStageResponse(3, "API quality", List.of("Test business and HTTP behavior", "Document API contracts")))));
	}

	@Test
	void enforcesUniqueSlugsAndForeignKeys() {
		assertThatThrownBy(() -> jdbcTemplate.update(
				"insert into roadmaps (slug, title, description, target_role, estimated_weeks) values (?, ?, ?, ?, ?)",
				"java-spring-backend", "Duplicate", "Duplicate", "Duplicate", 1))
				.isInstanceOf(DataAccessException.class);

		assertThatThrownBy(() -> jdbcTemplate.update(
				"insert into roadmap_stages (roadmap_id, stage_order, title) values (?, ?, ?)",
				Long.MAX_VALUE, 1, "Orphan"))
				.isInstanceOf(DataAccessException.class);
	}

	@Test
	void loadsTheNestedCatalogWithOneSelectInsteadOfNPlusOneQueries() {
		Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.clear();

		assertThat(roadmapService.findAll()).hasSize(3);

		assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
	}
}
