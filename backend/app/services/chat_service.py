"""
Qianwen (通义千问) chat service via DashScope OpenAI-compatible API.

Requires DASHSCOPE_API_KEY in .env
Model: qwen-turbo (fast), qwen-plus (balanced), qwen-max (best quality)
"""
import os
from openai import OpenAI

DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL = os.getenv("QIANWEN_MODEL", "qwen-turbo")

SYSTEM_PROMPT = """You are a friendly assistant for Hush-Hub, an app that helps people find quiet spaces in Manhattan, New York.

Your main purpose is to help users discover quiet cafés, libraries, restaurants, bars, and other peaceful venues — but only when they want that help.

You have access to real-time web search and current weather data for New York.

Conversation rules:
1. NEVER recommend venues unless the user has clearly asked for one (e.g. "find me a quiet cafe", "where can I study?", "recommend a place"). Do NOT suggest venues unprompted.
2. If the user says something that hints they might need a quiet place (e.g. "I need to focus", "it's so noisy", "I want to relax", "I have work to do"), gently ask: "Would you like me to suggest a quiet spot nearby?" — do not recommend until they confirm.
3. When the user does ask for a venue recommendation, suggest up to 3 from the provided venue list. Mention the name, type, and quiet score. Quiet score is out of 100, higher = quieter.
4. NEVER mention weather, temperature, or forecast in your response unless the user's message explicitly asks about weather (e.g. "what's the weather", "is it raining", "how hot is it"). If you searched the web and found weather data, do NOT include it in the response unless weather was asked.
5. For greetings or general chat (e.g. "hi", "hello", "how are you"): greet the user warmly, then search the web for today's Manhattan news and share 1-2 items that could affect finding a quiet space — such as large events, street closures, parades, concerts, construction, or busy festivals. Frame it as a helpful heads-up, e.g. "By the way, there's a large concert near Times Square today that might make the area noisier than usual."
6. Answer questions about NYC events, news, closures, or real-time information using web search.
7. Do NOT use markdown formatting. No asterisks, no bold, no dashes for bullet points. Use plain text. For lists, use "1. 2. 3." format.
"""


def _detect_language(text: str) -> str:
    """Return 'zh' if text contains Chinese characters, else 'en'."""
    for ch in text:
        if '一' <= ch <= '鿿':
            return 'zh'
    return 'en'


def _get_client() -> OpenAI:
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not set in .env")
    return OpenAI(api_key=api_key, base_url=DASHSCOPE_BASE_URL)


def _build_venue_context(venues: list[dict]) -> str:
    if not venues:
        return ""
    lines = ["Quiet venues in Manhattan (from our database). You MUST only recommend venues from this exact list:"]
    for v in venues:
        line = (
            f"- {v['name']} | type: {v['type']} | quiet score: {v['quietScore']}/100"
            f" | address: {v['address']}"
        )
        if v.get("displayRating"):
            line += f" | rating: {v['displayRating']}"
        lines.append(line)
    return "\n".join(lines)


import re

def _strip_markdown(text: str) -> str:
    """Remove common markdown formatting from AI response."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)        # *italic*
    text = re.sub(r'__(.+?)__', r'\1', text)        # __bold__
    text = re.sub(r'`(.+?)`', r'\1', text)          # `code`
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # # headers
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE) # - bullet points
    return text.strip()


def _build_weather_context(weather: dict | None) -> str:
    if not weather or not weather.get("current"):
        return ""
    c = weather["current"]
    parts = [
        f"[Current weather in Manhattan]",
        f"Temperature: {c['temp']:.1f}°C (feels like {c['feels_like']:.1f}°C)",
        f"Condition: {c['description']}",
        f"Humidity: {c['humidity']}%",
        f"Wind: {c['wind_speed']} m/s",
    ]
    forecast = weather.get("forecast", [])
    if forecast:
        parts.append("Upcoming (3-hour intervals):")
        for f in forecast[:3]:
            parts.append(f"  {f['time']}: {f['temp']:.1f}°C, {f['description']}")
    return "\n".join(parts)


def chat(
    message: str,
    venues: list[dict],
    language: str = "en",
    history: list[dict] | None = None,
    weather: dict | None = None,
) -> str:
    """
    Send a chat message to Qianwen with venue context and conversation history.

    :param message: Current user message
    :param venues: List of venue dicts from the DB (VenueSummary format)
    :param language: 'en' or 'zh' (hint only — model auto-detects)
    :param history: Previous messages [{role, text}, ...] for conversation context
    :param weather: Current weather dict from weather cache (optional)
    :return: Qianwen's reply
    """
    client = _get_client()
    venue_context = _build_venue_context(venues)
    weather_context = _build_weather_context(weather)

    lang = _detect_language(message)
    lang_instruction = (
        "IMPORTANT: The user's message is in English. You MUST reply in English only."
        if lang == 'en' else
        "IMPORTANT: 用户的消息是中文。你必须只用中文回复。"
    )
    system_with_lang = f"{SYSTEM_PROMPT}\n\n{lang_instruction}"

    messages = [{"role": "system", "content": system_with_lang}]

    # Inject last 10 turns of conversation history for context
    if history:
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["text"]})

    # Only append venue data — weather context is never injected;
    # the model uses web search if the user explicitly asks about weather.
    user_content = f"{message}\n\n[Venue data]\n{venue_context}" if venue_context else message
    messages.append({"role": "user", "content": user_content})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=600,
        temperature=0.7,
        extra_body={"enable_search": True},
    )
    return _strip_markdown(response.choices[0].message.content)
