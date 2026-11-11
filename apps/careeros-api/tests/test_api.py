from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from .conftest import AUTH


def seed(conn, n: int = 3) -> list[int]:
    ids = []
    for i in range(n):
        company = conn.execute(
            text("INSERT INTO careeros.companies (name, normalized_name) VALUES (:n, :nn) RETURNING id"),
            {"n": f"Company {i}", "nn": f"company {i}"},
        ).scalar_one()
        status = ["Saved", "Applied", "Interview"][i % 3]
        app_id = conn.execute(
            text(
                "INSERT INTO careeros.applications (company_id, title, normalized_url, status, last_activity_at) "
                "VALUES (:c, :t, :u, :s, :a) RETURNING id"
            ),
            {"c": company, "t": f"Engineer {i}", "u": f"https://example.test/jobs/{i}", "s": status, "a": datetime.now(timezone.utc) - timedelta(days=n - i)},
        ).scalar_one()
        ids.append(app_id)
    return ids


def test_health_is_public_and_checks_the_database(client):
    r = client.get("/careeros/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_health_reports_failure_without_leaking_the_connection_string(settings):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    broken = Settings(database_url="postgresql+psycopg://nobody:secret-pw@127.0.0.1:1/careeros_test", api_token=settings.api_token)
    with TestClient(create_app(broken)) as c:
        r = c.get("/careeros/v1/health")
    assert r.status_code == 503
    assert r.json() == {"status": "degraded", "database": "unavailable"}
    assert "secret-pw" not in r.text


def test_private_routes_need_a_valid_token(client):
    assert client.get("/careeros/v1/applications").status_code == 401
    assert client.get("/careeros/v1/applications", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/careeros/v1/applications", headers={"Authorization": "Basic abc"}).status_code == 401
    body = client.get("/careeros/v1/applications").json()
    assert body == {"error": {"code": "unauthorized", "message": "A valid bearer token is required."}}
    assert client.get("/careeros/v1/applications", headers=AUTH).status_code == 200


def test_lists_applications_newest_activity_first_with_pagination(client, engine):
    with engine.begin() as conn:
        seed(conn, 5)
    page = client.get("/careeros/v1/applications?limit=2&offset=0", headers=AUTH).json()
    assert page["total"] == 5 and page["limit"] == 2 and page["offset"] == 0
    assert [a["title"] for a in page["items"]] == ["Engineer 4", "Engineer 3"]
    second = client.get("/careeros/v1/applications?limit=2&offset=2", headers=AUTH).json()
    assert [a["title"] for a in second["items"]] == ["Engineer 2", "Engineer 1"]
    assert page["items"][0]["company"]["name"] == "Company 4"


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "limit=abc", "offset=-1"])
def test_limits_are_enforced(client, query):
    r = client.get(f"/careeros/v1/applications?{query}", headers=AUTH)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_filters_by_status_company_and_updated_since(client, engine):
    with engine.begin() as conn:
        seed(conn, 3)
    by_status = client.get("/careeros/v1/applications?status=Applied", headers=AUTH).json()
    assert [a["status"] for a in by_status["items"]] == ["Applied"]
    by_company = client.get("/careeros/v1/applications?company=company 2", headers=AUTH).json()
    assert [a["title"] for a in by_company["items"]] == ["Engineer 2"]
    # LIKE wildcards in the filter are literal text, not patterns.
    assert client.get("/careeros/v1/applications?company=%25", headers=AUTH).json()["total"] == 0
    since = (datetime.now(timezone.utc) - timedelta(hours=36)).isoformat()
    recent = client.get("/careeros/v1/applications", params={"updated_since": since}, headers=AUTH).json()
    assert recent["total"] == 1
    bad = client.get("/careeros/v1/applications?status=Hired", headers=AUTH)
    assert bad.status_code == 422


def test_detail_includes_status_history_and_404_has_the_standard_shape(client, engine):
    with engine.begin() as conn:
        ids = seed(conn, 1)
        conn.execute(
            text(
                "INSERT INTO careeros.application_status_events (application_id, from_status, to_status, source, observed_text) "
                "VALUES (:a, 'Saved', 'Applied', 'ats_sync', 'Application received')"
            ),
            {"a": ids[0]},
        )
    detail = client.get(f"/careeros/v1/applications/{ids[0]}", headers=AUTH).json()
    assert detail["events"][0]["observed_text"] == "Application received"
    missing = client.get("/careeros/v1/applications/999999", headers=AUTH)
    assert missing.status_code == 404
    assert missing.json() == {"error": {"code": "not_found", "message": "Application not found."}}


def test_cors_allows_only_listed_origins_and_never_credentials(client):
    ok = client.options("/careeros/v1/applications", headers={"Origin": "http://127.0.0.1:4173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://127.0.0.1:4173"
    assert "access-control-allow-credentials" not in ok.headers
    evil = client.options("/careeros/v1/applications", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in evil.headers


def test_docs_are_off_by_default(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_settings_refuse_unsafe_values():
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError):
        Settings(database_url="postgresql+psycopg://a:b@h/db", api_token="short")  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql+psycopg://a:b@h/db", api_token="x" * 20, cors_origins=["*"])  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///x.db", api_token="x" * 20)  # type: ignore[arg-type]
