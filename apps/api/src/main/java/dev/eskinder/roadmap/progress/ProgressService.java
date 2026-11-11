package dev.eskinder.roadmap.progress;

import dev.eskinder.roadmap.progress.dto.ProgressResponse;
import dev.eskinder.roadmap.progress.dto.UpsertProgressRequest;
import dev.eskinder.roadmap.progress.persistence.ApplicationUserEntity;
import dev.eskinder.roadmap.progress.persistence.ApplicationUserRepository;
import dev.eskinder.roadmap.progress.persistence.UserStageProgressEntity;
import dev.eskinder.roadmap.progress.persistence.UserStageProgressRepository;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapStageEntity;
import dev.eskinder.roadmap.roadmap.persistence.RoadmapStageRepository;
import dev.eskinder.roadmap.security.AuthenticatedIdentity;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProgressService {

	private final ApplicationUserRepository userRepository;
	private final RoadmapStageRepository stageRepository;
	private final UserStageProgressRepository progressRepository;
	private final Clock clock;

	public ProgressService(
			ApplicationUserRepository userRepository,
			RoadmapStageRepository stageRepository,
			UserStageProgressRepository progressRepository,
			Clock clock) {
		this.userRepository = userRepository;
		this.stageRepository = stageRepository;
		this.progressRepository = progressRepository;
		this.clock = clock;
	}

	@Transactional
	public List<ProgressResponse> findAllForIdentity(AuthenticatedIdentity identity) {
		provisionUser(identity);
		return progressRepository.findAllForIdentity(identity.issuer(), identity.subject()).stream()
				.map(this::toResponse)
				.toList();
	}

	@Transactional
	public ProgressWriteResult upsert(
			AuthenticatedIdentity identity,
			String roadmapId,
			int stageSequence,
			UpsertProgressRequest request) {
		ApplicationUserEntity user = provisionUser(identity);
		RoadmapStageEntity stage = stageRepository.findByRoadmapIdAndSequence(roadmapId, stageSequence)
				.orElseThrow(() -> new StageNotFoundException(roadmapId, stageSequence));
		long stageId = stage.getId();
		Instant now = clock.instant();

		UserStageProgressEntity progress = progressRepository.findForIdentityAndStageId(
				identity.issuer(), identity.subject(), stageId)
				.orElse(null);
		boolean created = progress == null;

		if (created) {
			if (request.version() != null) {
				throw new ProgressConflictException("A version must not be supplied when creating progress");
			}
			progress = new UserStageProgressEntity(user, stage, request.status(), now);
		} else {
			if (request.version() == null) {
				throw new ProgressConflictException("The current version is required when updating progress");
			}
			if (request.version() != progress.getVersion()) {
				throw staleVersion(roadmapId, stageSequence, request.version(), progress.getVersion());
			}
			progress.changeStatus(request.status(), now);
		}

		try {
			UserStageProgressEntity saved = progressRepository.saveAndFlush(progress);
			return new ProgressWriteResult(toResponse(saved), created);
		} catch (ObjectOptimisticLockingFailureException exception) {
			throw new ProgressConflictException("Progress changed since it was last read; reload and retry");
		} catch (DataIntegrityViolationException exception) {
			throw new ProgressConflictException("Progress already exists for this user and stage");
		}
	}

	private ApplicationUserEntity provisionUser(AuthenticatedIdentity identity) {
		userRepository.provisionIfMissing(identity.issuer(), identity.subject());
		return userRepository.findByIssuerAndSubject(identity.issuer(), identity.subject())
				.orElseThrow(() -> new ProgressPrincipalNotFoundException(identity.subject()));
	}

	private ProgressConflictException staleVersion(
			String roadmapId,
			int stageSequence,
			long supplied,
			long current) {
		return new ProgressConflictException(
				"Progress for roadmap '%s' stage '%d' has version %d, not %d; reload and retry"
						.formatted(roadmapId, stageSequence, current, supplied));
	}

	private ProgressResponse toResponse(UserStageProgressEntity progress) {
		RoadmapStageEntity stage = progress.getStage();
		return new ProgressResponse(
				stage.getRoadmap().getSlug(),
				stage.getSequence(),
				progress.getStatus(),
				progress.getCompletedAt(),
				progress.getUpdatedAt(),
				progress.getVersion());
	}
}

record ProgressWriteResult(ProgressResponse response, boolean created) {
}
