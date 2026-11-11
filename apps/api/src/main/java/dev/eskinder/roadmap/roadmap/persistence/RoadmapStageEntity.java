package dev.eskinder.roadmap.roadmap.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "roadmap_stages")
public class RoadmapStageEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "roadmap_id", nullable = false)
	private RoadmapEntity roadmap;

	@Column(name = "stage_order", nullable = false)
	private short sequence;

	@Column(nullable = false, length = 200)
	private String title;

	@OneToMany(mappedBy = "stage", fetch = FetchType.LAZY)
	@OrderBy("sequence ASC")
	private Set<StageOutcomeEntity> outcomes = new LinkedHashSet<>();

	protected RoadmapStageEntity() {
	}

	public Long getId() {
		return id;
	}

	public RoadmapEntity getRoadmap() {
		return roadmap;
	}

	public int getSequence() {
		return sequence;
	}

	public String getTitle() {
		return title;
	}

	public Set<StageOutcomeEntity> getOutcomes() {
		return outcomes;
	}
}
