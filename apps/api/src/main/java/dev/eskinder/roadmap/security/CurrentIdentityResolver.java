package dev.eskinder.roadmap.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class CurrentIdentityResolver {

	private static final String LOCAL_ISSUER = "local-dev";

	public AuthenticatedIdentity resolve(Authentication authentication) {
		if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
			return new AuthenticatedIdentity(
					jwtAuthentication.getToken().getIssuer().toString(),
					jwtAuthentication.getToken().getSubject());
		}
		return new AuthenticatedIdentity(LOCAL_ISSUER, authentication.getName());
	}
}
