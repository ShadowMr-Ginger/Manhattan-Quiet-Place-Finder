from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Review, Venue, User
from ..auth import get_current_user

router = APIRouter(tags=["reviews"])


class ReviewRequest(BaseModel):
    rating: int
    text: str


@router.get("/venues/{venue_id}/reviews")
def get_reviews(venue_id: str, db: Session = Depends(get_db)):
    if not db.query(Venue).filter(Venue.canonical_id == venue_id).first():
        raise HTTPException(status_code=404, detail="Venue not found")

    reviews = (db.query(Review)
               .filter(Review.venue_id == venue_id)
               .order_by(Review.created_at.desc()).all())

    items = []
    for r in reviews:
        user = db.query(User).filter(User.id == r.user_id).first()
        avatar = "".join(w[0].upper() for w in user.name.split()[:2]) if user else "?"
        items.append({
            "id": r.id,
            "userId": r.user_id,
            "userName": user.name if user else "Unknown",
            "avatar": avatar,
            "rating": r.rating,
            "text": r.text,
            "createdAt": r.created_at.isoformat(),
        })

    avg = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None
    return {"items": items, "averageRating": avg, "count": len(items)}


@router.get("/reviews/me")
def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reviews = (db.query(Review)
               .filter(Review.user_id == current_user.id)
               .order_by(Review.created_at.desc()).all())

    items = []
    for r in reviews:
        venue = db.query(Venue).filter(Venue.canonical_id == r.venue_id).first()
        items.append({
            "id": r.id,
            "venueId": r.venue_id,
            "venueName": venue.canonical_name if venue else "Unknown",
            "rating": r.rating,
            "text": r.text,
            "createdAt": r.created_at.isoformat(),
        })

    return {"items": items, "count": len(items)}


@router.post("/venues/{venue_id}/reviews", status_code=201)
def create_review(
    venue_id: str,
    body: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Venue).filter(Venue.canonical_id == venue_id).first():
        raise HTTPException(status_code=404, detail="Venue not found")
    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    review = Review(venue_id=venue_id, user_id=current_user.id,
                    rating=body.rating, text=body.text.strip())
    db.add(review)
    db.commit()
    db.refresh(review)

    avatar = "".join(w[0].upper() for w in current_user.name.split()[:2])
    return {
        "id": review.id,
        "userId": review.user_id,
        "userName": current_user.name,
        "avatar": avatar,
        "rating": review.rating,
        "text": review.text,
        "createdAt": review.created_at.isoformat(),
    }


@router.get("/reviews/me")
def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reviews = (db.query(Review)
               .filter(Review.user_id == current_user.id)
               .order_by(Review.created_at.desc()).all())
    items = []
    for r in reviews:
        venue = db.query(Venue).filter(Venue.canonical_id == r.venue_id).first()
        items.append({
            "id": r.id,
            "venueId": r.venue_id,
            "venueName": venue.canonical_name if venue else "Unknown",
            "rating": r.rating,
            "text": r.text,
            "createdAt": r.created_at.isoformat(),
        })
    return {"items": items, "count": len(items)}


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(
    review_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's review")
    db.delete(review)
    db.commit()
