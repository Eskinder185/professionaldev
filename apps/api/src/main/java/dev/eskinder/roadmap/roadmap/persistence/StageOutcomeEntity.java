package dev.eskinder.roadmap.roadmap.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "stage_outcomes")
public class StageOutcomeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "stage_id", nullable = false)
	private RoadmapStageEntity stage;

	@Column(name = "outcome_order", nullable = false)
	private short sequence;

	@Column(name = "outcome_text", nullable = false, columnDefinition = "text")
	private String text;

	protected StageOutcomeEntity() {
	}

	public Long getId() {
		return id;
	}

	public int getSequence() {
		return sequence;
	}

	public String getText() {
		return text;
	}
}
