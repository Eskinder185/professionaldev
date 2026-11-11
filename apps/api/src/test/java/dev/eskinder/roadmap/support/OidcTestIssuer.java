package dev.eskinder.roadmap.support;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;

public final class OidcTestIssuer {

	public static final String AUDIENCE = "roadmap-api-test";
	private static final RSAKey SIGNING_KEY = createKey("roadmap-test-key");
	private static final RSAKey INVALID_KEY = createKey("invalid-test-key");
	private static final HttpServer SERVER = startServer();
	public static final String ISSUER = "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/test-issuer";
	public static final String JWK_SET_URI = "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/jwks";

	private OidcTestIssuer() {
	}

	public static String validToken(String subject) {
		return token(SIGNING_KEY, ISSUER, AUDIENCE, subject, Instant.now().plusSeconds(300));
	}

	public static String tokenWithInvalidSignature(String subject) {
		return token(INVALID_KEY, ISSUER, AUDIENCE, subject, Instant.now().plusSeconds(300));
	}

	public static String tokenWithIssuer(String issuer, String subject) {
		return token(SIGNING_KEY, issuer, AUDIENCE, subject, Instant.now().plusSeconds(300));
	}

	public static String tokenWithAudience(String audience, String subject) {
		return token(SIGNING_KEY, ISSUER, audience, subject, Instant.now().plusSeconds(300));
	}

	public static String expiredToken(String subject) {
		return token(SIGNING_KEY, ISSUER, AUDIENCE, subject, Instant.now().minusSeconds(300));
	}

	private static String token(RSAKey key, String issuer, String audience, String subject, Instant expiresAt) {
		try {
			Instant now = Instant.now();
			JWTClaimsSet claims = new JWTClaimsSet.Builder()
					.issuer(issuer)
					.subject(subject)
					.audience(List.of(audience))
					.issueTime(Date.from(now.minusSeconds(5)))
					.notBeforeTime(Date.from(now.minusSeconds(5)))
					.expirationTime(Date.from(expiresAt))
					.build();
			SignedJWT jwt = new SignedJWT(
					new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
			jwt.sign(new RSASSASigner((RSAPrivateKey) key.toPrivateKey()));
			return jwt.serialize();
		} catch (Exception exception) {
			throw new IllegalStateException("Unable to create test JWT", exception);
		}
	}

	private static RSAKey createKey(String keyId) {
		try {
			KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
			generator.initialize(2048);
			KeyPair pair = generator.generateKeyPair();
			return new RSAKey.Builder((RSAPublicKey) pair.getPublic())
					.privateKey((RSAPrivateKey) pair.getPrivate())
					.keyID(keyId)
					.algorithm(JWSAlgorithm.RS256)
					.build();
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("RSA is unavailable", exception);
		}
	}

	private static HttpServer startServer() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.createContext("/jwks", exchange -> {
				byte[] body = ("{\"keys\":[" + SIGNING_KEY.toPublicJWK().toJSONString() + "]}")
						.getBytes(StandardCharsets.UTF_8);
				exchange.getResponseHeaders().set("Content-Type", "application/json");
				exchange.sendResponseHeaders(200, body.length);
				exchange.getResponseBody().write(body);
				exchange.close();
			});
			server.start();
			return server;
		} catch (IOException exception) {
			throw new IllegalStateException("Unable to start test OIDC issuer", exception);
		}
	}
}
