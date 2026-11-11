package dev.eskinder.roadmap.progress.persistence;

import dev.eskinder.roadmap.progress.ProgressStatus;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapStageEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
@Table(name = "user_stage_progress")
public class UserStageProgressEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private ApplicationUserEntity user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "stage_id", nullable = false)
	private RoadmapStageEntity stage;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ProgressStatus status;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(nullable = false)
	private long version;

	protected UserStageProgressEntity() {
	}

	public UserStageProgressEntity(ApplicationUserEntity user, RoadmapStageEntity stage, ProgressStatus status, Instant now) {
		this.user = user;
		this.stage = stage;
		changeStatus(status, now);
	}

	public void changeStatus(ProgressStatus status, Instant now) {
		this.status = status;
		this.completedAt = status == ProgressStatus.COMPLETED ? now : null;
		this.updatedAt = now;
	}

	public RoadmapStageEntity getStage() {
		return stage;
	}

	public ProgressStatus getStatus() {
		return status;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public long getVersion() {
		return version;
	}
}
