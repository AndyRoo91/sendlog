"""Auth utilities: password hashing, signed-cookie sessions, current-user dep.

We use a signed cookie (no server-side session table) for simplicity. Tokens
carry the user id + an issued-at timestamp and are signed with SECRET_KEY.
itsdangerous handles expiry and tampering detection.
"""
import os
import secrets

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session as DBSession

import models
from database import get_db

COOKIE_NAME = "sendlog_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30   # 30 days
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()

if not SECRET_KEY:
    # Generate an ephemeral key so dev / fresh installs still work, but warn
    # loudly so production deployments set a real one (cookies invalidate on
    # restart otherwise — every user gets logged out).
    SECRET_KEY = secrets.token_urlsafe(48)
    print(
        "WARNING: SECRET_KEY env var not set — using an ephemeral random key. "
        "Sessions will be invalidated on every restart. "
        "Set SECRET_KEY to a long random string in production."
    )

_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="sendlog-session-v1")


# ---------------------------------------------------------------------------
# Password hashing — bcrypt directly (passlib's bcrypt backend is finicky on
# newer bcrypt releases).
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    if not plain:
        raise ValueError("password must not be empty")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Session cookie helpers
# ---------------------------------------------------------------------------

def _issue_token(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def _verify_token(token: str) -> int | None:
    try:
        data = _serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(data, dict):
        return None
    uid = data.get("uid")
    return uid if isinstance(uid, int) else None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        _issue_token(user_id),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        # secure=True in production behind HTTPS; left off so localhost dev works.
        # Synology / Caddy users should run sendlog behind HTTPS.
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, samesite="lax")


# ---------------------------------------------------------------------------
# FastAPI dependency: current user (401 on missing/invalid cookie)
# ---------------------------------------------------------------------------

def get_current_user(
    db: DBSession = Depends(get_db),
    session_cookie: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> models.User:
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")
    uid = _verify_token(session_cookie)
    if uid is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = db.get(models.User, uid)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user
