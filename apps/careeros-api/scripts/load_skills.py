"""Load the website's skill vocabulary into careeros.skills. Safe to run repeatedly.

  python -m scripts.load_skills            # uses data/skills.json
  node --experimental-strip-types scripts/export_taxonomy.mjs   # regenerate the JSON from taxonomy.ts first

Matches on lower(name): existing skills keep their id (so profile ratings and requirements survive),
and their category, aliases and case flag are refreshed. Skills missing from the JSON are left alone.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from sqlalchemy import text

from app.config import get_settings
from app.db import make_engine

DATA = Path(__file__).resolve().parent.parent / "data" / "skills.json"


def load(engine, skills: list[dict]) -> tuple[int, int]:
    inserted = updated = 0
    with engine.begin() as conn:
        for s in skills:
            existing = conn.execute(text("SELECT id FROM careeros.skills WHERE lower(name) = lower(:n)"), {"n": s["name"]}).scalar()
            params = {"n": s["name"], "c": s["category"], "a": list(s.get("aliases", [])), "cs": bool(s.get("case_sensitive", False))}
            if existing is None:
                conn.execute(text("INSERT INTO careeros.skills (name, category, aliases, case_sensitive) VALUES (:n, :c, :a, :cs)"), params)
                inserted += 1
            else:
                conn.execute(text("UPDATE careeros.skills SET category = :c, aliases = :a, case_sensitive = :cs WHERE id = :i"), {**params, "i": existing})
                updated += 1
    return inserted, updated


def main() -> int:
    skills = json.loads(DATA.read_text(encoding="utf-8"))["skills"]
    engine = make_engine(get_settings())
    try:
        inserted, updated = load(engine, skills)
    finally:
        engine.dispose()
    print(f"skills: {inserted} added, {updated} refreshed ({len(skills)} in {DATA.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
