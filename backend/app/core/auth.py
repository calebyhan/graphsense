"""
Authentication utilities — validate Supabase JWTs and extract the user_id.

Supabase now signs user JWTs with asymmetric keys (RS256). Verification
uses the JWKS endpoint published at:
  {SUPABASE_URL}/auth/v1/.well-known/jwks.json

No JWT secret is needed. PyJWT's PyJWKClient fetches and caches the public
keys automatically (10-minute TTL).
"""

import logging
from typing import Optional

import jwt
from fastapi import Header, HTTPException
from jwt import InvalidTokenError, PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=600)
    return _jwks_client


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
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        user_id: Optional[str] = payload.get("sub")
        return user_id
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
