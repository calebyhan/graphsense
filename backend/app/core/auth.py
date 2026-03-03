"""
Authentication utilities — validate Supabase JWTs and extract the user_id.

Supabase signs its JWTs with the project-level JWT secret found at:
  Supabase Dashboard → Settings → API → JWT Secret

Set SUPABASE_JWT_SECRET in your .env. When missing, the dependency
returns user_id=None so unauthenticated requests still work (anonymous
datasets remain permitted).
"""

import logging
from typing import Optional

import jwt
from fastapi import Header, HTTPException
from jwt import InvalidTokenError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


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

    if not settings.supabase_jwt_secret:
        # JWT secret not configured — log once and treat as anonymous
        logger.warning("SUPABASE_JWT_SECRET not set; skipping JWT validation")
        return None

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase doesn't use a standard aud claim
        )
        user_id: Optional[str] = payload.get("sub")
        return user_id
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
