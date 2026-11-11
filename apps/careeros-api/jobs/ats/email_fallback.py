"""Fallback for portals with no status page (many Greenhouse employers): read forwarded emails instead.

This is only the interface, for later. A future implementation reads confirmation/status emails you
forward to a mailbox you control (IMAP read-only), extracts the exact sentence, and feeds
`PortalEntry` objects through the same matching and status-mapping code, with source='email'.
It must never log in to a mailbox it does not own, and must keep the original sentence as evidence.
"""

from __future__ import annotations

from typing import Protocol

from .base import PortalEntry


class EmailStatusSource(Protocol):
    def fetch_entries(self, since_iso: str) -> list[PortalEntry]:
        """Entries derived from emails received since the given ISO timestamp."""
        ...
