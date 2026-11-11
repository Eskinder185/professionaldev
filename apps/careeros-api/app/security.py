"""Token check for private endpoints. Compared in constant time; the token is never logged."""

import secrets
from collections.abc import Callable

from fastapi import Header, HTTPException, status

from .config import Settings


def token_dependency(settings: Settings) -> Callable[..., None]:
    expected = settings.api_token.get_secret_value().encode()

    def require_token(authorization: str | None = Header(default=None)) -> None:
        supplied = ""
        if authorization and authorization.lower().startswith("bearer "):
            supplied = authorization[7:].strip()
        # compare_digest on bytes of equal handling; an empty/missing token always fails.
        if not supplied or not secrets.compare_digest(supplied.encode(), expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A valid bearer token is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return require_token
