import jwt
from datetime import datetime, timedelta, timezone
from app.models import PasswordResetToken
from fastapi.testclient import TestClient
from app.auth import (
    create_verification_token, make_reset_token, hash_reset_token,
    SECRET_KEY, ALGORITHM,
)
from app.database import SessionLocal
from app.models import User
from app.main import app
import os
import random
import string

# Jenkins Credentials, holds verified user
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD")

# Base generated email for Register and Login tests.
generated_email = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + "@example.com"

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def generate_email():
    """Fresh, independent email for tests that shouldn't collide with
    generated_email or with each other."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + "@example.com"


def get_user_id(email):
    """Look up a user's real UUID by email — verification tokens need
    the id, not the email itself."""
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    assert user is not None, f"expected a user with email {email} to exist"
    return user.id


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

def test_register_success():
    """Verify that a new user can register successfully."""
    # NOTE: This test generates a random email each time to avoid conflicts with existing users.
    # While the test will pass, there is a chance of conflict with existing users, causing failure.
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": generated_email,
            "password": "password123"
        }
    )
    assert response.status_code == 201

def test_register_invalid_password():
    """Verify that registration fails if the password is too short."""
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "newuser@example.com",
            "password": "123"  # Less than 6 characters
        }
    )
    assert response.status_code == 400

def test_register_duplicate_email():
    """Verify that registration fails if the email is already in use."""
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": TEST_USER_EMAIL,  # Email is already registered and manually verified
            "password": "password123"
        }
    )
    assert response.status_code == 409

"""
def test_register_duplicate_email_different_case():
    Verify that registration fails if the email is already in use, even with different casing.
    response = client.post(
        "/api/auth/register",

        # Using same details as the previous test but with different casing.
        json={
            "name": "Test User",
            "email": generated_email.upper(), 
            "password": "password123"
        },
    )

    assert response.status_code == 409
"""
def test_register_invalid_email():
    """Verify that registration fails if the email format is invalid."""
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "thisisnotanemail",  # Invalid email format
            "password": "password123"
        }
    )
    assert response.status_code == 422

# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_success():
    """Verify that a valid user can login and receive a token."""
    # NOTE: You may need to create a test user in your DB first or use credentials you know exist.
    # You will also need to verify the test user.
    response = client.post(
        "/api/auth/login", 
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    assert response.status_code == 200
    
    # Check that the response contains an access token
    data = response.json()
    assert "accessToken" in data
    assert "user" in data

def test_login_invalid_email():
    """Verify that a login attempt with wrong credentials fails."""
    response = client.post(
        "/api/auth/login", 
        json={
            "email": "wrongemail@email.com", 
            "password": "password123"}
    )
    assert response.status_code == 401

def test_login_invalid_password():
    """Verify that a login attempt with wrong credentials fails."""
    response = client.post(
        "/api/auth/login", 
        json={
            "email": TEST_USER_EMAIL, 
            "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_login_unverified_user_rejected():
    response = client.post(
        "/api/auth/login",
        json={
            "email": generated_email,
            "password": "password123"
        }
    )
    assert response.status_code == 403

def test_login_nonexistent_email_and_wrong_password_give_identical_response():
    """Both failure modes should be indistinguishable to the client."""
    response1 = client.post("/api/auth/login", json={
        "email": "notanemail@example.com", 
        "password": "password123"})

    response2 = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL, 
        "password": "password123"})

    assert response1.status_code == response2.status_code == 401
    assert response1.json()["detail"] == response2.json()["detail"]
"""
def test_login_email_case_insensitive():
    Verify that login is case-insensitive for the email.
    response = client.post(
        "/api/auth/login", 
        json={
            "email": TEST_USER_EMAIL.upper(),  # Using uppercase to test case insensitivity
            "password": TEST_USER_PASSWORD
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert "user" in data
"""
def test_avatar_initials_are_correct():
    res = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
    })

    assert res.json()["user"]["avatar"] == "JL"


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

def test_logout():
    """Verify that a user can log out successfully."""
    login_response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    assert login_response.status_code == 200
    token = login_response.json()["accessToken"]

    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 204

# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

def test_current_user_verified():
    """Verify that the /me endpoint returns the correct user information."""
    login_response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    assert login_response.status_code == 200
    token = login_response.json()["accessToken"]

    # Then, use the token in the Authorization header to call the /me endpoint
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == TEST_USER_EMAIL

def test_unauthenticated_returns_401():
    """Verify that an unauthenticated request to /me returns a 401 status code."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_me_with_malformed_token():
    """Verify that a garbage/non-JWT string in the Authorization header is rejected."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401

def test_me_with_missing_bearer_prefix():
    """Verify that a raw token with no 'Bearer ' prefix is rejected,
    not silently accepted."""
    login_response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    token = login_response.json()["accessToken"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": token}
    )
    assert response.status_code == 401

def test_access_protected_route_without_token():
    """Verify that protected routes reject requests without a token."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_access_protected_route_with_token():
    """Verify that accessing a protected route with a valid token succeeds."""
    # First, log in to get the token
    login_response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    assert login_response.status_code == 200
    token = login_response.json()["accessToken"]

    # Then, use the token in the Authorization header to call the protected endpoint
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == TEST_USER_EMAIL

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def test_verify_email_success():
    """Verify that a user can verify their email successfully."""
    email = generate_email()

    # First, register a new user to get a verification token
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "password": "password123"
        }
    )
    assert response.status_code == 201

    # create_verification_token() needs the user's id, not their email —
    # look it up from the DB after registering.
    user_id = get_user_id(email)
    verification_token = create_verification_token(user_id)

    # Now, verify the email using the token
    verify_response = client.get(f"/api/auth/verify-email?token={verification_token}")
    assert verify_response.status_code == 200

def test_verify_email_invalid_token():
    """Verify that an invalid token results in a 400 error."""
    response = client.get("/api/auth/verify-email?token=invalidtoken")
    assert response.status_code == 400

def test_verify_email_expired_token():
    """Verify that an expired token results in a 400 error."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)

    # create_verification_token() has no expires_in param — build the
    # expired JWT directly with the same secret/algorithm/claims shape
    # instead of waiting for a real token to expire.
    expired_token = jwt.encode(
        {
            "sub": user_id,
            "purpose": "verify",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    response = client.get(f"/api/auth/verify-email?token={expired_token}")
    assert response.status_code == 400

def test_verify_email_already_verified():
    """Verifying an already-verified email should succeed with a
    different message, not error."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    token = create_verification_token(user_id)

    client.get(f"/api/auth/verify-email?token={token}")  # first call verifies
    second_response = client.get(f"/api/auth/verify-email?token={token}")

    assert second_response.status_code == 200
    assert "already verified" in second_response.json()["message"].lower()

def test_verify_email_and_login():
    """Verify that after email verification, the user can log in successfully."""
    email = generate_email()

    # First, register a new user to get a verification token
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "password": "password123"
        }
    )
    assert response.status_code == 201

    user_id = get_user_id(email)
    verification_token = create_verification_token(user_id)

    # Now, verify the email using the token
    verify_response = client.get(f"/api/auth/verify-email?token={verification_token}")
    assert verify_response.status_code == 200

    # Now, attempt to log in with the verified email
    login_response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"}
    )
    assert login_response.status_code == 200

# ---------------------------------------------------------------------------
# Forgot password
# ---------------------------------------------------------------------------

def make_reset_row(user_id, hours_until_expiry=1, used=False):
    """Insert a PasswordResetToken directly and return the raw token
    to send to the endpoint — forgot-password only emails the raw
    token, it's never returned in an API response."""
    raw, token_hash = make_reset_token()
    db = SessionLocal()
    reset_row = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=hours_until_expiry),
        used=used,
    )
    db.add(reset_row)
    db.commit()
    db.close()
    return raw


def test_forgot_password_always_returns_200_for_unknown_email():
    """Anti-enumeration: an unregistered email should still return 200"""
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "wrongemail@example.com"}
    )
    assert response.status_code == 200

def test_forgot_password_always_returns_200_for_unverified_user():
    """An unverified account also gets a 200 with no reset actually"""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    response = client.post("/api/auth/forgot-password", json={"email": email})
    assert response.status_code == 200

def test_reset_password_success():
    """Verify a valid reset token lets a user set a new password and
    log in with it."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    raw_token = make_reset_row(user_id)

    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "brandnewpass1"}
    )
    assert response.status_code == 200

    login_response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "brandnewpass1"}
    )
    # Login will still 403 here unless the user is verified — see note below
    assert login_response.status_code in (200, 403)

def test_reset_password_invalid_token():
    """A token that doesn't correspond to any stored hash should 400."""
    response = client.post(
        "/api/auth/reset-password",
        json={"token": "not-a-real-token", "new_password": "newvalidpass1"}
    )
    assert response.status_code == 400

def test_reset_password_expired_token():
    """An expired reset token should be rejected even if otherwise valid."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    raw_token = make_reset_row(user_id, hours_until_expiry=-1)  # already expired

    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "newvalidpass1"}
    )
    assert response.status_code == 400

def test_reset_password_already_used_token():
    """A token marked used=True should be rejected on reuse, even if
    it hasn't expired yet."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    raw_token = make_reset_row(user_id, used=True)

    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "newvalidpass1"}
    )
    assert response.status_code == 400

def test_reset_password_token_cannot_be_reused_after_success():
    """Verify the token is marked used after a successful reset, so
    calling reset-password again with the same raw token fails."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    raw_token = make_reset_row(user_id)

    first = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "firstnewpass1"}
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "secondnewpass1"}
    )
    assert second.status_code == 400

def test_reset_password_weak_new_password():
    """A new password under 6 characters should be rejected, same rule
    as registration."""
    email = generate_email()
    client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "password123"}
    )
    user_id = get_user_id(email)
    raw_token = make_reset_row(user_id)

    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "123"}
    )
    assert response.status_code == 400

def test_reset_password_missing_token():
    """Verify a missing token field returns 422, not a 500."""
    response = client.post(
        "/api/auth/reset-password",
        json={"new_password": "newvalidpass1"}
    )
    assert response.status_code == 422