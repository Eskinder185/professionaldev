"""Playwright helpers: honest identity, saved sessions, politeness, and blocker detection."""

from __future__ import annotations

import os
import re
import time
from contextlib import contextmanager
from pathlib import Path

from .base import NeedsAttention

DEFAULT_USER_AGENT = "CareerOSStatusSync/0.1 (personal job-application tracker; automated, read-only)"
PAGE_DELAY_SECONDS = 1.5  # politeness, not disguise
NAV_TIMEOUT_MS = 30_000
ACTION_TIMEOUT_MS = 15_000

# Things that mean "a human must act". The job stops for the account; it never tries to get past them.
BLOCKER_SELECTORS = (
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare.com"]',
    "[data-sitekey]",
    ".g-recaptcha",
    ".h-captcha",
)
BLOCKER_TEXT = (
    (re.compile(r"verify (that )?you are (a )?human|are you a robot|unusual traffic|bot detection|captcha", re.I), "a bot check or CAPTCHA appeared"),
    (re.compile(r"verification code|two-factor|2-step|authenticator app|one-time (pass)?code|enter the code (we|that we)", re.I), "the portal asked for a verification code (MFA or an emailed code)"),
    (re.compile(r"access denied|forbidden|automated (access|traffic)|too many requests|temporarily blocked", re.I), "the portal blocked or rate-limited the request"),
    (re.compile(r"accept (the )?(updated )?(terms|privacy)|terms (of use|and conditions) (have )?(changed|updated)", re.I), "the portal is asking for new terms to be accepted"),
)


def user_agent() -> str:
    return os.environ.get("CAREEROS_SYNC_USER_AGENT", DEFAULT_USER_AGENT)


def polite_pause(seconds: float = PAGE_DELAY_SECONDS) -> None:
    time.sleep(seconds)


def detect_blocker(page) -> str | None:
    """A plain reason if the page needs a human, else None."""
    for selector in BLOCKER_SELECTORS:
        if page.locator(selector).count():
            return "a bot check or CAPTCHA appeared"
    try:
        body = page.locator("body").inner_text(timeout=2_000)
    except Exception:
        return None
    for pattern, reason in BLOCKER_TEXT:
        if pattern.search(body[:6000]):
            return reason
    return None


def raise_if_blocked(page) -> None:
    reason = detect_blocker(page)
    if reason:
        raise NeedsAttention(f"Stopped for a person: {reason}.")


def session_path(session_dir: Path, account_id: int) -> Path:
    return session_dir / f"account-{account_id}.session.json"


@contextmanager
def browser_page(playwright, storage_file: Path | None, headless: bool = True, save: bool = True):
    """A page whose cookies persist between runs in a private file (treat it as a secret)."""
    browser = playwright.chromium.launch(headless=headless)
    kwargs = {"user_agent": user_agent(), "locale": "en-US"}
    if storage_file and storage_file.exists():
        kwargs["storage_state"] = str(storage_file)
    context = browser.new_context(**kwargs)
    context.set_default_timeout(ACTION_TIMEOUT_MS)
    context.set_default_navigation_timeout(NAV_TIMEOUT_MS)
    page = context.new_page()
    try:
        yield page
        if storage_file and save:
            storage_file.parent.mkdir(parents=True, exist_ok=True)
            try:
                storage_file.parent.chmod(0o700)
            except OSError:
                pass
            context.storage_state(path=str(storage_file))
            try:
                storage_file.chmod(0o600)
            except OSError:
                pass
    finally:
        context.close()
        browser.close()
