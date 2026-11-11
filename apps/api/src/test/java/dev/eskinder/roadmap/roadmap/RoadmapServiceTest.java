package dev.eskinder.roadmap.roadmap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.eskinder.roadmap.roadmap.persistence.RoadmapRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RoadmapServiceTest {

	@Mock
	private RoadmapRepository roadmapRepository;

	private RoadmapService roadmapService;

	@BeforeEach
	void setUp() {
		roadmapService = new RoadmapService(roadmapRepository);
	}

	@Test
	void returnsRepositoryCatalog() {
		when(roadmapRepository.findAllWithStagesAndOutcomes()).thenReturn(List.of());

		assertThat(roadmapService.findAll()).isEmpty();
		verify(roadmapRepository).findAllWithStagesAndOutcomes();
	}

	@Test
	void throwsWhenRoadmapDoesNotExist() {
		when(roadmapRepository.findBySlug("missing-roadmap")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> roadmapService.findById("missing-roadmap"))
				.isInstanceOf(RoadmapNotFoundException.class)
				.hasMessage("Roadmap 'missing-roadmap' was not found");
	}
}
