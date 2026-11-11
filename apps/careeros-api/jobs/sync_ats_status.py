"""Read the status of MY submitted applications from candidate portals and record changes.

  python -m jobs.sync_ats_status --dry-run -v      # read and report, write nothing
  python -m jobs.sync_ats_status                   # real run (cron / systemd timer)
  python -m jobs.sync_ats_status --account 2 --max-pages 2
  python -m jobs.sync_ats_status --sign-out        # also sign out and delete the saved session

Safety rules (also enforced in code, see jobs/ats/):
  * read-only: log in (reusing a saved session when valid), read, stop. Nothing is submitted, edited, withdrawn, uploaded or accepted;
  * a CAPTCHA, bot check, MFA or new terms stops that account with `needs_attention`; the job never
    solves, bypasses or retries around them;
  * an account runs only after you have set ats_accounts.automation_acknowledged_at (you read its terms);
  * credentials come from the environment (see jobs/ats/secrets.py), never from the database or logs;
  * unknown wording is stored as observed text at low confidence, never guessed into a status;
  * portal entries that match none of your applications are reported, never created.

Exit codes: 0 ok, 1 partial (some accounts need attention or failed), 2 failed (everything failed).
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db import make_engine, make_session_factory
from app.models import AtsAccount, SyncRun, SyncRunAccount

from .ats.base import AdapterFailed, AtsAdapter, NeedsAttention
from .ats.browser import browser_page, polite_pause, session_path
from .ats.greenhouse import GreenhouseAdapter
from .ats.matching import match_entry
from .ats.secrets import get_credentials
from .ats.store import (
    EntryResult,
    apply_entry,
    linked_application,
    load_accounts,
    load_candidates,
    preview_entry,
    record_unmatched,
)
from .ats.workday import WorkdayAdapter

log = logging.getLogger("careeros.sync")

ADAPTERS: dict[str, AtsAdapter] = {"workday": WorkdayAdapter(), "greenhouse": GreenhouseAdapter()}


@dataclass
class AccountResult:
    outcome: str  # ok | needs_attention | failed | skipped
    reason: str | None = None
    seen: int = 0
    changed: int = 0
    unmatched: int = 0
    observed: int = 0
    changes: list[EntryResult] = field(default_factory=list)


def sync_account(
    factory: sessionmaker[Session],
    playwright,
    account: AtsAccount,
    adapter: AtsAdapter,
    *,
    run_id: int | None,
    dry_run: bool,
    max_pages: int,
    session_dir: Path,
    env=None,
    sign_out: bool = False,
) -> AccountResult:
    """One account, start to finish. Never raises for portal problems: they become the result."""
    if account.automation_acknowledged_at is None:
        return AccountResult("skipped", "Not run: set automation_acknowledged_at after reading this portal's terms on automated access.")
    result = AccountResult("ok")
    try:
        credentials = get_credentials(account.username_ref, env)
        with browser_page(playwright, session_path(session_dir, account.id), save=not (sign_out or dry_run)) as page:
            adapter.login(page, account.base_url, credentials)
            entries = adapter.list_applications(page, account.base_url, max_pages)
            result.seen = len(entries)
            with factory() as read_session:
                candidates = load_candidates(read_session)
                statuses = {c.id: s for c, s in ((c, _current_status(read_session, c.id)) for c in candidates)}
            for entry in entries:
                if entry.company is None and account.employer_name:
                    entry = replace(entry, company=account.employer_name)  # the list doesn't name the employer
                match = match_entry(entry, candidates)
                if match is None:
                    result.unmatched += 1
                    if not dry_run:
                        with factory.begin() as session:
                            record_unmatched(session, run_id, account.id, entry)  # type: ignore[arg-type]
                    continue
                if dry_run:
                    outcome = preview_entry(entry, statuses.get(match.application_id), match)
                else:
                    with factory.begin() as session:  # one transaction per application
                        outcome = apply_entry(session, run_id, account, entry, match)  # type: ignore[arg-type]
                if outcome.kind == "changed":
                    result.changed += 1
                    result.changes.append(outcome)
                elif outcome.kind == "observed":
                    result.observed += 1
            if sign_out:
                adapter.logout(page, account.base_url)
    except NeedsAttention as exc:
        return AccountResult("needs_attention", str(exc), seen=result.seen, changed=result.changed, unmatched=result.unmatched)
    except AdapterFailed as exc:
        return AccountResult("failed", str(exc), seen=result.seen, changed=result.changed, unmatched=result.unmatched)
    except Exception as exc:  # Playwright timeouts etc. Report the type, never page content or credentials.
        return AccountResult("failed", f"{type(exc).__name__}: the portal did not respond as expected.", seen=result.seen)
    finally:
        if sign_out:
            session_path(session_dir, account.id).unlink(missing_ok=True)
    return result


def _current_status(session: Session, application_id: int) -> str:
    from app.models import Application

    return session.scalar(select(Application.status).where(Application.id == application_id)) or "Saved"


def exit_code(results: list[AccountResult]) -> int:
    ran = [r for r in results if r.outcome != "skipped"]
    failed = sum(r.outcome == "failed" for r in ran)
    attention = sum(r.outcome == "needs_attention" for r in ran)
    ok = sum(r.outcome == "ok" for r in ran)
    if failed and not ok and not attention:
        return 2
    return 1 if (failed or attention) else 0


def run(argv: list[str] | None = None, *, playwright_factory=None, adapters=None, env=None) -> int:
    parser = argparse.ArgumentParser(prog="sync_ats_status", description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="read and report; write nothing at all")
    parser.add_argument("--account", help="only this ats_accounts id or label")
    parser.add_argument("--max-pages", type=int, default=3, help="cap on list pages per account (default 3)")
    parser.add_argument("--sign-out", action="store_true", help="sign out and delete the saved session (default: keep it, so the next run needn't log in again)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)
    if not 1 <= args.max_pages <= 20:
        parser.error("--max-pages must be between 1 and 20")
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, stream=sys.stdout, format="%(asctime)s %(levelname)s %(message)s")

    settings = get_settings()
    engine = make_engine(settings)
    factory = make_session_factory(engine)
    adapters = adapters or ADAPTERS
    try:
        with factory() as session:
            accounts = load_accounts(session, args.account)
            for a in accounts:
                session.expunge(a)
        if not accounts:
            log.info("no enabled accounts%s; nothing to do", f" matching '{args.account}'" if args.account else "")
            return 0

        run_id: int | None = None
        if not args.dry_run:
            with factory.begin() as session:
                row = SyncRun(dry_run=False)
                session.add(row)
                session.flush()
                run_id = row.id
        log.info("sync started run=%s dry_run=%s accounts=%d", run_id, args.dry_run, len(accounts))

        if playwright_factory is None:
            from playwright.sync_api import sync_playwright as playwright_factory  # imported late: the API never needs it

        results: list[tuple[AtsAccount, AccountResult]] = []
        with playwright_factory() as pw:
            for index, account in enumerate(accounts):
                adapter = adapters.get(account.platform)
                if adapter is None:
                    res = AccountResult("failed", f"No adapter for platform '{account.platform}'.")
                else:
                    res = sync_account(
                        factory, pw, account, adapter, run_id=run_id, dry_run=args.dry_run, max_pages=args.max_pages, session_dir=settings.session_dir, env=env, sign_out=args.sign_out
                    )
                results.append((account, res))
                log.info("account=%d platform=%s outcome=%s seen=%d changed=%d unmatched=%d", account.id, account.platform, res.outcome, res.seen, res.changed, res.unmatched)
                if res.reason:
                    log.warning("account=%d reason=%s", account.id, res.reason)
                if index < len(accounts) - 1:
                    polite_pause()  # one account at a time, with a pause between

        code = exit_code([r for _, r in results])
        if run_id is not None:
            with factory.begin() as session:
                row = session.get(SyncRun, run_id)
                assert row is not None
                row.finished_at = datetime.now(timezone.utc)
                row.outcome = {0: "ok", 1: "partial", 2: "failed"}[code]
                row.accounts_checked = sum(r.outcome != "skipped" for _, r in results)
                row.entries_seen = sum(r.seen for _, r in results)
                row.status_changes = sum(r.changed for _, r in results)
                row.unmatched = sum(r.unmatched for _, r in results)
                reasons = [f"account {a.id}: {r.reason}" for a, r in results if r.reason]
                row.error_summary = "\n".join(reasons)[:4000] or None
                for a, r in results:
                    session.add(SyncRunAccount(sync_run_id=run_id, ats_account_id=a.id, outcome=r.outcome, reason=r.reason, entries_seen=r.seen))
        log.info("sync finished exit=%d changes=%d", code, sum(r.changed for _, r in results))
        return code
    finally:
        engine.dispose()


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
