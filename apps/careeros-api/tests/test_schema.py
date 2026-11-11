"""The database, not the Python code, is what keeps the data honest. These tests prove it."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError


def one(conn, sql: str, **params):
    return conn.execute(text(sql), params).scalar_one()


def make_app(conn, url="https://example.test/jobs/1") -> int:
    company = one(conn, "INSERT INTO careeros.companies (name, normalized_name) VALUES ('Acme', 'acme') ON CONFLICT (normalized_name) DO UPDATE SET name = 'Acme' RETURNING id")
    return one(
        conn,
        "INSERT INTO careeros.applications (company_id, title, normalized_url) VALUES (:c, 'Engineer', :u) RETURNING id",
        c=company,
        u=url,
    )


def fails(engine, sql: str, **params):
    with pytest.raises((IntegrityError, DBAPIError)):
        with engine.begin() as conn:
            conn.execute(text(sql), params)


def test_only_tracker_statuses_are_allowed(engine, db):
    app_id = make_app(db)
    fails(engine, "UPDATE careeros.applications SET status = 'Hired' WHERE id = :i", i=app_id)


def test_automated_changes_must_carry_the_portals_exact_words(engine, db):
    app_id = make_app(db)
    fails(
        engine,
        "INSERT INTO careeros.application_status_events (application_id, to_status, source) VALUES (:a, 'Applied', 'ats_sync')",
        a=app_id,
    )
    fails(
        engine,
        "INSERT INTO careeros.application_status_events (application_id, to_status, source, observed_text) VALUES (:a, 'Offer', 'ats_sync', '   ')",
        a=app_id,
    )


def test_unmapped_wording_is_recorded_only_at_low_confidence(engine, db):
    app_id = make_app(db)
    fails(
        engine,
        "INSERT INTO careeros.application_status_events (application_id, source, observed_text, confidence) VALUES (:a, 'ats_sync', 'Under review', 'high')",
        a=app_id,
    )
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO careeros.application_status_events (application_id, source, observed_text, confidence) VALUES (:a, 'ats_sync', 'Under review', 'low')"),
            {"a": app_id},
        )


def test_status_history_is_append_only(engine, db):
    app_id = make_app(db)
    with engine.begin() as conn:
        event = conn.execute(
            text("INSERT INTO careeros.application_status_events (application_id, to_status, source, observed_text) VALUES (:a, 'Applied', 'manual', 'x') RETURNING id"),
            {"a": app_id},
        ).scalar_one()
    fails(engine, "UPDATE careeros.application_status_events SET to_status = 'Offer' WHERE id = :i", i=event)
    fails(engine, "DELETE FROM careeros.application_status_events WHERE id = :i", i=event)


def test_ats_accounts_have_no_secret_columns_and_require_https(engine, db):
    columns = {r[0] for r in db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema='careeros' AND table_name='ats_accounts'"))}
    assert not {c for c in columns if "pass" in c or "secret" in c or "token" in c}
    fails(engine, "INSERT INTO careeros.ats_accounts (platform, label, base_url, username_ref) VALUES ('workday', 'x', 'http://insecure.test', 'ref')")
    fails(engine, "INSERT INTO careeros.ats_accounts (platform, label, base_url, username_ref) VALUES ('workday', 'x', 'https://ok.test', 'has space')")


def test_strong_self_ratings_need_evidence(engine, db):
    profile = one(db, "INSERT INTO careeros.profiles (display_name) VALUES ('Me') RETURNING id")
    skill = one(db, "INSERT INTO careeros.skills (name, category) VALUES ('Linux', 'Operating Systems') RETURNING id")
    fails(engine, "INSERT INTO careeros.profile_skills (profile_id, skill_id, proficiency) VALUES (:p, :s, 4)", p=profile, s=skill)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO careeros.profile_skills (profile_id, skill_id, proficiency) VALUES (:p, :s, 2)"), {"p": profile, "s": skill})


def test_one_master_profile_and_unique_skill_names(engine, db):
    one(db, "INSERT INTO careeros.profiles (display_name) VALUES ('Me') RETURNING id")
    one(db, "INSERT INTO careeros.skills (name, category) VALUES ('Linux', 'Operating Systems') RETURNING id")
    fails(engine, "INSERT INTO careeros.profiles (display_name) VALUES ('Someone else')")
    fails(engine, "INSERT INTO careeros.skills (name, category) VALUES ('LINUX', 'Other')")


def test_role_and_portfolio_slugs_are_url_safe(engine, db):
    fails(engine, "INSERT INTO careeros.role_profiles (slug, title) VALUES ('AWS Data Center', 'x')")
    fails(engine, "INSERT INTO careeros.portfolio_items (type, slug, title, summary) VALUES ('project', 'Bad Slug', 't', 's')")
    fails(engine, "INSERT INTO careeros.portfolio_items (type, slug, title, summary) VALUES ('blog', 'ok-slug', 't', 's')")


def test_skill_fit_view_distinguishes_unrated_from_zero(engine, db):
    app_id = make_app(db)
    profile = one(db, "INSERT INTO careeros.profiles (display_name) VALUES ('Me') RETURNING id")
    linux = one(db, "INSERT INTO careeros.skills (name, category) VALUES ('Linux', 'Operating Systems') RETURNING id")
    aws = one(db, "INSERT INTO careeros.skills (name, category) VALUES ('AWS', 'Cloud Platforms') RETURNING id")
    db.execute(text("INSERT INTO careeros.profile_skills (profile_id, skill_id, proficiency, evidence) VALUES (:p, :s, 3, 'Home lab')"), {"p": profile, "s": linux})
    db.execute(text("INSERT INTO careeros.job_requirements (application_id, skill_id, term, kind) VALUES (:a, :s, 'Linux', 'required'), (:a, :t, 'AWS', 'required')"), {"a": app_id, "s": linux, "t": aws})
    rows = {r.term: r for r in db.execute(text("SELECT term, proficiency, has_rating FROM careeros.application_skill_fit WHERE application_id = :a"), {"a": app_id})}
    assert (rows["Linux"].proficiency, rows["Linux"].has_rating) == (3, True)
    assert (rows["AWS"].proficiency, rows["AWS"].has_rating) == (0, False)


def test_deleting_a_company_with_applications_is_blocked(engine, db):
    app_id = make_app(db)
    assert app_id
    fails(engine, "DELETE FROM careeros.companies WHERE normalized_name = 'acme'")
