"""
Authentication utilities — validate Supabase JWTs and extract the user_id.

Delegates validation to the Supabase Auth server via admin.auth.get_user(jwt).
This handles any JWT algorithm (RS256 or HS256) without needing the JWT secret
or JWKS endpoint, and is always authoritative.
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)


def get_user_id(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """
    FastAPI dependency — extracts the Supabase user_id from the Bearer token.

    Returns None (not 401) when no token is provided so that public/anonymous
    requests continue to work. Raises 401 only if a token IS present but invalid.
    """
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        from app.database.supabase_client import get_supabase_admin_client
        admin = get_supabase_admin_client()
        response = admin.auth.get_user(token)
        if response.user:
            return response.user.id
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Token validation failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
