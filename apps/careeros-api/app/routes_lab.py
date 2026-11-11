"""Part 2/3 endpoints: skill-fit radar data, requirement sync, interview simulator, public portfolio."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import Settings
from .interview import (
    STYLES,
    build_feedback_prompt,
    build_question_prompt,
    pick_focus,
    validate_feedback,
    validate_questions,
)
from .llm import LlmClient, LlmUnavailable
from .models import Application, InterviewSession, InterviewTurn, JobRequirement, Skill
from .portfolio import build_portfolio, list_roles
from .skillfit import skill_fit

PREFIX = "/careeros/v1"


class RequirementIn(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    kind: str = Field(pattern="^(required|preferred|responsibility)$")
    evidence: str | None = Field(default=None, max_length=1000)
    uncertain: bool = False


class RequirementsIn(BaseModel):
    requirements: list[RequirementIn] = Field(max_length=200)


class SessionIn(BaseModel):
    application_id: int
    style: str = "general"
    question_count: int = Field(default=5, ge=1, le=8)


class AnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


def _turn_out(t: InterviewTurn, skill_name: str | None) -> dict:
    r = t.rubric or {}
    return {
        "index": t.turn_index,
        "skill": skill_name,
        "scenario": r.get("scenario", ""),
        "question": r.get("ask", t.question),
        "difficulty": r.get("difficulty", 3),
    }


def make_lab_router(settings: Settings, get_session: Callable, require_token: Callable, llm: LlmClient) -> APIRouter:
    router = APIRouter()
    private = [Depends(require_token)]
    hits: dict[str, deque[float]] = defaultdict(deque)

    def rate_limit(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        window, now = hits[ip], time.monotonic()
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= settings.public_rate_limit_per_minute:
            raise HTTPException(status_code=429, detail="Too many requests. Try again in a minute.", headers={"Retry-After": "60"})
        window.append(now)

    def require_public() -> None:
        if not settings.public_portfolio:
            raise HTTPException(status_code=404, detail="Not found.")  # indistinguishable from a missing route

    # ---- skill-gap radar ----

    @router.get(f"{PREFIX}/applications/{{application_id}}/skill-fit", dependencies=private)
    def get_skill_fit(
        application_id: int,
        session: Session = Depends(get_session),
        max_axes: int = Query(default=10, ge=3, le=20),
        include_uncertain: bool = False,
    ):
        app = session.get(Application, application_id)
        if app is None:
            raise HTTPException(status_code=404, detail="Application not found.")
        data = skill_fit(session, application_id, max_axes, include_uncertain)
        data["title"], data["company"] = app.title, app.company.name
        return data

    @router.put(f"{PREFIX}/applications/{{application_id}}/requirements", dependencies=private)
    def put_requirements(application_id: int, body: RequirementsIn, session: Session = Depends(get_session)):
        """Replace the saved requirements (for example from the website's extractor). Skills are matched by name or alias."""
        if session.get(Application, application_id) is None:
            raise HTTPException(status_code=404, detail="Application not found.")
        lookup: dict[str, int] = {}
        for s in session.scalars(select(Skill)):
            lookup[s.name.lower()] = s.id
            for alias in s.aliases:
                lookup.setdefault(alias.lower(), s.id)
        session.execute(text("DELETE FROM careeros.job_requirements WHERE application_id = :a"), {"a": application_id})
        seen: set[tuple[str, str]] = set()
        saved = matched = 0
        for r in body.requirements:
            key = (r.term.strip().lower(), r.kind)
            if key in seen:
                continue
            seen.add(key)
            skill_id = lookup.get(r.term.strip().lower())
            session.add(JobRequirement(application_id=application_id, skill_id=skill_id, term=r.term.strip(), kind=r.kind, evidence=r.evidence, uncertain=r.uncertain))
            saved += 1
            matched += skill_id is not None
        session.commit()
        return {"saved": saved, "matched_to_known_skills": matched}

    # ---- public portfolio (off unless enabled; published rows only) ----

    @router.get(f"{PREFIX}/public/roles", dependencies=[Depends(require_public), Depends(rate_limit)])
    def public_roles(session: Session = Depends(get_session)):
        return {"roles": list_roles(session)}

    @router.get(f"{PREFIX}/public/portfolio", dependencies=[Depends(require_public), Depends(rate_limit)])
    def public_portfolio(session: Session = Depends(get_session), role: str | None = Query(default=None, max_length=80, pattern="^[a-z0-9]+(-[a-z0-9]+)*$")):
        data = build_portfolio(session, role)
        if data is None:
            raise HTTPException(status_code=404, detail="Unknown role.")
        return data

    # ---- interview simulator ----

    def _proficiency(session: Session, skill_id: int | None) -> int | None:
        if skill_id is None:
            return None
        return session.execute(
            text("SELECT ps.proficiency FROM careeros.profile_skills ps JOIN careeros.profiles p ON p.id = ps.profile_id AND p.is_master WHERE ps.skill_id = :s"),
            {"s": skill_id},
        ).scalar()

    @router.post(f"{PREFIX}/interview/sessions", dependencies=private, status_code=201)
    def create_session(body: SessionIn, session: Session = Depends(get_session)):
        if body.style not in STYLES:
            raise HTTPException(status_code=422, detail=f"style must be one of: {', '.join(STYLES)}.")
        app = session.get(Application, body.application_id)
        if app is None:
            raise HTTPException(status_code=404, detail="Application not found.")
        rows = [
            dict(r)
            for r in session.execute(
                text(
                    "SELECT f.term, f.kind, f.uncertain, f.proficiency, f.has_rating, f.skill_id, r.evidence "
                    "FROM careeros.application_skill_fit f JOIN careeros.job_requirements r ON r.id = f.requirement_id "
                    "WHERE f.application_id = :a"
                ),
                {"a": app.id},
            ).mappings()
        ]
        focus = pick_focus(rows, body.question_count)
        if not focus:
            raise HTTPException(status_code=409, detail="This application has no saved required or preferred skills yet. Save its requirements first.")
        try:
            raw = llm.chat(build_question_prompt(app.title, app.company.name, focus, body.style, body.question_count))
        except LlmUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        questions, _ = validate_questions(raw, [f.term for f in focus])
        if not questions:
            raise HTTPException(status_code=502, detail="The model's questions were unusable (wrong format or off-topic). Try again, or use a model that follows JSON instructions better.")
        skill_ids = {r["term"].lower(): r["skill_id"] for r in rows}
        row = InterviewSession(application_id=app.id, model=llm.model or None)
        session.add(row)
        session.flush()
        for i, q in enumerate(questions):
            session.add(
                InterviewTurn(
                    session_id=row.id,
                    turn_index=i,
                    skill_id=skill_ids.get(q.skill.lower()),
                    question=f"{q.scenario}\n\n{q.question}",
                    rubric={"scenario": q.scenario, "ask": q.question, "difficulty": q.difficulty, "good_answer_covers": q.good_answer_covers},
                    model=llm.model or None,
                )
            )
        session.commit()
        first = session.scalars(select(InterviewTurn).where(InterviewTurn.session_id == row.id, InterviewTurn.turn_index == 0)).one()
        return {"id": row.id, "total": len(questions), "model": row.model, "style": body.style, "next_turn": _turn_out(first, questions[0].skill)}

    def _skill_name(session: Session, skill_id: int | None) -> str | None:
        return session.scalar(select(Skill.name).where(Skill.id == skill_id)) if skill_id else None

    @router.post(f"{PREFIX}/interview/sessions/{{session_id}}/turns/{{index}}/answer", dependencies=private)
    def answer_turn(session_id: int, index: int, body: AnswerIn, session: Session = Depends(get_session)):
        sess = session.get(InterviewSession, session_id)
        if sess is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        turns = list(session.scalars(select(InterviewTurn).where(InterviewTurn.session_id == session_id).order_by(InterviewTurn.turn_index)))
        turn = next((t for t in turns if t.turn_index == index), None)
        if turn is None:
            raise HTTPException(status_code=404, detail="Question not found.")
        if turn.answer is not None:
            raise HTTPException(status_code=409, detail="This question was already answered.")
        if any(t.answer is None for t in turns if t.turn_index < index):
            raise HTTPException(status_code=409, detail="Answer the earlier questions first.")
        rubric = dict(turn.rubric or {})
        level = _proficiency(session, turn.skill_id)
        skill_name = _skill_name(session, turn.skill_id) or "this skill"
        # The answer is saved only if feedback could be generated, so a model outage never loses or half-saves a turn.
        try:
            raw = llm.chat(build_feedback_prompt(skill_name, rubric.get("scenario", ""), rubric.get("ask", turn.question), rubric.get("good_answer_covers", []), body.answer, level), temperature=0.2)
        except LlmUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        feedback = validate_feedback(raw)
        turn.answer = body.answer
        rubric["feedback"] = feedback
        turn.rubric = rubric
        following = next((t for t in turns if t.turn_index == index + 1), None)
        if following is None:
            sess.ended_at = datetime.now(timezone.utc)
        session.commit()
        return {
            "feedback": feedback,
            "feedback_note": None if feedback else "The model's feedback was not in a usable format, so none is shown. Your answer was saved.",
            "good_answer_covers": rubric.get("good_answer_covers", []),
            "finished": following is None,
            "next_turn": _turn_out(following, _skill_name(session, following.skill_id)) if following else None,
        }

    @router.get(f"{PREFIX}/interview/sessions/{{session_id}}", dependencies=private)
    def get_session_transcript(session_id: int, session: Session = Depends(get_session)):
        sess = session.get(InterviewSession, session_id)
        if sess is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        turns = session.scalars(select(InterviewTurn).where(InterviewTurn.session_id == session_id).order_by(InterviewTurn.turn_index))
        return {
            "id": sess.id,
            "application_id": sess.application_id,
            "model": sess.model,
            "finished": sess.ended_at is not None,
            "turns": [
                {**_turn_out(t, _skill_name(session, t.skill_id)), "answer": t.answer, "feedback": (t.rubric or {}).get("feedback")}
                for t in turns
            ],
        }

    return router
