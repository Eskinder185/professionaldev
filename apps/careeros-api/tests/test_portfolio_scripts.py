from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text

from scripts.export_portfolio import export
from scripts.import_portfolio import ImportError_, import_data
from scripts.load_skills import DATA, load

SERVICE = Path(__file__).resolve().parent.parent

DATA_OK = {
    "profile": {"display_name": "Me"},
    "profile_skills": [{"skill": "Linux", "proficiency": 3, "years": 2, "evidence": "Help desk and a home lab"}],
    "roles": [{"slug": "aws-datacenter", "title": "AWS DC"}, {"slug": "react-dev", "title": "React"}],
    "items": [
        {"slug": "vpc-lab", "type": "lab", "title": "VPC lab", "summary": "Built a VPC", "published": True, "roles": {"aws-datacenter": 5}, "skills": ["Linux"]},
        {"slug": "draft", "type": "project", "title": "Draft", "summary": "Unfinished", "published": False, "roles": {"aws-datacenter": 5}},
        {"slug": "app", "type": "project", "title": "App", "summary": "React app", "published": True, "roles": {"react-dev": 4}},
    ],
}


@pytest.fixture()
def loaded(engine, db):
    load(engine, json.loads(DATA.read_text(encoding="utf-8"))["skills"])


def test_import_is_idempotent_and_matches_skills_case_insensitively(engine, db, loaded):
    first = import_data(engine, {**DATA_OK, "profile_skills": [{"skill": "linux", "proficiency": 3, "evidence": "x"}]})
    second = import_data(engine, DATA_OK)
    assert first == second == {"profile_skills": 1, "roles": 2, "items": 3}
    assert db.execute(text("SELECT count(*) FROM careeros.portfolio_items")).scalar_one() == 3
    assert db.execute(text("SELECT count(*) FROM careeros.profile_skills")).scalar_one() == 1
    assert db.execute(text("SELECT count(*) FROM careeros.portfolio_item_roles")).scalar_one() == 3


def test_import_is_all_or_nothing_and_names_unknown_skills_and_roles(engine, db, loaded):
    bad_skill = {**DATA_OK, "items": [{**DATA_OK["items"][0], "skills": ["Linux", "Quantum Gardening"]}]}
    with pytest.raises(ImportError_, match="Quantum Gardening"):
        import_data(engine, bad_skill)
    bad_role = {**DATA_OK, "items": [{**DATA_OK["items"][0], "roles": {"no-such-role": 3}}]}
    with pytest.raises(ImportError_, match="no-such-role"):
        import_data(engine, bad_role)
    for table in ("portfolio_items", "role_profiles", "profile_skills", "profiles"):
        assert db.execute(text(f"SELECT count(*) FROM careeros.{table}")).scalar_one() == 0, table


def test_strong_ratings_without_evidence_are_rejected_by_the_database(engine, db, loaded):
    with pytest.raises(Exception, match="strong_skill_needs_evidence"):
        import_data(engine, {**DATA_OK, "profile_skills": [{"skill": "Linux", "proficiency": 5}]})


def test_export_writes_only_published_items_one_file_per_role(engine, db, loaded, tmp_path):
    import_data(engine, DATA_OK)
    (tmp_path / "stale-role.json").write_text("{}")
    files = {p.name for p in export(engine, tmp_path)}
    assert files == {"index.json", "all.json", "aws-datacenter.json", "react-dev.json"}
    assert not (tmp_path / "stale-role.json").exists()
    aws = json.loads((tmp_path / "aws-datacenter.json").read_text(encoding="utf-8"))
    assert [i["slug"] for i in aws["groups"]["lab"]] == ["vpc-lab"] and aws["groups"]["project"] == []
    assert "draft" not in "".join(p.read_text(encoding="utf-8") for p in tmp_path.glob("*.json"))
    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert {r["slug"]: r["item_count"] for r in index["roles"]} == {"aws-datacenter": 1, "react-dev": 1}


def test_example_files_are_refused_by_the_command_line(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "scripts.import_portfolio", str(SERVICE / "data" / "portfolio.example.json")],
        cwd=SERVICE,
        capture_output=True,
        text=True,
        env={**__import__("os").environ, "CAREEROS_DATABASE_URL": "postgresql+psycopg://x:x@127.0.0.1:1/none", "CAREEROS_API_TOKEN": "t" * 20},
    )
    assert result.returncode == 2 and "example" in result.stderr
