"""Portal credentials come from the environment, never from the database, code, or logs.

ats_accounts.username_ref names the secret. For a ref of "workday-acme" the job reads
  CAREEROS_SECRET_WORKDAY_ACME_USERNAME
  CAREEROS_SECRET_WORKDAY_ACME_PASSWORD
Load them from a root-only file (mode 600) through the systemd unit's EnvironmentFile.
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping

from .base import Credentials, NeedsAttention


def env_prefix(ref: str) -> str:
    return "CAREEROS_SECRET_" + re.sub(r"[^A-Za-z0-9]+", "_", ref).strip("_").upper()


def get_credentials(ref: str, env: Mapping[str, str] | None = None) -> Credentials:
    env = os.environ if env is None else env
    prefix = env_prefix(ref)
    username, password = env.get(f"{prefix}_USERNAME", ""), env.get(f"{prefix}_PASSWORD", "")
    if not username or not password:
        # Name the variables, never print values.
        raise NeedsAttention(f"Credentials are not configured: set {prefix}_USERNAME and {prefix}_PASSWORD.")
    return Credentials(username=username, password=password)
