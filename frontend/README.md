# HushHub Web (Desktop)

React + Vite frontend for **Quiet Spaces Manhattan** — discover quieter cafés, libraries, and public study spots in Manhattan on an interactive map.

This is the **desktop web client**. A separate mobile app covers the mobile experience; this repo does not include responsive mobile layouts.

---

## Features

- Interactive Google Map with clustered venue markers
- Left sidebar: place search (Google autocomplete + address → map origin), type filters, busy-level filter, venue list sorted by distance or ranking
- Map toolbar: **My location**, **Busyness** heatmap overlay
- Right detail panel: photos, ratings, quiet-inside / busy-level signals, 24h busy chart when data exists, OSM amenities, Google Maps directions
- Auth: register → email verification link → login; forgot / reset password; favorites, saved places, recently viewed, reviews
- Weather widget (Manhattan, via backend)
- UI languages: English, 中文, Español
- Light / dark theme (preference saved in `localStorage`)
- **Get the app** (top nav): web tip + Android APK download link

---

## Requirements

- Node.js 18+
- npm
- [HushHub backend](../backend/README.md) running locally (or another host you point `VITE_API_BASE_URL` at)
- Google Cloud project with **Maps JavaScript API** and **Places API** enabled

> **Note:** Directions API is **not** required. Route planning opens Google Maps in a new tab via a public URL.

---

## Quick start

```bash
cd frontend
cp .env.example .env
# Edit .env with your Google Maps key and API base URL
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

In another terminal, start the backend:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Environment variables

Copy `.env.example` to `.env` (`.env` is gitignored):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Yes (for full UX) | Maps JavaScript + Places (autocomplete, photos, geocode) |
| `VITE_GOOGLE_MAPS_MAP_ID` | No | Vector map ID for Advanced Markers; defaults to `DEMO_MAP_ID` |
| `VITE_API_BASE_URL` | No | FastAPI base URL; defaults to `http://localhost:8000/api` |
| `VITE_ANDROID_APK_URL` | No | Android APK download URL (GitHub Release); defaults to the team’s documented release asset |
| `VITE_PUBLIC_WEB_URL` | No | Canonical web URL shown in Get the app; defaults to current origin |

Without a Google Maps key, the app falls back to a static placeholder map (list and data still work).

Weather is fetched from the **backend** (`GET /api/weather`). Configure `OPENWEATHER_API_KEY` in `backend/.env`, not in the frontend.

Email verification / password-reset links are sent by the **backend** (`SMTP_*` + `FRONTEND_URL`). Point `FRONTEND_URL` at this app’s origin (e.g. `http://127.0.0.1:5173`), not the API host.

---

## Google Cloud setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable:
   - **Maps JavaScript API**
   - **Places API**
3. Create an API key and restrict it (HTTP referrers for local dev + your production domain).
4. (Optional) Create a [Map ID](https://console.cloud.google.com/google/maps-apis/studio/maps) for custom styling; enable **Dark** variant if you use dark mode.

**Do not enable Directions API** for this app — directions link out to `google.com/maps`.

---

## Project structure

```
frontend/
├── public/                 # Static assets (favicon, …)
├── src/
│   ├── App.jsx             # Root state, auth URL handling, filters
│   ├── components/         # UI (map, sidebars, auth, charts, …)
│   │   └── map/            # Google map, clusters, busyness heatmap
│   ├── services/           # API clients (venues, auth, reviews, weather)
│   ├── hooks/              # Location, weather, photos, localization
│   ├── language/           # i18n provider + fallback strings
│   ├── utils/              # Geo, search geocode, busyness / venue display
│   └── data/constants.js   # Venue types, filters
├── .env.example            # Env template (copy to .env)
└── package.json
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run lint` | Run ESLint |

---

## Production build

```bash
npm run build
npm run preview   # optional local check
```

Deploy the contents of `dist/` to any static host (Vercel, Netlify, S3, etc.). Set `VITE_*` variables at **build time**.

Point `VITE_API_BASE_URL` to your deployed backend and ensure CORS allows your frontend origin.

---

## Data & behaviour notes

| What you see | Source |
|--------------|--------|
| Venue list & details | Backend `/api/venues` |
| Star rating | Editorial + user reviews when available |
| Busy level badge / filter | NYC-hour busyness from backend signals |
| Busy Level chart | Full-day hourly curve when enough points exist |
| Busyness heatmap | Map overlay from current crowdedness of visible venues |
| Distance on cards | km from search origin, else GPS / Manhattan center |
| Search address | Autocomplete pick or Enter/search geocodes → map origin + distance sort |
| Directions button | Opens Google Maps (external) |
| Quiet inside | Editorial noise/crowding signals |
| AI chat | Placeholder until LLM is connected (`POST /api/chat`) |
| Reviews | Real user data after login |
| Opening hours chip | OpenStreetMap `opening_hours`, shortened for display |

Default venue filter: venues with `mention_count >= 1` (see `DEFAULT_MIN_MENTIONS` in `src/services/venues.js`).

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `↑` / `↓` | Move focus in venue list |
| `Enter` | Open focused venue |
| `Esc` | Close panel or modal |

---

## Work in progress

- **AI assistant** — static / keyword replies only
- **Quiet Score time tabs** — placeholder until ML prediction API is connected

Everything else in the desktop flow is wired to the backend and intended for demo or internal use.

---

## Related docs

- Backend setup & API: [`../backend/README.md`](../backend/README.md)
- API specification: [`../backend/docs/API.md`](../backend/docs/API.md)
