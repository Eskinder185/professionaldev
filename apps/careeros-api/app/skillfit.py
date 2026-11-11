"""Skill-gap data for the radar chart: what the job asks for versus what my master profile shows.

The posting does not state a proficiency level, so TARGETS are an assumption (required skills should be
solid, preferred ones working-level). The response says so, and an unrated skill is reported as "not
rated", never as a zero that would look like a measured weakness.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

TARGETS = {"required": 4, "preferred": 3}
DEFAULT_MAX_AXES = 10
NOTE = "Targets are an assumption (required = 4/5, preferred = 3/5); the posting does not state a level. Ratings are your own self-assessment."


def skill_fit(session: Session, application_id: int, max_axes: int = DEFAULT_MAX_AXES, include_uncertain: bool = False) -> dict:
    rows = session.execute(
        text(
            "SELECT term, kind, uncertain, category, proficiency, has_rating "
            "FROM careeros.application_skill_fit WHERE application_id = :a AND kind IN ('required', 'preferred') "
            "ORDER BY (kind = 'required') DESC, term"
        ),
        {"a": application_id},
    ).mappings().all()
    seen: set[str] = set()
    axes: list[dict] = []
    for r in rows:
        if (r["uncertain"] and not include_uncertain) or r["term"].lower() in seen:
            continue
        seen.add(r["term"].lower())
        target = TARGETS[r["kind"]]
        axes.append(
            {
                "term": r["term"],
                "kind": r["kind"],
                "category": r["category"],
                "uncertain": r["uncertain"],
                "has_rating": r["has_rating"],
                "proficiency": r["proficiency"],
                "target": target,
                "meets_target": bool(r["has_rating"] and r["proficiency"] >= target),
            }
        )
    required = [a for a in axes if a["kind"] == "required"]
    shown = axes[:max_axes]
    return {
        "application_id": application_id,
        "axes": shown,
        "omitted": max(0, len(axes) - len(shown)),
        "summary": {
            "required_total": len(required),
            "required_rated": sum(a["has_rating"] for a in required),
            "required_meeting_target": sum(a["meets_target"] for a in required),
            "unrated": [a["term"] for a in axes if not a["has_rating"]],
        },
        "targets": TARGETS,
        "note": NOTE,
    }
