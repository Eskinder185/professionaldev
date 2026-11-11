package dev.eskinder.roadmap.progress.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "application_users")
public class ApplicationUserEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 500)
	private String issuer;

	@Column(nullable = false, unique = true, length = 200)
	private String subject;

	@Column(name = "display_name", nullable = false, length = 200)
	private String displayName;

	protected ApplicationUserEntity() {
	}

	public ApplicationUserEntity(String issuer, String subject) {
		this.issuer = issuer;
		this.subject = subject;
		this.displayName = subject;
	}

	public Long getId() {
		return id;
	}

	public String getSubject() {
		return subject;
	}

	public String getIssuer() {
		return issuer;
	}
}
