"""
Authentication: password hashing + JWT issuance/verification.

IMPORTANT (see permissions.py too): the JWT payload's "role" claim is written
ONCE, by this backend, at login time, by reading the authenticated User row
from the database. It is never taken from anything the client sends in a
chat message. Every protected endpoint re-derives the role from the verified
token -- never from request body fields like "role": "principal".
"""
import os
import datetime
import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-insecure-secret-change-me")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt exceptions on invalid/expired tokens -- caller handles them."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
