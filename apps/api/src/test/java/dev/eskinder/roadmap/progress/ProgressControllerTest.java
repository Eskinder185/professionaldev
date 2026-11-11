package dev.eskinder.roadmap.progress;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.eskinder.roadmap.support.OidcTestIssuer;
import dev.eskinder.roadmap.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class ProgressControllerTest extends PostgresIntegrationTest {

	private static final String JAVA_ROADMAP_ID = "java-spring-backend";
	private static final int JAVA_STAGE_SEQUENCE = 1;

	@Autowired
	private WebApplicationContext applicationContext;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		jdbcTemplate.update("delete from user_stage_progress");
		jdbcTemplate.update("delete from application_users where issuer <> 'local-dev'");
		mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).apply(springSecurity()).build();
	}

	@Test
	void keepsCatalogReadsPublicAndProtectsProgress() throws Exception {
		mockMvc.perform(get("/api/v1/roadmaps")).andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/progress"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("WWW-Authenticate", "Bearer"))
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"IN_PROGRESS\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void acceptsValidBearerTokenAndCreatesThenUpdatesProgress() throws Exception {
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"IN_PROGRESS\"}"))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", "/api/v1/progress/roadmaps/java-spring-backend/stages/1"))
				.andExpect(jsonPath("$.status").value("IN_PROGRESS"))
				.andExpect(jsonPath("$.version").value(0));

		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"COMPLETED\",\"version\":0}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("COMPLETED"))
				.andExpect(jsonPath("$.completedAt").isNotEmpty())
				.andExpect(jsonPath("$.version").value(1));
	}

	@Test
	void rejectsInvalidSignatureIssuerAudienceAndExpiration() throws Exception {
		assertUnauthorized(OidcTestIssuer.tokenWithInvalidSignature(LEARNER_SUBJECT));
		assertUnauthorized(OidcTestIssuer.tokenWithIssuer("https://wrong-issuer.example", LEARNER_SUBJECT));
		assertUnauthorized(OidcTestIssuer.tokenWithAudience("wrong-audience", LEARNER_SUBJECT));
		assertUnauthorized(OidcTestIssuer.expiredToken(LEARNER_SUBJECT));
	}

	@Test
	void disablesLocalBasicAuthenticationOutsideTheLocalProfile() throws Exception {
		mockMvc.perform(get("/api/v1/progress")
				.header(HttpHeaders.AUTHORIZATION, "Basic bGVhcm5lcjpsZWFybmVyLXRlc3QtcGFzc3dvcmQ="))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void isolatesProgressByIssuerAndSubject() throws Exception {
		createLearnerProgress();
		mockMvc.perform(get("/api/v1/progress")
				.header(HttpHeaders.AUTHORIZATION, bearer(REVIEWER_SUBJECT)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
		mockMvc.perform(get("/api/v1/progress")
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
	}

	@Test
	void rejectsInvalidStatusAndMissingStage() throws Exception {
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"DONE\"}"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(put(progressPath(), "missing-roadmap", 1)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"IN_PROGRESS\"}"))
				.andExpect(status().isNotFound());
	}

	@Test
	void returnsConflictForAStaleVersionWithoutChangingProgress() throws Exception {
		createLearnerProgress();
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"COMPLETED\",\"version\":0}"))
				.andExpect(status().isOk());
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"NOT_STARTED\",\"version\":0}"))
				.andExpect(status().isConflict());
		mockMvc.perform(get("/api/v1/progress")
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].status").value("COMPLETED"))
				.andExpect(jsonPath("$[0].version").value(1));
	}

	@Test
	void defaultDeniesUnrecognizedApiRoutes() throws Exception {
		mockMvc.perform(get("/api/v1/internal")
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT)))
				.andExpect(status().isForbidden());
	}

	private void assertUnauthorized(String token) throws Exception {
		mockMvc.perform(get("/api/v1/progress")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
				.andExpect(status().isUnauthorized());
	}

	private void createLearnerProgress() throws Exception {
		mockMvc.perform(put(progressPath(), JAVA_ROADMAP_ID, JAVA_STAGE_SEQUENCE)
				.header(HttpHeaders.AUTHORIZATION, bearer(LEARNER_SUBJECT))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"IN_PROGRESS\"}"))
				.andExpect(status().isCreated());
	}

	private String bearer(String subject) {
		return "Bearer " + OidcTestIssuer.validToken(subject);
	}

	private String progressPath() {
		return "/api/v1/progress/roadmaps/{roadmapId}/stages/{stageSequence}";
	}
}
