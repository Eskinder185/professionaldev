package dev.eskinder.roadmap.progress.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationUserRepository extends JpaRepository<ApplicationUserEntity, Long> {

	Optional<ApplicationUserEntity> findByIssuerAndSubject(String issuer, String subject);

	@Modifying
	@Query(value = """
			insert into application_users (issuer, subject, display_name)
			values (:issuer, :subject, :subject)
			on conflict (issuer, subject) do nothing
			""", nativeQuery = true)
	int provisionIfMissing(@Param("issuer") String issuer, @Param("subject") String subject);
}
