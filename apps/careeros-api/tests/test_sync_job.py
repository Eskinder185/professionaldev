"""The sync job end to end: real Chromium, a local fake portal, a real (test) PostgreSQL database."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from jobs import sync_ats_status as job

from .fake_portal import FakePortal

pytestmark = pytest.mark.filterwarnings("ignore")

ENV = {"CAREEROS_SECRET_WORKDAY_ACME_USERNAME": "me@example.test", "CAREEROS_SECRET_WORKDAY_ACME_PASSWORD": "pw-123"}


@pytest.fixture()
def env(monkeypatch, settings, tmp_path):
    monkeypatch.setenv("CAREEROS_DATABASE_URL", settings.database_url)
    monkeypatch.setenv("CAREEROS_API_TOKEN", settings.api_token.get_secret_value())
    monkeypatch.setenv("CAREEROS_SESSION_DIR", str(tmp_path / "sessions"))
    # The politeness pauses are real in production; skip them here so the suite stays fast.
    monkeypatch.setattr("jobs.ats.workday.polite_pause", lambda *_: None)
    monkeypatch.setattr("jobs.sync_ats_status.polite_pause", lambda *_: None)
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def add_application(conn, title, status="Applied", company="Acme", url=None, req=None) -> int:
    cid = conn.execute(
        text("INSERT INTO careeros.companies (name, normalized_name) VALUES (CAST(:n AS varchar), lower(CAST(:n AS varchar))) ON CONFLICT (normalized_name) DO UPDATE SET name = excluded.name RETURNING id"),
        {"n": company},
    ).scalar_one()
    return conn.execute(
        text("INSERT INTO careeros.applications (company_id, title, normalized_url, status, requisition_id) VALUES (:c, :t, :u, :s, :r) RETURNING id"),
        {"c": cid, "t": title, "u": url or f"https://acme.test/{title.replace(' ', '-').lower()}", "s": status, "r": req},
    ).scalar_one()


def add_account(conn, portal: FakePortal, acknowledged=True) -> int:
    return conn.execute(
        text(
            "INSERT INTO careeros.ats_accounts (platform, label, base_url, username_ref, automation_acknowledged_at) "
            "VALUES ('workday', 'Acme', :u, 'workday-acme', :a) RETURNING id"
        ),
        {"u": portal.base_url if portal.base_url.startswith("https://") else "https://placeholder.test", "a": datetime.now(timezone.utc) if acknowledged else None},
    ).scalar_one()


def make_account_http(conn, portal, acknowledged=True) -> int:
    """The schema requires https for real accounts; the test portal is http, so relax that one CHECK for this test DB only."""
    conn.execute(text("ALTER TABLE careeros.ats_accounts DROP CONSTRAINT IF EXISTS ats_accounts_base_url_check"))
    return conn.execute(
        text(
            "INSERT INTO careeros.ats_accounts (platform, label, employer_name, base_url, username_ref, automation_acknowledged_at) "
            "VALUES ('workday', 'Acme', 'Acme', :u, 'workday-acme', :a) RETURNING id"
        ),
        {"u": portal.base_url, "a": datetime.now(timezone.utc) if acknowledged else None},
    ).scalar_one()


@pytest.fixture()
def seeded(db):
    """Three of my applications that the fake portal knows about, plus one it doesn't."""
    ids = {
        "cloud": add_application(db, "Cloud Support Engineer", "Applied", req="R-100"),
        "dc": add_application(db, "Data Center Technician", "Applied"),
        "net": add_application(db, "Network Analyst", "Applied"),
        "mystery": add_application(db, "Mystery Role", "Applied", req="R-400"),
        "unseen": add_application(db, "Not On Portal", "Saved"),
    }
    yield ids


def statuses(conn) -> dict[str, str]:
    return {r.title: r.status for r in conn.execute(text("SELECT title, status FROM careeros.applications"))}


def run_job(*args: str, portal: FakePortal):
    return job.run(list(args), env=ENV)


def test_dry_run_reads_and_reports_but_writes_nothing(env, db, seeded, tmp_path):
    with FakePortal() as portal:
        make_account_http(db, portal)
        before = statuses(db)
        code = run_job("--dry-run", portal=portal)
    assert code == 0
    assert statuses(db) == before
    assert not (tmp_path / "sessions").exists()  # not even a saved login
    for table in ("sync_runs", "application_status_events", "ats_application_links", "ats_unmatched_entries"):
        assert db.execute(text(f"SELECT count(*) FROM careeros.{table}")).scalar_one() == 0, table


def test_real_run_records_changes_with_the_portals_exact_words(env, db, seeded):
    with FakePortal() as portal:
        make_account_http(db, portal)
        code = run_job(portal=portal)
        assert code == 0
        # Never touched anything that changes an application on the portal.
        assert portal.hits("/withdraw") == 0 and portal.hits("/submit") == 0
    now = statuses(db)
    assert now["Cloud Support Engineer"] == "Interview"
    assert now["Network Analyst"] == "Rejected"
    assert now["Data Center Technician"] == "Applied"  # "Under Review" is not progress
    assert now["Mystery Role"] == "Applied"  # unknown wording never changes status
    assert now["Not On Portal"] == "Saved"

    events = db.execute(text("SELECT a.title, e.from_status, e.to_status, e.observed_text, e.confidence, e.source, e.sync_run_id FROM careeros.application_status_events e JOIN careeros.applications a ON a.id = e.application_id ORDER BY e.id")).all()
    by_title = {e.title: e for e in events}
    assert by_title["Cloud Support Engineer"].observed_text == "Interview Scheduled"
    assert (by_title["Cloud Support Engineer"].from_status, by_title["Cloud Support Engineer"].to_status) == ("Applied", "Interview")
    assert all(e.source == "ats_sync" and e.sync_run_id for e in events)
    # Unmapped wording is kept, at low confidence, with no status.
    mystery = by_title["Mystery Role"]
    assert (mystery.to_status, mystery.confidence, mystery.observed_text) == (None, "low", "Awaiting committee")

    # The portal entry that matches nothing is reported, not created.
    unmatched = db.execute(text("SELECT title FROM careeros.ats_unmatched_entries")).scalars().all()
    assert unmatched == ["Someone Else's Job"]
    assert db.execute(text("SELECT count(*) FROM careeros.applications")).scalar_one() == 5

    run = db.execute(text("SELECT outcome, dry_run, accounts_checked, entries_seen, status_changes, unmatched, finished_at FROM careeros.sync_runs")).one()
    assert (run.outcome, run.dry_run, run.accounts_checked, run.entries_seen, run.status_changes, run.unmatched) == ("ok", False, 1, 5, 2, 1)
    assert run.finished_at is not None


def test_rerunning_is_idempotent(env, db, seeded):
    with FakePortal() as portal:
        make_account_http(db, portal)
        run_job(portal=portal)
        first = db.execute(text("SELECT count(*) FROM careeros.application_status_events")).scalar_one()
        assert run_job(portal=portal) == 0
        assert db.execute(text("SELECT count(*) FROM careeros.application_status_events")).scalar_one() == first
        assert db.execute(text("SELECT count(*) FROM careeros.sync_runs")).scalar_one() == 2


def test_a_captcha_stops_the_account_and_is_not_worked_around(env, db, seeded):
    with FakePortal("captcha") as portal:
        make_account_http(db, portal)
        code = run_job(portal=portal)
        assert portal.logins == 0  # it did not try to get past the check
        assert portal.hits("/userHome") == 1  # and did not retry
    assert code == 1
    row = db.execute(text("SELECT outcome, reason FROM careeros.sync_run_accounts")).one()
    assert row.outcome == "needs_attention" and "CAPTCHA" in row.reason
    assert db.execute(text("SELECT count(*) FROM careeros.application_status_events")).scalar_one() == 0
    assert db.execute(text("SELECT outcome FROM careeros.sync_runs")).scalar_one() == "partial"


def test_a_rejected_login_is_tried_once_only(env, db, seeded):
    with FakePortal("badlogin") as portal:
        make_account_http(db, portal)
        code = run_job(portal=portal)
        assert portal.logins == 1  # repeated bad logins can lock an account
    assert code == 1
    reason = db.execute(text("SELECT reason FROM careeros.sync_run_accounts")).scalar_one()
    assert "rejected the sign-in" in reason and "pw-123" not in reason and "me@example.test" not in reason


def test_an_account_without_acknowledgement_is_skipped_untouched(env, db, seeded):
    with FakePortal() as portal:
        make_account_http(db, portal, acknowledged=False)
        code = run_job(portal=portal)
        assert portal.requests == []  # the portal was never contacted
    assert code == 0
    row = db.execute(text("SELECT outcome, reason FROM careeros.sync_run_accounts")).one()
    assert row.outcome == "skipped" and "terms" in row.reason


def test_missing_credentials_name_the_variables_not_values(env, db, seeded, monkeypatch):
    with FakePortal() as portal:
        make_account_http(db, portal)
        code = job.run([], env={})
        assert portal.requests == []
    assert code == 1
    reason = db.execute(text("SELECT reason FROM careeros.sync_run_accounts")).scalar_one()
    assert "CAREEROS_SECRET_WORKDAY_ACME_PASSWORD" in reason


def test_a_changed_layout_is_a_failure_with_a_plain_reason(env, db, seeded):
    with FakePortal("layout") as portal:
        make_account_http(db, portal)
        code = run_job(portal=portal)
    assert code == 2
    outcome, reason = db.execute(text("SELECT outcome, reason FROM careeros.sync_run_accounts")).one()
    assert outcome == "failed" and "applications list was not found" in reason
    assert db.execute(text("SELECT outcome FROM careeros.sync_runs")).scalar_one() == "failed"


def test_no_enabled_accounts_is_a_clean_no_op(env, db, seeded):
    assert job.run([]) == 0
    assert db.execute(text("SELECT count(*) FROM careeros.sync_runs")).scalar_one() == 0


def test_the_session_file_is_saved_privately_and_reused(env, db, seeded, tmp_path):
    with FakePortal() as portal:
        make_account_http(db, portal)
        run_job(portal=portal)
        assert portal.logins == 1
        run_job(portal=portal)
        assert portal.logins == 1  # the second run reused the saved session
    files = list((tmp_path / "sessions").glob("account-*.session.json"))
    assert len(files) == 1


def test_sign_out_flag_ends_the_session_and_deletes_the_saved_file(env, db, seeded, tmp_path):
    with FakePortal() as portal:
        make_account_http(db, portal)
        assert run_job("--sign-out", portal=portal) == 0
        assert portal.hits("/logout") == 1
        assert list((tmp_path / "sessions").glob("account-*.session.json")) == []
        run_job(portal=portal)
        assert portal.logins == 2  # a fresh login was needed


def test_exit_codes():
    ok, bad, attn, skipped = job.AccountResult("ok"), job.AccountResult("failed"), job.AccountResult("needs_attention"), job.AccountResult("skipped")
    assert job.exit_code([ok, skipped]) == 0
    assert job.exit_code([ok, attn]) == 1
    assert job.exit_code([ok, bad]) == 1
    assert job.exit_code([bad]) == 2
    assert job.exit_code([attn]) == 1
