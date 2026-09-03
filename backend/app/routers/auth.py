from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, PasswordResetToken
from ..auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    create_verification_token,
    decode_verification_token,
    make_reset_token,
    hash_reset_token,
    RESET_TOKEN_EXPIRE_HOURS,
)
from ..services.email_service import send_verification_email, send_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def user_response(user: User, token: str | None = None):
    avatar = "".join(w[0].upper() for w in user.name.split()[:2])
    data = {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "avatar": avatar,
            "isVerified": user.is_verified,
        }
    }
    if token:
        data["accessToken"] = token
    return data


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(body.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be 72 characters or fewer")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_verification_token(user.id)
    try:
        send_verification_email(body.email, token)
    except Exception as e:
        print(f"[email] Failed to send verification email: {e}")

    return {"message": "Registration successful. Please check your email to verify your account."}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please check your inbox or request a new verification link.",
        )
    return user_response(user, create_token(user.id))


@router.post("/logout", status_code=204)
def logout():
    return None


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    avatar = "".join(w[0].upper() for w in current_user.name.split()[:2])
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "avatar": avatar,
        "isVerified": current_user.is_verified,
    }


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user_id = decode_verification_token(token)  # raises on bad/expired token
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        return {"message": "Email already verified. You can log in."}
    user.is_verified = True
    db.commit()
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification")
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    # Always return 200 to avoid email enumeration
    if user and not user.is_verified:
        token = create_verification_token(user.id)
        try:
            send_verification_email(body.email, token)
        except Exception as e:
            print(f"[email] Resend failed: {e}")
    return {"message": "If that email exists and is unverified, a new link has been sent."}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    # Always return 200 to avoid email enumeration
    if user and user.is_verified:
        raw, token_hash = make_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)

        # Invalidate any previous unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        ).update({"used": True})

        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(reset_token)
        db.commit()

        try:
            send_reset_email(body.email, raw)
        except Exception as e:
            print(f"[email] Reset email failed: {e}")

    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be 72 characters or fewer")

    token_hash = hash_reset_token(body.token)
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset link")
    expires_at = record.expires_at
    if expires_at.tzinfo is None:          # SQLite returns naive datetimes
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    record.used = True
    db.commit()

    return {"message": "Password updated successfully. You can now log in."}
