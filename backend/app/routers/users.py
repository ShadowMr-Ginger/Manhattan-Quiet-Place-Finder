from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserFavorite, UserSaved, UserRecent, Venue
from ..auth import get_current_user
from .venues import venue_to_summary

router = APIRouter(prefix="/users/me", tags=["users"])

MAX_RECENT = 5


def get_venue_or_404(venue_id: str, db: Session) -> Venue:
    venue = db.query(Venue).filter(Venue.canonical_id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


def venues_from_ids(venue_ids: list[str], db: Session) -> list:
    venues = db.query(Venue).filter(Venue.canonical_id.in_(venue_ids)).all()
    venue_map = {v.canonical_id: v for v in venues}
    return [venue_to_summary(venue_map[vid]) for vid in venue_ids if vid in venue_map]


# ── Favorites ─────────────────────────────────────────────────────────────────

@router.get("/favorites")
def get_favorites(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(UserFavorite)
            .filter(UserFavorite.user_id == current_user.id)
            .order_by(UserFavorite.created_at.desc()).all())
    return {"items": venues_from_ids([r.venue_id for r in rows], db)}


@router.post("/favorites/{venue_id}", status_code=200)
def add_favorite(venue_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_venue_or_404(venue_id, db)
    existing = db.query(UserFavorite).filter_by(user_id=current_user.id, venue_id=venue_id).first()
    if not existing:
        db.add(UserFavorite(user_id=current_user.id, venue_id=venue_id))
        db.commit()
    return {"status": "ok"}


@router.delete("/favorites/{venue_id}", status_code=204)
def remove_favorite(venue_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(UserFavorite).filter_by(user_id=current_user.id, venue_id=venue_id).delete()
    db.commit()


# ── Saved ──────────────────────────────────────────────────────────────────────

@router.get("/saved")
def get_saved(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(UserSaved)
            .filter(UserSaved.user_id == current_user.id)
            .order_by(UserSaved.created_at.desc()).all())
    return {"items": venues_from_ids([r.venue_id for r in rows], db)}


@router.post("/saved/{venue_id}", status_code=200)
def add_saved(venue_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_venue_or_404(venue_id, db)
    existing = db.query(UserSaved).filter_by(user_id=current_user.id, venue_id=venue_id).first()
    if not existing:
        db.add(UserSaved(user_id=current_user.id, venue_id=venue_id))
        db.commit()
    return {"status": "ok"}


@router.delete("/saved/{venue_id}", status_code=204)
def remove_saved(venue_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(UserSaved).filter_by(user_id=current_user.id, venue_id=venue_id).delete()
    db.commit()


# ── Recent views ───────────────────────────────────────────────────────────────

@router.get("/recent")
def get_recent(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(UserRecent)
            .filter(UserRecent.user_id == current_user.id)
            .order_by(UserRecent.viewed_at.desc())
            .limit(MAX_RECENT).all())
    return {"items": venues_from_ids([r.venue_id for r in rows], db)}


@router.post("/recent/{venue_id}", status_code=200)
def add_recent(venue_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_venue_or_404(venue_id, db)
    # Delete old entry if exists so we can re-insert as most recent
    db.query(UserRecent).filter_by(user_id=current_user.id, venue_id=venue_id).delete()
    db.add(UserRecent(user_id=current_user.id, venue_id=venue_id))
    # Keep only the latest MAX_RECENT entries
    all_recent = (db.query(UserRecent)
                  .filter(UserRecent.user_id == current_user.id)
                  .order_by(UserRecent.viewed_at.desc()).all())
    for old in all_recent[MAX_RECENT:]:
        db.delete(old)
    db.commit()
    return {"status": "ok"}


# ── Profile ────────────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    avatar = "".join(w[0].upper() for w in current_user.name.split()[:2])
    fav_count = db.query(UserFavorite).filter_by(user_id=current_user.id).count()
    saved_count = db.query(UserSaved).filter_by(user_id=current_user.id).count()
    recent_count = db.query(UserRecent).filter_by(user_id=current_user.id).count()

    fav_rows = (db.query(UserFavorite).filter_by(user_id=current_user.id)
                .order_by(UserFavorite.created_at.desc()).all())
    saved_rows = (db.query(UserSaved).filter_by(user_id=current_user.id)
                  .order_by(UserSaved.created_at.desc()).all())
    recent_rows = (db.query(UserRecent).filter_by(user_id=current_user.id)
                   .order_by(UserRecent.viewed_at.desc()).limit(MAX_RECENT).all())

    return {
        "user": {"id": current_user.id, "name": current_user.name,
                 "email": current_user.email, "avatar": avatar},
        "stats": {"favorites": fav_count, "saved": saved_count, "recentViewed": recent_count},
        "favorites": venues_from_ids([r.venue_id for r in fav_rows], db),
        "saved": venues_from_ids([r.venue_id for r in saved_rows], db),
        "recentViewed": venues_from_ids([r.venue_id for r in recent_rows], db),
    }
