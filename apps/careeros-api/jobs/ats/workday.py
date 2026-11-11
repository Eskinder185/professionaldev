"""Workday candidate portal (<tenant>.wd#.myworkdayjobs.com/<site>) adapter. READ-ONLY.

HONEST STATUS: the selectors below follow Workday's `data-automation-id` conventions, but they have
NOT been checked against a live tenant (no tenant credentials were available). Tenants customise
their sites, so expect to adjust SELECTORS on first real use. They are all in this one place for that
reason. The adapter is tested against a local fixture that imitates this layout, which proves the
flow, the parsing and the safety behaviour, not that a particular employer's portal works.

Terms: Workday's general website terms prohibit automated access and scraping without consent. Whether
they govern a particular employer's candidate site is unclear; read the "Terms" link in that site's
footer and only then set ats_accounts.automation_acknowledged_at.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urljoin

from .base import AdapterFailed, Credentials, NeedsAttention, PortalEntry
from .browser import polite_pause, raise_if_blocked


@dataclass(frozen=True)
class Selectors:
    """THE PART MOST LIKELY TO BREAK. Change these, nothing else, when a tenant looks different."""

    signed_in_marker: str = '[data-automation-id="candidateHome"], [data-automation-id="applicationsSectionHeading"]'
    open_sign_in: str = '[data-automation-id="utilityButtonSignIn"], [data-automation-id="signInLink"]'
    email: str = '[data-automation-id="email"]'
    password: str = '[data-automation-id="password"]'
    submit: str = '[data-automation-id="click_filter"], [data-automation-id="signInSubmitButton"]'
    login_error: str = '[data-automation-id="errorMessage"], [data-automation-id="errorBanner"]'
    applications_table: str = '[data-automation-id="applicationsTable"], table[role="grid"]'
    row: str = "tbody tr"
    title_link: str = 'a[data-automation-id="applicationTitle"], td a'
    status_cell: str = '[data-automation-id="applicationStatus"], td:last-child'
    next_page: str = '[data-automation-id="nextPage"], button[aria-label="next"]'
    sign_out_menu: str = '[data-automation-id="utilityMenuButton"]'
    sign_out: str = '[data-automation-id="signOut"], [data-automation-id="utilitySignOut"]'


SELECTORS = Selectors()
HOME_PATH = "/userHome"


def _external_id(href: str) -> str:
    """The requisition-style id at the end of a Workday job link, e.g. .../Engineer_R-12345 -> R-12345."""
    tail = href.rstrip("/").rsplit("/", 1)[-1]
    match = re.search(r"(R-?\d+|JR-?\d+|REQ-?\d+)$", tail, re.I)
    return (match.group(1) if match else tail)[:200]


class WorkdayAdapter:
    platform = "workday"

    def __init__(self, selectors: Selectors = SELECTORS) -> None:
        self.s = selectors

    def login(self, page, base_url: str, credentials: Credentials) -> None:
        page.goto(base_url.rstrip("/") + HOME_PATH, wait_until="domcontentloaded")
        raise_if_blocked(page)
        if page.locator(self.s.signed_in_marker).count():
            return  # the saved session is still valid
        if page.locator(self.s.open_sign_in).count() and not page.locator(self.s.email).count():
            page.locator(self.s.open_sign_in).first.click()
        if not page.locator(self.s.email).count():
            raise AdapterFailed("The sign-in form was not found. The tenant's layout may differ from the adapter's selectors.")
        page.locator(self.s.email).first.fill(credentials.username)
        page.locator(self.s.password).first.fill(credentials.password)
        page.locator(self.s.submit).first.click()
        # Wait for the page to show either the signed-in page or an error; never rely on a fixed pause.
        try:
            page.locator(f"{self.s.signed_in_marker}, {self.s.login_error}").first.wait_for(timeout=15_000)
        except Exception:
            pass  # fall through: blockers and the checks below explain what happened
        raise_if_blocked(page)
        if page.locator(self.s.login_error).count():
            # Do not retry: repeated bad logins can lock the account.
            raise NeedsAttention("The portal rejected the sign-in. Check the saved username and password; the job will not retry.")
        if not page.locator(self.s.signed_in_marker).count():
            raise NeedsAttention("Signing in did not reach the candidate home page (possibly an extra step such as MFA). A person needs to look.")

    def list_applications(self, page, base_url: str, max_pages: int) -> list[PortalEntry]:
        if HOME_PATH not in page.url:
            page.goto(base_url.rstrip("/") + HOME_PATH, wait_until="domcontentloaded")
        raise_if_blocked(page)
        entries: list[PortalEntry] = []
        for visited in range(max(1, max_pages)):
            table = page.locator(self.s.applications_table)
            if not table.count():
                if visited == 0:
                    raise AdapterFailed("The applications list was not found on the candidate home page.")
                break
            for row in table.first.locator(self.s.row).all():
                link = row.locator(self.s.title_link).first
                if not link.count():
                    continue
                href = link.get_attribute("href") or ""
                title = (link.inner_text() or "").strip()
                status = (row.locator(self.s.status_cell).first.inner_text() or "").strip()
                if not title or not status:
                    continue
                url = urljoin(page.url, href) if href else None
                entries.append(PortalEntry(external_id=_external_id(href or title), title=title, status_text=status, url=url, requisition_id=_external_id(href) if href else None))
            nxt = page.locator(self.s.next_page)
            if not nxt.count() or nxt.first.is_disabled():
                break
            polite_pause()
            nxt.first.click()
            page.wait_for_load_state("domcontentloaded")
            raise_if_blocked(page)
        return entries

    def read_status(self, page, entry: PortalEntry) -> str:
        return entry.status_text  # the list already shows the status; no extra page visits

    def logout(self, page, base_url: str) -> None:
        try:
            # Short timeouts: signing out is a courtesy, never worth a long wait.
            menu = page.locator(self.s.sign_out_menu)
            if menu.count() and menu.first.is_visible():
                menu.first.click(timeout=3_000)
            out = page.locator(self.s.sign_out)
            if out.count() and out.first.is_visible():
                out.first.click(timeout=3_000)
        except Exception:
            pass  # best effort; the job still ends cleanly
