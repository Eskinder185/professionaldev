package dev.eskinder.roadmap.security;

public record AuthenticatedIdentity(String issuer, String subject) {
}
