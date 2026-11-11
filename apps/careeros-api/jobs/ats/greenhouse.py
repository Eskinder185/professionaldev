"""Greenhouse (MyGreenhouse candidate account) adapter. READ-ONLY.

WHAT IS AND ISN'T AVAILABLE, plainly:
  * Greenhouse is employer software. Whether a candidate has any status page depends on the employer;
    many applicants only ever receive emails. For those, use jobs/ats/email_fallback.py (interface only).
  * MyGreenhouse sign-in has been reported to rely on an emailed one-time code rather than a password.
    That cannot and must not be automated here, so this adapter stops with needs_attention when it sees
    a code prompt. It only works if your account offers a password form and a visible applications list.
  * The selectors are UNVERIFIED against a live account. They are isolated in SELECTORS.
  * I did not find Greenhouse's candidate-side terms on automated access. Read them yourself before you
    set ats_accounts.automation_acknowledged_at.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin

from .base import AdapterFailed, Credentials, NeedsAttention, PortalEntry
from .browser import raise_if_blocked


@dataclass(frozen=True)
class Selectors:
    """THE PART MOST LIKELY TO BREAK."""

    signed_in_marker: str = '[data-testid="applications-list"], #applications'
    email: str = 'input[type="email"], input[name="email"]'
    password: str = 'input[type="password"], input[name="password"]'
    submit: str = 'button[type="submit"]'
    code_prompt: str = 'input[autocomplete="one-time-code"], input[name*="code" i]'
    login_error: str = '[role="alert"], .error'
    card: str = '[data-testid="application-card"], #applications li'
    title: str = '[data-testid="application-title"], h3, a'
    company: str = '[data-testid="application-company"], .company'
    status: str = '[data-testid="application-status"], .status'
    link: str = "a"


SELECTORS = Selectors()
APPLICATIONS_PATH = "/applications"


class GreenhouseAdapter:
    platform = "greenhouse"

    def __init__(self, selectors: Selectors = SELECTORS) -> None:
        self.s = selectors

    def login(self, page, base_url: str, credentials: Credentials) -> None:
        page.goto(base_url.rstrip("/") + APPLICATIONS_PATH, wait_until="domcontentloaded")
        raise_if_blocked(page)
        if page.locator(self.s.signed_in_marker).count():
            return
        if page.locator(self.s.code_prompt).count() and not page.locator(self.s.password).count():
            raise NeedsAttention("MyGreenhouse asked for an emailed one-time code. That can't be automated; use the email fallback or check the status by hand.")
        if not page.locator(self.s.email).count():
            raise AdapterFailed("No sign-in form was found. This employer may not offer a candidate portal.")
        page.locator(self.s.email).first.fill(credentials.username)
        if page.locator(self.s.password).count():
            page.locator(self.s.password).first.fill(credentials.password)
        page.locator(self.s.submit).first.click()
        try:
            page.locator(f"{self.s.signed_in_marker}, {self.s.code_prompt}, {self.s.login_error}").first.wait_for(timeout=15_000)
        except Exception:
            pass
        raise_if_blocked(page)
        if page.locator(self.s.code_prompt).count():
            raise NeedsAttention("MyGreenhouse asked for an emailed one-time code after sign-in. A person needs to complete it.")
        if page.locator(self.s.login_error).count():
            raise NeedsAttention("The portal rejected the sign-in; the job will not retry.")
        if not page.locator(self.s.signed_in_marker).count():
            raise NeedsAttention("Signing in did not reach an applications list. A person needs to look.")

    def list_applications(self, page, base_url: str, max_pages: int) -> list[PortalEntry]:
        raise_if_blocked(page)
        entries: list[PortalEntry] = []
        for card in page.locator(self.s.card).all()[: 50 * max(1, max_pages)]:
            title = (card.locator(self.s.title).first.inner_text() or "").strip()
            status = (card.locator(self.s.status).first.inner_text() or "").strip() if card.locator(self.s.status).count() else ""
            if not title or not status:
                continue
            company = (card.locator(self.s.company).first.inner_text() or "").strip() if card.locator(self.s.company).count() else None
            href = card.locator(self.s.link).first.get_attribute("href") if card.locator(self.s.link).count() else None
            url = urljoin(page.url, href) if href else None
            ext = (href or title).rstrip("/").rsplit("/", 1)[-1][:200]
            entries.append(PortalEntry(external_id=ext, title=title, status_text=status, company=company, url=url))
        return entries

    def read_status(self, page, entry: PortalEntry) -> str:
        return entry.status_text

    def logout(self, page, base_url: str) -> None:
        return None  # nothing to click reliably; the saved session file is the only state
