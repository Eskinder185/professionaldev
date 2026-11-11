"""The contract every portal adapter follows, and the errors that mean "stop, a human is needed"."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class NeedsAttention(Exception):
    """A CAPTCHA, bot check, MFA step, changed login, or other blocker.

    The job records the reason, skips this account, and carries on with the others. It never
    solves, bypasses, or retries around the blocker.
    """


class AdapterFailed(Exception):
    """The portal did not behave as the adapter expects (layout changed, timeout)."""


@dataclass(frozen=True)
class Credentials:
    username: str
    password: str

    def __repr__(self) -> str:  # never print the password, even by accident in a log line
        return "Credentials(username=<hidden>, password=<hidden>)"


@dataclass(frozen=True)
class PortalEntry:
    """One application as the portal shows it."""

    external_id: str
    title: str
    status_text: str
    company: str | None = None
    url: str | None = None
    requisition_id: str | None = None


class AtsAdapter(Protocol):
    """Read-only access to one candidate portal. No method may submit, edit, withdraw, or upload."""

    platform: str

    def login(self, page, base_url: str, credentials: Credentials) -> None: ...

    def list_applications(self, page, base_url: str, max_pages: int) -> list[PortalEntry]: ...

    def read_status(self, page, entry: PortalEntry) -> str:
        """The portal's exact status wording for one entry (may just return entry.status_text)."""
        ...

    def logout(self, page, base_url: str) -> None: ...
