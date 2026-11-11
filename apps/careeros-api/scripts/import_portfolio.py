"""Load YOUR portfolio, role targets and skill self-ratings from a JSON file. Safe to run repeatedly.

  python -m scripts.import_portfolio data/portfolio.json

Rows are matched by slug (roles, items) or skill name, so re-running updates instead of duplicating.
Nothing is deleted. Unknown skill names are an error (listed), never silently dropped, so ratings and
tags always point at the real vocabulary. data/portfolio.example.json shows the format; files marked
"example": true are refused unless you pass --allow-example.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.config import get_settings
from app.db import make_engine


class ImportError_(Exception):
    pass


def _skill_ids(conn, names: set[str]) -> dict[str, int]:
    rows = conn.execute(text("SELECT id, lower(name) AS n FROM careeros.skills")).all()
    known = {r.n: r.id for r in rows}
    missing = sorted(n for n in names if n.lower() not in known)
    if missing:
        raise ImportError_("Unknown skill names (use the names in data/skills.json): " + ", ".join(missing))
    return {n: known[n.lower()] for n in names}


def import_data(engine: Engine, data: dict) -> dict[str, int]:
    counts = {"profile_skills": 0, "roles": 0, "items": 0}
    with engine.begin() as conn:  # all or nothing
        wanted = {s["skill"] for s in data.get("profile_skills", [])} | {k for i in data.get("items", []) for k in i.get("skills", [])}
        ids = _skill_ids(conn, wanted) if wanted else {}

        if data.get("profile_skills"):
            profile = conn.execute(text("SELECT id FROM careeros.profiles WHERE is_master")).scalar()
            if profile is None:
                name = (data.get("profile") or {}).get("display_name")
                if not name:
                    raise ImportError_('profile_skills need a master profile: add {"profile": {"display_name": "..."}}.')
                profile = conn.execute(text("INSERT INTO careeros.profiles (display_name) VALUES (:n) RETURNING id"), {"n": name}).scalar_one()
            for s in data["profile_skills"]:
                conn.execute(
                    text(
                        "INSERT INTO careeros.profile_skills (profile_id, skill_id, proficiency, years, evidence, last_verified_at) "
                        "VALUES (:p, :s, :l, :y, :e, now()) "
                        "ON CONFLICT (profile_id, skill_id) DO UPDATE SET proficiency = :l, years = :y, evidence = :e, last_verified_at = now()"
                    ),
                    {"p": profile, "s": ids[s["skill"]], "l": s["proficiency"], "y": s.get("years"), "e": s.get("evidence")},
                )
                counts["profile_skills"] += 1

        for r in data.get("roles", []):
            conn.execute(
                text(
                    "INSERT INTO careeros.role_profiles (slug, title, description) VALUES (:s, :t, :d) "
                    "ON CONFLICT (slug) DO UPDATE SET title = :t, description = :d"
                ),
                {"s": r["slug"], "t": r["title"], "d": r.get("description")},
            )
            counts["roles"] += 1
        existing = {row.slug: row.id for row in conn.execute(text("SELECT id, slug FROM careeros.role_profiles"))}

        for i in data.get("items", []):
            item_id = conn.execute(
                text(
                    "INSERT INTO careeros.portfolio_items (type, slug, title, summary, issuer, url, repo_url, started_on, ended_on, published, sort_order) "
                    "VALUES (:type, :slug, :title, :summary, :issuer, :url, :repo, :start, :end, :pub, :ord) "
                    "ON CONFLICT (slug) DO UPDATE SET type = :type, title = :title, summary = :summary, issuer = :issuer, url = :url, "
                    "repo_url = :repo, started_on = :start, ended_on = :end, published = :pub, sort_order = :ord RETURNING id"
                ),
                {
                    "type": i["type"], "slug": i["slug"], "title": i["title"], "summary": i["summary"], "issuer": i.get("issuer"),
                    "url": i.get("url"), "repo": i.get("repo_url"), "start": i.get("started_on"), "end": i.get("ended_on"),
                    "pub": bool(i.get("published", False)), "ord": i.get("sort_order", 0),
                },
            ).scalar_one()
            conn.execute(text("DELETE FROM careeros.portfolio_item_roles WHERE item_id = :i"), {"i": item_id})
            for slug, relevance in (i.get("roles") or {}).items():
                if slug not in existing:
                    raise ImportError_(f"Item '{i['slug']}' refers to an unknown role '{slug}'. Add it under \"roles\".")
                conn.execute(text("INSERT INTO careeros.portfolio_item_roles (item_id, role_id, relevance) VALUES (:i, :r, :v)"), {"i": item_id, "r": existing[slug], "v": relevance})
            conn.execute(text("DELETE FROM careeros.portfolio_item_skills WHERE item_id = :i"), {"i": item_id})
            for name in i.get("skills", []):
                conn.execute(text("INSERT INTO careeros.portfolio_item_skills (item_id, skill_id) VALUES (:i, :s) ON CONFLICT DO NOTHING"), {"i": item_id, "s": ids[name]})
            counts["items"] += 1
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("file", type=Path)
    parser.add_argument("--allow-example", action="store_true", help="import a file marked as example data (never for your real database)")
    args = parser.parse_args()
    data = json.loads(args.file.read_text(encoding="utf-8"))
    if data.get("example") and not args.allow_example:
        print('Refusing to import a file marked "example": true. Copy it, replace the content with your own, and remove that line.', file=sys.stderr)
        return 2
    engine = make_engine(get_settings())
    try:
        counts = import_data(engine, data)
    except ImportError_ as exc:
        print(f"Import failed, nothing was changed: {exc}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    print("imported: " + ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
