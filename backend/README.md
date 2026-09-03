# Hush-Hub Backend

REST API for the Quiet Spaces Manhattan app, built with FastAPI and PostgreSQL.

## Requirements

- Python 3.10+
- pip
- PostgreSQL 14+

## Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```
DATABASE_URL=postgresql://hushhub:hushhub@localhost:5432/hushhub
FRONTEND_URL=http://127.0.0.1:5173
# Optional — required to actually send verification / reset emails:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASSWORD=...
# FROM_EMAIL=...
```

`FRONTEND_URL` must be the **React app** origin (where users open the UI), not the API (`:8000`). Verification emails link to `{FRONTEND_URL}?verify=…`.

## Database setup (first time)

```bash
# Create PostgreSQL user and database
sudo -u postgres psql
CREATE USER hushhub WITH PASSWORD 'hushhub';
CREATE DATABASE hushhub OWNER hushhub;
\q
```

## Data import (first time, run in order)

```bash
# 1. Import venue data (326 Manhattan quiet spaces)
python -m scripts.import_venues

# 2. Import full MTA + 311 historical data — Manhattan only (takes a while)
python -m scripts.fetch_historical_data

# Import only one dataset if needed:
python -m scripts.fetch_historical_data --mta-only
python -m scripts.fetch_historical_data --311-only
```

## Incremental data updates

```bash
# Run daily — fetches new 311 complaints since last record in DB
python -m scripts.update_data --311

# Run weekly after MTA publishes new data — fetches new ridership rows
python -m scripts.update_data --mta

# Run both at once
python -m scripts.update_data --mta --311
```

## Start the server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Server runs at `http://localhost:8000`.

Interactive docs (Swagger UI): `http://localhost:8000/docs`

---

## API Reference

Base URL: `http://localhost:8000/api`

Auth-required endpoints need: `Authorization: Bearer <accessToken>`

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Sign in, returns `accessToken` |
| POST | `/auth/logout` | Yes | Sign out |
| GET | `/auth/me` | Yes | Current user info |

### Venues

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/venues` | No | List / search / filter venues |
| GET | `/venues/{id}` | No | Venue detail |

`GET /venues` query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search by name or address |
| `type` | string | Comma-separated: `cafe`, `library`, `restaurant`, `bar` |
| `minQuiet` | integer | Minimum quiet score 0–100 |
| `bounds` | string | Map box: `swLat,swLng,neLat,neLng` |
| `sort` | string | `rankingScore` (default), `quietScore`, `mentionCount` |
| `minMentions` | integer | Default `1`; use `3` for production |
| `limit` | integer | Default `50`, max `200` |
| `offset` | integer | Default `0` |

### Favorites & Saved

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me/favorites` | Yes | List favorites |
| POST | `/users/me/favorites/{venueId}` | Yes | Add to favorites |
| DELETE | `/users/me/favorites/{venueId}` | Yes | Remove from favorites |
| GET | `/users/me/saved` | Yes | List saved places |
| POST | `/users/me/saved/{venueId}` | Yes | Save a place |
| DELETE | `/users/me/saved/{venueId}` | Yes | Remove saved place |

### Recent Views

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me/recent` | Yes | Last 5 viewed venues |
| POST | `/users/me/recent/{venueId}` | Yes | Record a venue view |

### Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me/profile` | Yes | User info + stats + all three place lists |

### Reviews

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/venues/{id}/reviews` | No | List reviews for a venue |
| POST | `/venues/{id}/reviews` | Yes | Submit a review (`rating` 1–5, `text`) |
| DELETE | `/reviews/{reviewId}` | Yes | Delete own review |

### Prediction & Live

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/venues/{id}/prediction` | No | Quiet scores: now, +1h, +2h, +3h |
| GET | `/venues/{id}/live` | No | Live occupancy and crowdedness |

> `prediction` returns static values derived from `endorsement_score` until the ML model is ready.
> `live` returns `occupancy: null` until a real-time data source is integrated.

### Chat

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat` | No | Chat assistant (`message`, `language`) |

> Returns a static response until LLM integration is ready.

---

## Project structure

```
backend/
  app/
    main.py           # FastAPI app, middleware, router registration
    database.py       # PostgreSQL connection (reads DATABASE_URL from .env)
    models.py         # SQLAlchemy models (Venue, User, Review, MtaRidership, NycNoise)
    schemas.py        # Pydantic response schemas
    auth.py           # JWT + password hashing utilities
    routers/
      venues.py       # /venues
      auth.py         # /auth
      users.py        # /users/me (favorites, saved, recent, profile)
      reviews.py      # /venues/{id}/reviews, /reviews/{id}
      misc.py         # /prediction, /live, /chat
  scripts/
    import_venues.py          # Import 326 venues from JSONL
    fetch_historical_data.py  # First-time full MTA + 311 import
    update_data.py            # Incremental MTA (weekly) + 311 (daily) updates
    fetch_sample_data.py      # Fetch 2000 sample rows for testing
  requirements.txt
```

## Database tables

| Table | Description | Update frequency |
|-------|-------------|-----------------|
| `venues` | 326 Manhattan quiet spaces (from JSONL) | Static |
| `users` | Registered users | On demand |
| `user_favorites` | User favourites | On demand |
| `user_saved` | User saved places | On demand |
| `user_recent` | Recently viewed venues (max 5) | On demand |
| `reviews` | User reviews | On demand |
| `mta_ridership` | MTA subway hourly ridership — Manhattan | Weekly |
| `nyc_noise` | NYC 311 noise complaints — Manhattan | Daily |

### Weather

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/weather` | No | Current Manhattan weather |

Weather data is fetched from OpenWeather every 15 minutes and cached in memory. No database storage. Requires `OPENWEATHER_API_KEY` in `.env`.

Response fields: `temp`, `feels_like`, `humidity`, `description`, `icon`, `wind_speed`, `fetched_at`.

---

## Notes

- `.env` is not committed to GitHub — create it manually on each server.
- `.env` must contain `DATABASE_URL` and `OPENWEATHER_API_KEY`.
- Compare mode uses two `GET /venues/{id}` calls client-side. No dedicated endpoint.
