"""Portfolio data by target role. Published rows only, ever. Used by the endpoint and the static export."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.orm import Session

TYPES = ("project", "lab", "certification", "experience")


def list_roles(session: Session) -> list[dict]:
    rows = session.execute(
        text(
            "SELECT r.slug, r.title, r.description, count(i.id) AS item_count "
            "FROM careeros.role_profiles r "
            "LEFT JOIN careeros.portfolio_item_roles pr ON pr.role_id = r.id "
            "LEFT JOIN careeros.portfolio_items i ON i.id = pr.item_id AND i.published "
            "GROUP BY r.id ORDER BY r.title"
        )
    ).mappings()
    return [dict(r) for r in rows]


def build_portfolio(session: Session, role_slug: str | None) -> dict | None:
    """Items grouped by type, most relevant first. None when the role does not exist."""
    role = None
    if role_slug:
        role = session.execute(
            text("SELECT id, slug, title, description FROM careeros.role_profiles WHERE slug = :s"), {"s": role_slug}
        ).mappings().one_or_none()
        if role is None:
            return None
    params: dict = {}
    sql = (
        "SELECT i.id, i.type, i.slug, i.title, i.summary, i.issuer, i.url, i.repo_url, i.started_on, i.ended_on, i.sort_order, "
        "{rel} AS relevance FROM careeros.portfolio_items i {join} WHERE i.published "
        "ORDER BY relevance DESC, i.sort_order, i.id"
    )
    if role:
        sql = sql.format(rel="pr.relevance", join="JOIN careeros.portfolio_item_roles pr ON pr.item_id = i.id AND pr.role_id = :r")
        params["r"] = role["id"]
    else:
        sql = sql.format(rel="0", join="")
    items = [dict(r) for r in session.execute(text(sql), params).mappings()]
    skills: dict[int, list[str]] = defaultdict(list)
    if items:
        for r in session.execute(
            text(
                "SELECT s.item_id, k.name FROM careeros.portfolio_item_skills s JOIN careeros.skills k ON k.id = s.skill_id "
                "WHERE s.item_id = ANY(:ids) ORDER BY k.name"
            ),
            {"ids": [i["id"] for i in items]},
        ):
            skills[r.item_id].append(r.name)
    grouped: dict[str, list[dict]] = {t: [] for t in TYPES}
    for item in items:
        grouped[item["type"]].append(
            {
                "slug": item["slug"],
                "title": item["title"],
                "summary": item["summary"],
                "issuer": item["issuer"],
                "url": item["url"],
                "repo_url": item["repo_url"],
                "started_on": item["started_on"].isoformat() if item["started_on"] else None,
                "ended_on": item["ended_on"].isoformat() if item["ended_on"] else None,
                "relevance": item["relevance"],
                "skills": skills.get(item["id"], []),
            }
        )
    return {
        "role": {"slug": role["slug"], "title": role["title"], "description": role["description"]} if role else None,
        "groups": grouped,
        "total": len(items),
    }
