package dev.eskinder.roadmap.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

public abstract class PostgresIntegrationTest {

	protected static final String LEARNER_USERNAME = "learner";
	protected static final String LEARNER_PASSWORD = "learner-test-password";
	protected static final String REVIEWER_USERNAME = "reviewer";
	protected static final String REVIEWER_PASSWORD = "reviewer-test-password";
	protected static final String LEARNER_SUBJECT = "oidc-learner";
	protected static final String REVIEWER_SUBJECT = "oidc-reviewer";

	private static final PostgreSQLContainer POSTGRES =
			new PostgreSQLContainer("postgres:17.6-alpine")
					.withDatabaseName("roadmap_test")
					.withUsername("roadmap_test")
					.withPassword("roadmap_test");

	static {
		POSTGRES.start();
	}

	@DynamicPropertySource
	static void databaseProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
		registry.add("app.security.oidc.issuer-uri", () -> OidcTestIssuer.ISSUER);
		registry.add("app.security.oidc.jwk-set-uri", () -> OidcTestIssuer.JWK_SET_URI);
		registry.add("app.security.oidc.audience", () -> OidcTestIssuer.AUDIENCE);
		registry.add("app.security.local.learner-password", () -> LEARNER_PASSWORD);
		registry.add("app.security.local.reviewer-password", () -> REVIEWER_PASSWORD);
		registry.add("debug", () -> "false");
	}
}
