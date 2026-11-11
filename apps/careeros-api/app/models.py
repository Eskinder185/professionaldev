"""SQLAlchemy 2.x typed models. They mirror sql/001_init.sql exactly (schema "careeros").

The database owns constraints (CHECKs, uniqueness, append-only triggers); these models describe the
shape so queries are typed. Nothing calls create_all.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "careeros"

# The statuses the website tracker uses (src/features/tracker/model.ts STAGES), in order.
STATUSES = ("Saved", "Preparing", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn")


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


def _id() -> Mapped[int]:
    return mapped_column(BigInteger, Identity(always=True), primary_key=True)


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = _id()
    name: Mapped[str] = mapped_column(String(200))
    normalized_name: Mapped[str] = mapped_column(String(200), unique=True)
    website: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = _now()


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = _id()
    company_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.companies.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(300))
    job_url: Mapped[str | None] = mapped_column(String(2000))
    normalized_url: Mapped[str] = mapped_column(String(2000), unique=True)
    requisition_id: Mapped[str | None] = mapped_column(String(120))
    platform: Mapped[str] = mapped_column(String(40), server_default="other")
    location: Mapped[str | None] = mapped_column(String(300))
    salary_text: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="Saved")
    applied_at: Mapped[date | None] = mapped_column(Date)
    match_score: Mapped[int | None] = mapped_column(SmallInteger)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = _now()
    last_activity_at: Mapped[datetime] = _now()

    company: Mapped[Company] = relationship(lazy="joined")
    events: Mapped[list[StatusEvent]] = relationship(
        back_populates="application", order_by="StatusEvent.observed_at.desc(), StatusEvent.id.desc()", lazy="select"
    )


class StatusEvent(Base):
    __tablename__ = "application_status_events"
    id: Mapped[int] = _id()
    application_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.applications.id", ondelete="CASCADE"))
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str | None] = mapped_column(String(20))
    observed_text: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[str] = mapped_column(String(8), server_default="high")
    evidence: Mapped[str | None] = mapped_column(Text)
    observed_at: Mapped[datetime] = _now()
    sync_run_id: Mapped[int | None] = mapped_column(ForeignKey(f"{SCHEMA}.sync_runs.id", ondelete="SET NULL"))

    application: Mapped[Application] = relationship(back_populates="events")


class AtsAccount(Base):
    __tablename__ = "ats_accounts"
    id: Mapped[int] = _id()
    platform: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(120))
    employer_name: Mapped[str | None] = mapped_column(String(200))
    base_url: Mapped[str] = mapped_column(String(500))
    # The NAME of a secret stored outside the database. There is intentionally no password column.
    username_ref: Mapped[str] = mapped_column(String(120))
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true")
    automation_acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()


class SyncRun(Base):
    __tablename__ = "sync_runs"
    id: Mapped[int] = _id()
    started_at: Mapped[datetime] = _now()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[str] = mapped_column(String(12), server_default="running")
    dry_run: Mapped[bool] = mapped_column(Boolean, server_default="false")
    accounts_checked: Mapped[int] = mapped_column(Integer, server_default="0")
    entries_seen: Mapped[int] = mapped_column(Integer, server_default="0")
    status_changes: Mapped[int] = mapped_column(Integer, server_default="0")
    unmatched: Mapped[int] = mapped_column(Integer, server_default="0")
    error_summary: Mapped[str | None] = mapped_column(Text)


class SyncRunAccount(Base):
    __tablename__ = "sync_run_accounts"
    sync_run_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.sync_runs.id", ondelete="CASCADE"), primary_key=True)
    ats_account_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ats_accounts.id", ondelete="CASCADE"), primary_key=True)
    outcome: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(Text)
    entries_seen: Mapped[int] = mapped_column(Integer, server_default="0")


class AtsApplicationLink(Base):
    __tablename__ = "ats_application_links"
    id: Mapped[int] = _id()
    application_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.applications.id", ondelete="CASCADE"))
    ats_account_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ats_accounts.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(200))
    external_url: Mapped[str | None] = mapped_column(String(2000))
    matched_by: Mapped[str] = mapped_column(String(20))
    match_confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    last_observed_text: Mapped[str | None] = mapped_column(Text)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _now()


class AtsUnmatchedEntry(Base):
    __tablename__ = "ats_unmatched_entries"
    id: Mapped[int] = _id()
    sync_run_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.sync_runs.id", ondelete="CASCADE"))
    ats_account_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.ats_accounts.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(200))
    observed_text: Mapped[str | None] = mapped_column(Text)
    seen_at: Mapped[datetime] = _now()


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = _id()
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(120))
    aliases: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    case_sensitive: Mapped[bool] = mapped_column(Boolean, server_default="false")


class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[int] = _id()
    display_name: Mapped[str] = mapped_column(String(200))
    is_master: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = _now()


class ProfileSkill(Base):
    __tablename__ = "profile_skills"
    profile_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.skills.id", ondelete="RESTRICT"), primary_key=True)
    proficiency: Mapped[int] = mapped_column(SmallInteger)
    years: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    evidence: Mapped[str | None] = mapped_column(Text)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JobRequirement(Base):
    __tablename__ = "job_requirements"
    id: Mapped[int] = _id()
    application_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.applications.id", ondelete="CASCADE"))
    skill_id: Mapped[int | None] = mapped_column(ForeignKey(f"{SCHEMA}.skills.id", ondelete="SET NULL"))
    term: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))
    evidence: Mapped[str | None] = mapped_column(Text)
    uncertain: Mapped[bool] = mapped_column(Boolean, server_default="false")


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[int] = _id()
    type: Mapped[str] = mapped_column(String(16))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    issuer: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(500))
    repo_url: Mapped[str | None] = mapped_column(String(500))
    started_on: Mapped[date | None] = mapped_column(Date)
    ended_on: Mapped[date | None] = mapped_column(Date)
    published: Mapped[bool] = mapped_column(Boolean, server_default="false")
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = _now()


class RoleProfile(Base):
    __tablename__ = "role_profiles"
    id: Mapped[int] = _id()
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)


class PortfolioItemRole(Base):
    __tablename__ = "portfolio_item_roles"
    item_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.portfolio_items.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.role_profiles.id", ondelete="CASCADE"), primary_key=True)
    relevance: Mapped[int] = mapped_column(SmallInteger, server_default="3")


class PortfolioItemSkill(Base):
    __tablename__ = "portfolio_item_skills"
    item_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.portfolio_items.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.skills.id", ondelete="CASCADE"), primary_key=True)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[int] = _id()
    application_id: Mapped[int | None] = mapped_column(ForeignKey(f"{SCHEMA}.applications.id", ondelete="SET NULL"))
    role_profile_id: Mapped[int | None] = mapped_column(ForeignKey(f"{SCHEMA}.role_profiles.id", ondelete="SET NULL"))
    model: Mapped[str | None] = mapped_column(String(200))
    started_at: Mapped[datetime] = _now()
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InterviewTurn(Base):
    __tablename__ = "interview_turns"
    id: Mapped[int] = _id()
    session_id: Mapped[int] = mapped_column(ForeignKey(f"{SCHEMA}.interview_sessions.id", ondelete="CASCADE"))
    turn_index: Mapped[int] = mapped_column(Integer)
    skill_id: Mapped[int | None] = mapped_column(ForeignKey(f"{SCHEMA}.skills.id", ondelete="SET NULL"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    rubric: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    model: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = _now()
