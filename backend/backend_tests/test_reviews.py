import os
import random
import string
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User
from app.auth import create_verification_token

client = TestClient(app)

# Jenkins Credentials, holds verified user
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD")

def generate_email():
    """Base generated email for Register and Login tests."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + "@example.com"

def login_test_user():
    response = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    return data["accessToken"], data["user"]["id"]

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

def get_real_venue_id():
    response = client.get("/api/venues?limit=1")
    items = response.json()["items"]
    assert items, "need at least 1 seeded venue in the DB for these tests"
    return items[0]["id"]


# ---------------------------------------------------------------------------
# GET /venues/{venue_id}/reviews
# ---------------------------------------------------------------------------

def test_get_reviews_for_nonexistent_venue_returns_404():
    response = client.get("/api/venues/not-a-real-venue-id/reviews")
    assert response.status_code == 404

def test_get_reviews_does_not_require_auth():
    """Reading reviews should be public — no token needed."""
    venue_id = get_real_venue_id()
    response = client.get(f"/api/venues/{venue_id}/reviews")
    assert response.status_code == 200

# ---------------------------------------------------------------------------
# POST /venues/{venue_id}/reviews
# ---------------------------------------------------------------------------

def test_create_review_requires_auth():
    venue_id = get_real_venue_id()
    response = client.post(f"/api/venues/{venue_id}/reviews", json={"rating": 5, "text": "Great spot"})
    assert response.status_code == 401

def test_create_review_success():
    token, user_id = login_test_user()
    venue_id = get_real_venue_id()

    response = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 4, "text": "Nice and quiet, good for working"},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["userId"] == user_id
    assert data["rating"] == 4
    assert data["text"] == "Nice and quiet, good for working"

def test_create_review_nonexistent_venue_returns_404():
    token, _ = login_test_user()
    response = client.post(
        "/api/venues/not-a-real-venue-id/reviews",
        json={"rating": 5, "text": "Test"},
        headers=auth_headers(token),
    )
    assert response.status_code == 404

def test_create_review_rating_out_of_range_rejected():
    token, _ = login_test_user()
    venue_id = get_real_venue_id()

    too_low = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 0, "text": "Test"},
        headers=auth_headers(token),
    )
    assert too_low.status_code == 400

    too_high = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 6, "text": "Test"},
        headers=auth_headers(token),
    )
    assert too_high.status_code == 400

def test_create_review_empty_text_rejected():
    token, _ = login_test_user()
    venue_id = get_real_venue_id()
    response = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 5, "text": "   "},  # whitespace only
        headers=auth_headers(token),
    )
    assert response.status_code == 400

def test_create_review_missing_fields_returns_422():
    token, _ = login_test_user()
    venue_id = get_real_venue_id()
    response = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 5},  # missing text
        headers=auth_headers(token),
    )
    assert response.status_code == 422

# ---------------------------------------------------------------------------
# DELETE /reviews/{review_id}
# ---------------------------------------------------------------------------

def test_delete_review_requires_auth():
    response = client.delete("/api/reviews/some-review-id")
    assert response.status_code == 401

def test_delete_nonexistent_review_returns_404():
    token, _ = login_test_user()
    response = client.delete("/api/reviews/not-a-real-review-id", headers=auth_headers(token))
    assert response.status_code == 404

def test_delete_own_review_succeeds():
    token, _ = login_test_user()
    venue_id = get_real_venue_id()

    create_response = client.post(
        f"/api/venues/{venue_id}/reviews",
        json={"rating": 3, "text": "Will be deleted"},
        headers=auth_headers(token),
    )
    review_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/reviews/{review_id}", headers=auth_headers(token))
    assert delete_response.status_code == 204

    # confirm it's actually gone
    my_reviews = client.get("/api/reviews/me", headers=auth_headers(token)).json()["items"]
    assert not any(r["id"] == review_id for r in my_reviews)