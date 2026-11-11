package dev.eskinder.roadmap.roadmap.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "roadmaps")
public class RoadmapEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 100)
	private String slug;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(nullable = false, columnDefinition = "text")
	private String description;

	@Column(name = "target_role", nullable = false, length = 160)
	private String targetRole;

	@Column(name = "estimated_weeks", nullable = false)
	private short estimatedWeeks;

	@OneToMany(mappedBy = "roadmap", fetch = FetchType.LAZY)
	@OrderBy("sequence ASC")
	private Set<RoadmapStageEntity> stages = new LinkedHashSet<>();

	protected RoadmapEntity() {
	}

	public Long getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public String getTargetRole() {
		return targetRole;
	}

	public int getEstimatedWeeks() {
		return estimatedWeeks;
	}

	public Set<RoadmapStageEntity> getStages() {
		return stages;
	}
}
