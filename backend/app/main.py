import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .database import engine, Base
from .routers import venues, auth, users, reviews, misc, weather

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start weather refresh background task
    task = asyncio.create_task(weather.refresh_loop())
    yield
    task.cancel()


app = FastAPI(title="Hush-Hub API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(venues.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(misc.router, prefix="/api")
app.include_router(weather.router, prefix="/api")


def _frontend_base(request: Request) -> str:
    """Where auth emails should land (the React app), never this API host."""
    configured = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
    api_origin = str(request.base_url).rstrip("/")
    if not configured or configured == api_origin or configured.startswith(f"{api_origin}/"):
        return "http://127.0.0.1:5173"
    return configured


@app.get("/")
def root(request: Request):
    # Old / misconfigured emails pointed at the API host with ?verify= / ?reset=.
    # Forward those to the frontend so the SPA can call /api/auth/verify-email.
    verify = request.query_params.get("verify")
    reset = request.query_params.get("reset")
    frontend = _frontend_base(request)
    if verify:
        return RedirectResponse(url=f"{frontend}?verify={verify}", status_code=302)
    if reset:
        return RedirectResponse(url=f"{frontend}?reset={reset}", status_code=302)
    return {"status": "ok", "docs": "/docs"}
