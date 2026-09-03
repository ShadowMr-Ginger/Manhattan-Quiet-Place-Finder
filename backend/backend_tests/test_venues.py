from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

def test_venues_pagination_limit_5():
    response = client.get("/api/venues?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 5
    assert data["limit"] == 5

def test_venues_limit_too_high_rejected():
    # limit is bounded le=200 in the router
    response = client.get("/api/venues?limit=201")
    assert response.status_code == 422

def test_venues_limit_zero_rejected():
    # limit is bounded ge=1
    response = client.get("/api/venues?limit=0")
    assert response.status_code == 422

def test_venues_offset_negative_rejected():
    response = client.get("/api/venues?offset=-1")
    assert response.status_code == 422

# ---------------------------------------------------------------------------
# Quiet score filter
# ---------------------------------------------------------------------------

def test_venues_filtering():
    # Test text search or quiet score filtering
    response = client.get("/api/venues?minQuiet=50")
    assert response.status_code == 200
    data = response.json()
    
    # If any venues returned, verify they meet the criteria
    for venue in data.get("items", []):
        assert venue["quietScore"] >= 50

def test_venues_min_quiet_boundary_values():
    # ge=0, le=100 in the router
    response = client.get("/api/venues?minQuiet=0")
    assert response.status_code == 200
    response = client.get("/api/venues?minQuiet=100")
    assert response.status_code == 200

def test_venues_min_quiet_out_of_range_rejected():
    response = client.get("/api/venues?minQuiet=101")
    assert response.status_code == 422
    response = client.get("/api/venues?minQuiet=-1")
    assert response.status_code == 422

# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------

def test_venues_sort_by_quiet_score_descending():
    response = client.get("/api/venues?sort=quietScore&limit=20")
    data = response.json()
    scores = [v["quietScore"] for v in data["items"]]
    assert scores == sorted(scores, reverse=True)

def test_venues_sort_by_mention_count_descending():
    response = client.get("/api/venues?sort=mentionCount&limit=20")
    data = response.json()
    counts = [v["mentionCount"] for v in data["items"]]
    assert counts == sorted(counts, reverse=True)

# ---------------------------------------------------------------------------
# Search / type filter
# ---------------------------------------------------------------------------

def test_venues_text_search_matches_name_or_address():
    all_venues = client.get("/api/venues?limit=1").json()["items"]
    if all_venues:
        sample_name = all_venues[0]["name"]
        keyword = sample_name.split()[0]
        response = client.get(f"/api/venues?q={keyword}")
        assert response.status_code == 200
        # every result should contain the keyword in name or address (case-insensitive)
        for venue in response.json()["items"]:
            haystack = (venue["name"] + venue["address"]).lower()
            assert keyword.lower() in haystack

def test_venues_search_no_match_returns_empty_not_error():
    response = client.get("/api/venues?q=zzzz_definitely_not_a_real_venue_zzzz")
    assert response.status_code == 200
    assert response.json()["items"] == []

def test_venues_type_filter_single():
    response = client.get("/api/venues?type=cafe")
    assert response.status_code == 200
    for venue in response.json()["items"]:
        assert venue["type"] == "cafe"

def test_venues_type_filter_multiple():
    response = client.get("/api/venues?type=cafe,library")
    assert response.status_code == 200
    for venue in response.json()["items"]:
        assert venue["type"] in ("cafe", "library")

# ---------------------------------------------------------------------------
# Single venue detail
# ---------------------------------------------------------------------------

def test_get_single_venue():
    # First, get a list to grab a valid venue ID
    list_response = client.get("/api/venues?limit=1")
    assert list_response.status_code == 200
    items = list_response.json().get("items", [])
    
    if items:
        venue_id = items[0]["id"]
        # Test fetching the specific venue details
        response = client.get(f"/api/venues/{venue_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == venue_id
        assert "hours" in data
        assert "attributeScores" in data

def test_get_venue_detail_includes_full_schema():
    list_response = client.get("/api/venues?limit=1").json()
    items = list_response.get("items", [])
    if items:
        venue_id = items[0]["id"]
        response = client.get(f"/api/venues/{venue_id}")
        data = response.json()
        # fields unique to VenueDetail, not present on VenueSummary
        assert "representativeQuotes" in data
        assert "osm" in data
        assert "accessibilityManual" in data

def test_get_venue_not_found():
    response = client.get("/api/venues/non-existent-venue-id-12345")
    assert response.status_code == 404
    assert response.json()["detail"] == "Venue not found"

def test_get_venue_empty_id_returns_404_or_matches_list_route():
    # /api/venues/ with a trailing slash and no id shouldn't accidentally
    # match the list_venues route or 500
    response = client.get("/api/venues/")
    assert response.status_code in (404, 200)