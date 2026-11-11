package dev.eskinder.roadmap.security;

import static org.springframework.security.config.Customizer.withDefaults;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.Assert;

@Configuration
@Profile("!local-auth")
public class OidcSecurityConfiguration {

	@Bean
	SecurityFilterChain oidcSecurityFilterChain(
			HttpSecurity http,
			ApiAuthenticationEntryPoint authenticationEntryPoint,
			ApiAccessDeniedHandler accessDeniedHandler) throws Exception {
		http
				.csrf(csrf -> csrf.disable())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/api/v1/roadmaps", "/api/v1/roadmaps/**", "/actuator/health").permitAll()
						.requestMatchers("/api/v1/progress", "/api/v1/progress/**").authenticated()
						.requestMatchers("/api/**").denyAll()
						.anyRequest().denyAll())
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler))
				.oauth2ResourceServer(oauth2 -> oauth2
						.jwt(withDefaults())
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler));
		return http.build();
	}

	@Bean
	JwtDecoder jwtDecoder(
			@Value("${app.security.oidc.issuer-uri}") String issuer,
			@Value("${app.security.oidc.jwk-set-uri}") String jwkSetUri,
			@Value("${app.security.oidc.audience}") String audience) {
		Assert.hasText(issuer, "OIDC_ISSUER_URI must be set outside the local-auth profile");
		Assert.hasText(jwkSetUri, "OIDC_JWK_SET_URI must be set outside the local-auth profile");
		Assert.hasText(audience, "OIDC_AUDIENCE must be set outside the local-auth profile");

		NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
		OAuth2TokenValidator<Jwt> issuerAndTime = JwtValidators.createDefaultWithIssuer(issuer);
		OAuth2TokenValidator<Jwt> audienceValidator = new JwtClaimValidator<List<String>>(
				"aud", audiences -> audiences != null && audiences.contains(audience));
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerAndTime, audienceValidator));
		return decoder;
	}
}
