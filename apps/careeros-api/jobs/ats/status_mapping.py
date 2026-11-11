"""Turn a portal's wording into one of the tracker's statuses, or admit that we can't.

The mapping is an explicit table. Unknown wording is NEVER guessed into a status: it is recorded as
observed text at low confidence. "Applied" and "Offer" are only produced when the text actually says so.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

STATUS_RANK = {"Saved": 0, "Preparing": 1, "Applied": 2, "Screening": 3, "Interview": 4, "Offer": 5, "Rejected": 6, "Withdrawn": 6}
TERMINAL = {"Rejected", "Withdrawn"}


@dataclass(frozen=True)
class Mapped:
    status: str | None  # None = could not be mapped
    confidence: str  # high | medium | low
    rule: str  # which table row matched, for the evidence trail


# (pattern, status, confidence). First match wins, so the specific/negative phrasings come first.
RULES: tuple[tuple[str, str, str], ...] = (
    # Endings first: "offer declined" must not become an Offer.
    (r"\b(you (have )?withdrew|withdrawn|candidate withdrew|application withdrawn)\b", "Withdrawn", "high"),
    (r"\b(offer (was )?(declined|rescinded|withdrawn))\b", "Withdrawn", "medium"),
    (r"\b(not selected|not moving forward|no longer (under consideration|being considered)|unsuccessful|rejected|declined by employer|we (have )?decided not to)\b", "Rejected", "high"),
    # Progress
    (r"\b(offer (extended|made|letter|pending acceptance)|offer accepted|received an offer)\b", "Offer", "high"),
    (r"\b(interview|onsite|on-site|final round)\b", "Interview", "high"),
    (r"\b(phone screen|recruiter screen|screening|initial screen|hiring manager review)\b", "Screening", "high"),
    # Receipt of the application
    (r"\b(application (was )?(submitted|received)|submitted|received|applied)\b", "Applied", "high"),
    (r"\b(under review|in review|being reviewed|reviewing|in progress|pending|active)\b", "Applied", "medium"),
)


def map_status(text: str | None) -> Mapped:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip().lower()
    if not cleaned:
        return Mapped(None, "low", "empty")
    for pattern, status, confidence in RULES:
        if re.search(pattern, cleaned):
            return Mapped(status, confidence, pattern)
    return Mapped(None, "low", "unmapped")


def decide_change(current: str, mapped: Mapped) -> str | None:
    """The status to move to, or None when nothing should change.

    Only high/medium-confidence mappings can change a status. A portal that says "Under review" does
    not drag an application back from Interview. Rejected/Withdrawn can follow any stage. "Offer" needs
    high confidence.
    """
    if mapped.status is None or mapped.confidence == "low":
        return None
    new = mapped.status
    if new == current:
        return None
    if new == "Offer" and mapped.confidence != "high":
        return None
    if new in TERMINAL:
        return new
    if current in TERMINAL:
        return None  # a closed application is not reopened by a status label
    return new if STATUS_RANK[new] > STATUS_RANK[current] else None
