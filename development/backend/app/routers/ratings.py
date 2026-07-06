from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..database import get_db
from ..models import Rating, Booking, User, Slot
from ..schemas import RatingCreate
from ..auth import get_current_user

router = APIRouter(prefix="/ratings", tags=["ratings"])

@router.get("/booking/{booking_id}")
def get_rating(
    booking_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(404, "Бронь не найдена")
    rating = db.query(Rating).filter(Rating.booking_id == booking_id).first()
    return {
        "booking_id": booking_id,
        "instructor_name": booking.slot.instructor.name if booking.slot.instructor else "—",
        "starts_at": booking.slot.starts_at.isoformat(),
        "rating": rating.stars if rating else None,
    }

@router.post("/")
def rate(
    data: RatingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (1 <= data.stars <= 5):
        raise HTTPException(400, "Оценка от 1 до 5")
    booking = db.query(Booking).filter(Booking.id == data.booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(404, "Бронь не найдена")
    if booking.status != "attended":
        raise HTTPException(403, {"code": "not_attended"})

    # Окно оценки: через 1 час после окончания (примерно 2.5 часа после старта)
    if datetime.utcnow() < booking.slot.starts_at + timedelta(hours=2.5):
        raise HTTPException(403, {"code": "rating_window_closed"})

    existing = db.query(Rating).filter(Rating.booking_id == data.booking_id).first()
    if existing:
        existing.stars = data.stars
    else:
        db.add(Rating(booking_id=data.booking_id, stars=data.stars))
    db.commit()
    return {"status": "ok", "rating": data.stars}