package dev.eskinder.roadmap.security;

import static org.springframework.security.config.Customizer.withDefaults;

import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.Assert;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("local-auth")
public class SecurityConfiguration {

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			LocalBasicAuthenticationEntryPoint authenticationEntryPoint,
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
				.httpBasic(withDefaults());
		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	@Bean
	UserDetailsService userDetailsService(
			PasswordEncoder passwordEncoder,
			@Value("${app.security.local.learner-password}") String learnerPassword,
			@Value("${app.security.local.reviewer-password}") String reviewerPassword) {
		Assert.hasText(learnerPassword, "LOCAL_LEARNER_PASSWORD must be set");
		Assert.hasText(reviewerPassword, "LOCAL_REVIEWER_PASSWORD must be set");

		UserDetails learner = User.withUsername("learner")
				.password(passwordEncoder.encode(learnerPassword))
				.roles("USER")
				.build();
		UserDetails reviewer = User.withUsername("reviewer")
				.password(passwordEncoder.encode(reviewerPassword))
				.roles("USER")
				.build();
		return new InMemoryUserDetailsManager(learner, reviewer);
	}
}
