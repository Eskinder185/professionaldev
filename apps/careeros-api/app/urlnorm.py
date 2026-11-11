"""Normalisation shared by the API and the sync job, so URLs and names compare the same way everywhere."""

from __future__ import annotations

import re
from urllib.parse import urlsplit


def normalize_url(raw: str | None) -> str | None:
    """Lowercase scheme+host+path, no query, fragment, default port or trailing slash.

    Only http(s) URLs are accepted; anything else returns None rather than a guess.
    """
    if not raw:
        return None
    try:
        parts = urlsplit(raw.strip())
    except ValueError:
        return None
    if parts.scheme.lower() not in {"http", "https"} or not parts.hostname:
        return None
    host = parts.hostname.lower()
    port = f":{parts.port}" if parts.port and parts.port not in (80, 443) else ""
    path = re.sub(r"/{2,}", "/", parts.path).rstrip("/").lower()
    return f"{parts.scheme.lower()}://{host}{port}{path}"


_SUFFIX = re.compile(r"\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc)\b\.?", re.I)


def normalize_company(name: str | None) -> str:
    base = _SUFFIX.sub(" ", (name or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", base).strip()


def normalize_title(title: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
