"""Database writes for the sync job. Each application is updated in its own transaction."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, lazyload

from app.models import (
    Application,
    AtsAccount,
    AtsApplicationLink,
    AtsUnmatchedEntry,
    Company,
    StatusEvent,
)
from .base import PortalEntry
from .matching import Candidate, Match
from .status_mapping import Mapped, decide_change, map_status


def load_accounts(session: Session, only: str | None) -> list[AtsAccount]:
    query = select(AtsAccount).where(AtsAccount.enabled.is_(True)).order_by(AtsAccount.id)
    accounts = list(session.scalars(query))
    if only:
        accounts = [a for a in accounts if str(a.id) == only or a.label.lower() == only.lower()]
    return accounts


def load_candidates(session: Session) -> list[Candidate]:
    rows = session.execute(
        select(Application.id, Application.normalized_url, Application.requisition_id, Application.title, Company.name).join(
            Company, Company.id == Application.company_id
        )
    )
    return [Candidate(id=r[0], normalized_url=r[1], requisition_id=r[2], title=r[3], company=r[4]) for r in rows]


def linked_application(session: Session, account_id: int, external_id: str) -> AtsApplicationLink | None:
    return session.scalar(
        select(AtsApplicationLink).where(AtsApplicationLink.ats_account_id == account_id, AtsApplicationLink.external_id == external_id)
    )


@dataclass(frozen=True)
class EntryResult:
    kind: str  # unchanged | changed | observed | unmatched
    application_id: int | None = None
    from_status: str | None = None
    to_status: str | None = None


def preview_entry(entry: PortalEntry, current_status: str | None, match: Match | None) -> EntryResult:
    """What apply_entry would do, without touching the database (used by --dry-run)."""
    if match is None or current_status is None:
        return EntryResult("unmatched")
    mapped = _cap(map_status(entry.status_text), match)
    target = decide_change(current_status, mapped)
    if target:
        return EntryResult("changed", match.application_id, current_status, target)
    return EntryResult("observed" if mapped.status is None else "unchanged", match.application_id)


def _cap(mapped: Mapped, match: Match) -> Mapped:
    """A fuzzy title+company match can never produce a high-confidence status (so never an Offer)."""
    if match.by == "title_company" and mapped.confidence == "high":
        return Mapped(mapped.status, "medium", mapped.rule)
    return mapped


def apply_entry(session: Session, run_id: int, account: AtsAccount, entry: PortalEntry, match: Match) -> EntryResult:
    """Record one observation. The caller commits (one transaction per application)."""
    now = datetime.now(timezone.utc)
    link = linked_application(session, account.id, entry.external_id)
    if link is None:
        link = AtsApplicationLink(
            application_id=match.application_id,
            ats_account_id=account.id,
            external_id=entry.external_id,
            external_url=entry.url,
            matched_by=match.by,
            match_confidence=Decimal(str(match.confidence)),
        )
        session.add(link)
    link.last_checked_at = now

    # An unchanged page never creates a new event, however many times the job runs.
    if link.last_observed_text == entry.status_text:
        return EntryResult("unchanged", link.application_id)

    # Lock only the application row (the company join would be the nullable side of an outer join).
    app = session.scalar(
        select(Application).where(Application.id == link.application_id).options(lazyload(Application.company)).with_for_update(of=Application)
    )
    if app is None:  # pragma: no cover - the foreign key prevents this
        return EntryResult("unmatched")
    mapped = _cap(map_status(entry.status_text), match)
    target = decide_change(app.status, mapped)
    evidence = f"Portal text: \"{entry.status_text}\" (matched by {match.by}, rule: {mapped.rule})"

    if target:
        session.add(
            StatusEvent(
                application_id=app.id,
                from_status=app.status,
                to_status=target,
                observed_text=entry.status_text,
                source="ats_sync",
                confidence=mapped.confidence,
                evidence=evidence,
                observed_at=now,
                sync_run_id=run_id,
            )
        )
        result = EntryResult("changed", app.id, app.status, target)
        app.status = target
        app.last_activity_at = now
        if target == "Applied" and app.applied_at is None:
            app.applied_at = date.today()
    elif mapped.status is None:
        # Wording we cannot map: keep it, at low confidence, with no status change.
        session.add(
            StatusEvent(
                application_id=app.id,
                from_status=app.status,
                to_status=None,
                observed_text=entry.status_text,
                source="ats_sync",
                confidence="low",
                evidence=evidence,
                observed_at=now,
                sync_run_id=run_id,
            )
        )
        result = EntryResult("observed", app.id)
    else:
        result = EntryResult("unchanged", app.id)  # same or an earlier stage: nothing to record
    link.last_observed_text = entry.status_text
    return result


def record_unmatched(session: Session, run_id: int, account_id: int, entry: PortalEntry) -> None:
    session.add(
        AtsUnmatchedEntry(
            sync_run_id=run_id,
            ats_account_id=account_id,
            external_id=entry.external_id,
            title=entry.title[:300],
            company=(entry.company or None),
            observed_text=entry.status_text,
        )
    )


__all__ = [
    "EntryResult",
    "apply_entry",
    "linked_application",
    "load_accounts",
    "load_candidates",
    "preview_entry",
    "record_unmatched",
]
