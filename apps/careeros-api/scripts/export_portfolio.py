"""Write the PUBLISHED portfolio to static JSON for the website, one file per role.

  python -m scripts.export_portfolio                 # writes ../../public/portfolio/
  python -m scripts.export_portfolio --out some/dir

Output: index.json (roles and counts), all.json (everything published), and <role-slug>.json.
The website reads these files, so GitHub Pages never needs to reach your home lab and the lab can stay
private and offline. Only rows with published = TRUE are ever written. Run it, review the diff, commit.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.config import SERVICE_ROOT, get_settings
from app.db import make_engine
from app.portfolio import build_portfolio, list_roles

DEFAULT_OUT = (SERVICE_ROOT / ".." / ".." / "public" / "portfolio").resolve()


def export(engine: Engine, out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")

    def write(name: str, payload: dict) -> None:
        path = out / name
        path.write_text(json.dumps({"generated_at": stamp, **payload}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(path)

    with Session(engine) as session:
        roles = list_roles(session)
        write("index.json", {"roles": roles})
        write("all.json", build_portfolio(session, None) or {})
        for role in roles:
            data = build_portfolio(session, role["slug"])
            if data:
                write(f"{role['slug']}.json", data)
    # Remove files for roles that no longer exist, so deleted roles do not linger on the site.
    keep = {p.name for p in written}
    for stale in out.glob("*.json"):
        if stale.name not in keep:
            stale.unlink()
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    engine = make_engine(get_settings())
    try:
        files = export(engine, args.out)
    finally:
        engine.dispose()
    print(f"wrote {len(files)} files to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
