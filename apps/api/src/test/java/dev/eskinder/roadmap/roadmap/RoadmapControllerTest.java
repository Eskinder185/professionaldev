package dev.eskinder.roadmap.roadmap;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import dev.eskinder.roadmap.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class RoadmapControllerTest extends PostgresIntegrationTest {

	@Autowired
	private WebApplicationContext applicationContext;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext)
				.apply(springSecurity())
				.build();
	}

	@Test
	void returnsRoadmapCollection() throws Exception {
		mockMvc.perform(get("/api/v1/roadmaps"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				.andExpect(jsonPath("$[0].id").value("aws-solutions-architect-associate"));
	}

	@Test
	void returnsRoadmapById() throws Exception {
		mockMvc.perform(get("/api/v1/roadmaps/java-spring-backend"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value("java-spring-backend"))
				.andExpect(jsonPath("$.title").value("Java and Spring Backend"))
				.andExpect(jsonPath("$.description").value("Progress from Java language fundamentals to a tested Spring Boot REST API."))
				.andExpect(jsonPath("$.targetRole").value("Backend Java Developer"))
				.andExpect(jsonPath("$.estimatedWeeks").value(14))
				.andExpect(jsonPath("$.stages.length()").value(3));
	}

	@Test
	void returnsStructuredNotFoundResponse() throws Exception {
		mockMvc.perform(get("/api/v1/roadmaps/missing-roadmap"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.code").value("ROADMAP_NOT_FOUND"))
				.andExpect(jsonPath("$.path").value("/api/v1/roadmaps/missing-roadmap"));
	}

	@Test
	void returnsStructuredValidationResponse() throws Exception {
		mockMvc.perform(get("/api/v1/roadmaps/INVALID_ID"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.violations[0].field").value("id"));
	}
}
