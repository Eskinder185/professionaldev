"""Match a portal entry to one of my applications. Unmatched entries are reported, never invented."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from app.urlnorm import normalize_company, normalize_title, normalize_url

from .base import PortalEntry

MIN_TITLE_SIMILARITY = 0.85
AMBIGUITY_MARGIN = 0.05


@dataclass(frozen=True)
class Candidate:
    """The fields of an application the matcher needs."""

    id: int
    normalized_url: str
    requisition_id: str | None
    title: str
    company: str


@dataclass(frozen=True)
class Match:
    application_id: int
    by: str  # url | requisition | title_company
    confidence: float


def match_entry(entry: PortalEntry, candidates: list[Candidate]) -> Match | None:
    # 1. The job URL, normalised the same way as applications.normalized_url.
    url = normalize_url(entry.url)
    if url:
        hits = [c for c in candidates if c.normalized_url == url]
        if len(hits) == 1:
            return Match(hits[0].id, "url", 1.0)

    # 2. The requisition id, when both sides have one. Two applications sharing it is ambiguous.
    if entry.requisition_id:
        wanted = entry.requisition_id.strip().lower()
        hits = [c for c in candidates if c.requisition_id and c.requisition_id.strip().lower() == wanted]
        if len(hits) == 1:
            return Match(hits[0].id, "requisition", 0.95)

    # 3. Company must agree exactly (after normalising); the title must be very close. The best match
    #    must clearly beat the runner-up, otherwise it is left unmatched for a person to decide.
    if entry.company and entry.title:
        company = normalize_company(entry.company)
        title = normalize_title(entry.title)
        scored = sorted(
            (
                (SequenceMatcher(None, title, normalize_title(c.title)).ratio(), c)
                for c in candidates
                if normalize_company(c.company) == company
            ),
            key=lambda pair: pair[0],
            reverse=True,
        )
        if scored and scored[0][0] >= MIN_TITLE_SIMILARITY:
            if len(scored) == 1 or scored[0][0] - scored[1][0] >= AMBIGUITY_MARGIN:
                return Match(scored[0][1].id, "title_company", round(scored[0][0] * 0.8, 2))
    return None
