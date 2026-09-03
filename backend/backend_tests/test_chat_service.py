"""
Unit tests for app/services/chat_service.py and chat-related helpers in misc.py.

These tests do NOT call the DashScope API — they test pure helper functions only.
"""

from app.services.chat_service import (
    _detect_language,
    _strip_markdown,
    _build_venue_context,
    _build_weather_context,
)

from app.routers.misc import _is_venue_query, _parse_constraints


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------
def test_english_message():
    assert _detect_language("hi how are you") == "en"

def test_chinese_message():
    assert _detect_language("你好，今天天气怎么样？") == "zh"

def test_mixed_message_detected_as_chinese():
    assert _detect_language("find me a 咖啡馆") == "zh"

def test_empty_string_is_english():
    assert _detect_language("") == "en"

def test_numbers_and_symbols_are_english():
    assert _detect_language("score > 80") == "en"

def test_english_with_accents():
    assert _detect_language("café near me") == "en"


# ---------------------------------------------------------------------------
# Markdown stripping
# ---------------------------------------------------------------------------

def test_bold_asterisks_removed():
    assert _strip_markdown("**Hello** world") == "Hello world"

def test_italic_asterisks_removed():
    assert _strip_markdown("*italic* text") == "italic text"

def test_double_underscore_removed():
    assert _strip_markdown("__bold__") == "bold"

def test_inline_code_removed():
    assert _strip_markdown("use `code` here") == "use code here"

def test_headers_removed():
    assert _strip_markdown("# Title\nsome text") == "Title\nsome text"

def test_bullet_points_removed():
    result = _strip_markdown("- item one\n- item two")
    assert "- " not in result
    assert "item one" in result

def test_plain_text_unchanged():
    text = "Here are 3 quiet cafes in Manhattan."
    assert _strip_markdown(text) == text

def test_numbered_list_unchanged():
    text = "1. Cafe A\n2. Cafe B"
    assert _strip_markdown(text) == text


# ---------------------------------------------------------------------------
# Venue context builder
# ---------------------------------------------------------------------------

def test_empty_list_returns_empty_string():
    assert _build_venue_context([]) == ""

def test_venues_included_in_output():
    venues = [
        {"name": "Quiet Bean", "type": "cafe", "quietScore": 85,
            "address": "100 Main St", "displayRating": 4.5},
    ]
    ctx = _build_venue_context(venues)
    assert "Quiet Bean" in ctx
    assert "85/100" in ctx
    assert "cafe" in ctx
    assert "100 Main St" in ctx

def test_rating_included_when_present():
    venues = [
        {"name": "A", "type": "cafe", "quietScore": 80,
            "address": "123 St", "displayRating": 4.2},
    ]
    assert "4.2" in _build_venue_context(venues)

def test_missing_rating_not_in_output():
    venues = [
        {"name": "B", "type": "library", "quietScore": 90,
            "address": "456 Ave", "displayRating": None},
    ]
    ctx = _build_venue_context(venues)
    assert "None" not in ctx

def test_instruction_header_present():
    venues = [{"name": "C", "type": "cafe", "quietScore": 70,
                "address": "789 Blvd", "displayRating": None}]
    assert "MUST only recommend" in _build_venue_context(venues)


# ---------------------------------------------------------------------------
# Weather context builder
# ---------------------------------------------------------------------------

def test_none_returns_empty_string():
    assert _build_weather_context(None) == ""

def test_missing_current_returns_empty():
    assert _build_weather_context({"forecast": []}) == ""

def test_weather_data_included():
    weather = {
        "current": {
            "temp": 22.5,
            "feels_like": 21.0,
            "humidity": 60,
            "description": "clear sky",
            "wind_speed": 3.5,
            "icon": "01d",
        },
        "forecast": [],
    }
    ctx = _build_weather_context(weather)
    assert "22.5" in ctx
    assert "clear sky" in ctx
    assert "60%" in ctx

def test_forecast_included():
    weather = {
        "current": {
            "temp": 20.0, "feels_like": 19.0, "humidity": 55,
            "description": "cloudy", "wind_speed": 2.0, "icon": "02d",
        },
        "forecast": [
            {"time": "2026-07-27 15:00:00", "temp": 21.0,
                "feels_like": 20.0, "humidity": 50,
                "description": "partly cloudy", "wind_speed": 2.5, "icon": "02d"},
        ],
    }
    ctx = _build_weather_context(weather)
    assert "2026-07-27" in ctx
    assert "partly cloudy" in ctx


# ---------------------------------------------------------------------------
# Venue intent detection
# ---------------------------------------------------------------------------

def test_explicit_venue_request():
    assert _is_venue_query("find me a quiet cafe") is True

def test_english_place_keywords():
    assert _is_venue_query("where can I study?") is True
    assert _is_venue_query("recommend a library") is True
    assert _is_venue_query("I want coffee") is True

def test_chinese_keywords():
    assert _is_venue_query("推荐一个安静的咖啡馆") is True
    assert _is_venue_query("哪里有图书馆") is True

def test_greeting_is_not_venue_query():
    assert _is_venue_query("hi") is False
    assert _is_venue_query("hello how are you") is False

def test_weather_question_is_not_venue_query():
    assert _is_venue_query("what is the weather today") is False

def test_event_question_is_not_venue_query():
    assert _is_venue_query("any events in nyc this weekend?") is False


# ---------------------------------------------------------------------------
# Constraint parsing
# ---------------------------------------------------------------------------

def test_min_quiet_score():
    c = _parse_constraints("quiet score above 70")
    assert c.get("min_quiet") == 70

def test_max_quiet_score():
    c = _parse_constraints("quiet score below 50")
    assert c.get("max_quiet") == 50

def test_min_rating():
    c = _parse_constraints("rating above 4.0")
    assert c.get("min_rating") == 4.0

def test_score_above_small_value_is_rating():
    c = _parse_constraints("score above 4")
    assert c.get("min_rating") == 4

def test_score_above_large_value_is_quiet():
    c = _parse_constraints("score above 80")
    assert c.get("min_quiet") == 80

def test_no_constraints():
    c = _parse_constraints("find me a cafe")
    assert c == {}