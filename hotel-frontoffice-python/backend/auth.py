import os
from fastapi import HTTPException, Request, Response
from passlib.context import CryptContext
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("HOTEL_SECRET_KEY", "dev-only-change-this-secret-before-deployment")
serializer = URLSafeTimedSerializer(SECRET_KEY, salt="hotel-dashboard-session")
SESSION_COOKIE = "hotel_session"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False

def set_session(response: Response, user_id: int, *, actor_type: str = "legacy", hotel_id: int | None = None):
    token = serializer.dumps({"actor_type": actor_type, "user_id": user_id, "hotel_id": hotel_id})
    response.set_cookie(key=SESSION_COOKIE, value=token, httponly=True, samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "0") == "1", max_age=8 * 60 * 60, path="/")

def current_session(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    try:
        data = serializer.loads(token, max_age=8 * 60 * 60)
        # Backward compatibility with the original cookie payload.
        if "actor_type" not in data:
            data["actor_type"] = "legacy"
        data["user_id"] = int(data["user_id"])
        return data
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")

def current_user_id(request: Request) -> int:
    return current_session(request)["user_id"]

def clear_session(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
