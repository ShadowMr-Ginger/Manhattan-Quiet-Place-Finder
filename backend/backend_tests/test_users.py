import os
import random
import string
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_verification_token
from app.database import SessionLocal
from app.models import User, UserFavorite, UserSaved, UserRecent

client = TestClient(app)

# Jenkins Credentials, holds verified user
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD")

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def generate_email():
    """Base generated email for Register and Login tests."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + "@example.com"


def login_test_user():
    """Log in with the Jenkins test account."""
    response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    return data["accessToken"], data["user"]["id"]

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

def reset_user_state(user_id):
    """Wipe favorites/saved/recent for the shared test account so each
    test starts from a known, empty state — necessary because this
    account persists across runs, unlike a freshly registered user."""
    db = SessionLocal()
    db.query(UserFavorite).filter_by(user_id=user_id).delete()
    db.query(UserSaved).filter_by(user_id=user_id).delete()
    db.query(UserRecent).filter_by(user_id=user_id).delete()
    db.commit()
    db.close()

def get_two_real_venue_ids():
    """Pull two real venue IDs from the venues list to use in favorite/saved/recent tests."""
    response = client.get("/api/venues?limit=2")
    items = response.json()["items"]
    assert len(items) >= 2, "need at least 2 seeded venues in the DB for these tests"
    return items[0]["id"], items[1]["id"]

# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


def test_add_and_get_favorite():
    token, user_id = login_test_user()
    reset_user_state(user_id)
    venue_id, _ = get_two_real_venue_ids()

    add_response = client.post(f"/api/users/me/favorites/{venue_id}", headers=auth_headers(token))
    assert add_response.status_code == 200

    list_response = client.get("/api/users/me/favorites", headers=auth_headers(token))
    ids = [v["id"] for v in list_response.json()["items"]]
    assert venue_id in ids

def test_add_favorite_nonexistent_venue_returns_404():
    token, _ = login_test_user()
    response = client.post("/api/users/me/favorites/not-a-real-venue-id", headers=auth_headers(token))
    assert response.status_code == 404

def test_remove_favorite():
    token, user_id = login_test_user()
    reset_user_state(user_id)
    venue_id, _ = get_two_real_venue_ids()

    client.post(f"/api/users/me/favorites/{venue_id}", headers=auth_headers(token))
    remove_response = client.delete(f"/api/users/me/favorites/{venue_id}", headers=auth_headers(token))
    assert remove_response.status_code == 204

    list_response = client.get("/api/users/me/favorites", headers=auth_headers(token))
    ids = [v["id"] for v in list_response.json()["items"]]
    assert venue_id not in ids

# ---------------------------------------------------------------------------
# Saved
# ---------------------------------------------------------------------------

def test_add_and_get_saved():
    token, user_id = login_test_user()
    reset_user_state(user_id)
    venue_id, _ = get_two_real_venue_ids()

    add_response = client.post(f"/api/users/me/saved/{venue_id}", headers=auth_headers(token))
    assert add_response.status_code == 200

    list_response = client.get("/api/users/me/saved", headers=auth_headers(token))
    ids = [v["id"] for v in list_response.json()["items"]]
    assert venue_id in ids

def test_saved_and_favorites_are_independent():
    token, user_id = login_test_user()
    reset_user_state(user_id)
    venue_id, _ = get_two_real_venue_ids()

    client.post(f"/api/users/me/saved/{venue_id}", headers=auth_headers(token))

    favorites = client.get("/api/users/me/favorites", headers=auth_headers(token))
    ids = [v["id"] for v in favorites.json()["items"]]
    assert venue_id not in ids

# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

def test_profile_returns_correct_shape_and_counts():
    token, user_id = login_test_user()
    reset_user_state(user_id)
    venue_id, _ = get_two_real_venue_ids()

    client.post(f"/api/users/me/favorites/{venue_id}", headers=auth_headers(token))
    client.post(f"/api/users/me/saved/{venue_id}", headers=auth_headers(token))

    response = client.get("/api/users/me/profile", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()

    assert data["user"]["email"] == TEST_USER_EMAIL
    assert data["stats"]["favorites"] == 1
    assert data["stats"]["saved"] == 1
    assert data["stats"]["recentViewed"] == 0

def test_profile_does_not_leak_password_hash():
    token, _ = login_test_user()
    response = client.get("/api/users/me/profile", headers=auth_headers(token))
    assert "password_hash" not in response.text

# ---------------------------------------------------------------------------
# Auth gating — every route requires a token
# ---------------------------------------------------------------------------

def test_favorites_requires_auth():
    response = client.get("/api/users/me/favorites")
    assert response.status_code == 401

def test_saved_requires_auth():
    response = client.get("/api/users/me/saved")
    assert response.status_code == 401

def test_recent_requires_auth():
    response = client.get("/api/users/me/recent")
    assert response.status_code == 401

def test_profile_requires_auth():
    response = client.get("/api/users/me/profile")
    assert response.status_code == 401