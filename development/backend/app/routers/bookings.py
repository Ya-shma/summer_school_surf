from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import logging
from ..database import get_db
from ..models import Booking, Slot, User
from ..schemas import BookingCreate, BookingOut
from ..auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])

def _to_out(b: Booking) -> BookingOut:
    hours_left = (b.slot.starts_at - datetime.utcnow()).total_seconds() / 3600
    can_cancel = b.status == "booked" and hours_left >= 6 and b.slot.status != "cancelled"
    return BookingOut(
        id=b.id,
        slot_id=b.slot_id,
        equipment_type=b.equipment_type,
        status=b.status,
        starts_at=b.slot.starts_at,
        format=b.slot.format,
        instructor_name=b.slot.instructor.name if b.slot.instructor else "—",
        child_age=b.child_age,
        can_cancel=can_cancel,
        slot_status=b.slot.status,
        cancel_reason=b.slot.cancel_reason,
    )

@router.post("/")
def create_booking(
    data: BookingCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(f"[BOOKING] User {user.id} attempting to book slot {data.slot_id}")

    if user.blocked_until and user.blocked_until > datetime.utcnow():
        raise HTTPException(403, {"code": "client_blocked", "blocked_until": user.blocked_until.isoformat()})

    slot = db.query(Slot).filter(Slot.id == data.slot_id).first()
    if not slot:
        raise HTTPException(404, "Слот не найден")
    if slot.status == "cancelled":
        raise HTTPException(410, {"code": "slot_cancelled", "reason": slot.cancel_reason})
    if slot.starts_at <= datetime.utcnow():
        raise HTTPException(422, {"code": "slot_started"})

    if slot.format == "advanced" and not user.is_allowed_to_rope:
        raise HTTPException(403, {"code": "rope_access_required"})

    if slot.booked_places >= slot.total_places:
        raise HTTPException(409, {"code": "slot_full", "available_seats": 0, "available_rental_boards": slot.rental_available})

    if data.equipment_type == "rental" and slot.rental_available <= 0:
        raise HTTPException(409, {"code": "rental_unavailable", "available_rental_boards": 0})

    existing = db.query(Booking).filter(
        Booking.user_id == user.id,
        Booking.slot_id == data.slot_id,
        Booking.status == "booked"
    ).first()
    if existing:
        raise HTTPException(409, {"code": "double_booking", "booking_id": existing.id})

    if data.child_age is not None and data.child_age < 6:
        raise HTTPException(400, {"code": "child_age_invalid", "min_age": 6})

    if not user.safety_rules_accepted:
        raise HTTPException(400, {"code": "safety_rules_not_accepted"})

    booking = Booking(
        user_id=user.id,
        slot_id=data.slot_id,
        equipment_type=data.equipment_type,
        child_age=data.child_age,
    )
    slot.booked_places += 1
    if data.equipment_type == "rental":
        slot.rental_available -= 1
    db.add(booking)
    db.commit()
    db.refresh(booking)

    logger.info(f"[BOOKING] Success! Booking {booking.id} created")

    if user.attended_count >= 10 and not user.is_permanent:
        user.is_permanent = True
        db.commit()

    return _to_out(booking)

@router.get("/", response_model=List[BookingOut])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [_to_out(b) for b in bookings]

@router.delete("/{booking_id}")
def cancel_booking(
    booking_id: int,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(f"[CANCEL] User {user.id} attempting to cancel booking {booking_id}")

    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(404, "Бронь не найдена")
    if booking.status != "booked":
        logger.warning(f"[CANCEL] Booking {booking_id} already cancelled (status={booking.status})")
        raise HTTPException(400, {"code": "already_cancelled"})
    if booking.slot.status == "cancelled":
        raise HTTPException(410, {"code": "slot_cancelled"})

    hours_left = (booking.slot.starts_at - datetime.utcnow()).total_seconds() / 3600
    logger.info(f"[CANCEL] Hours left: {hours_left:.1f}")

    if hours_left < 6:
        # Поздняя отмена
        booking.status = "cancelled_late"
        user.violations_count += 1
        logger.warning(f"[CANCEL] Late cancellation! Violations count: {user.violations_count}")
        
        if user.violations_count >= 3:
            user.blocked_until = datetime.utcnow() + timedelta(days=7)
            user.violations_count = 0
            logger.warning(f"[CANCEL] User blocked until {user.blocked_until}")
        
        db.commit()
        return {
            "status": "cancelled_late",
            "message": "Поздняя отмена (< 6 часов). Нарушение зафиксировано. Место не освобождено."
        }

    # Ранняя отмена
    booking.status = "cancelled_by_client"
    booking.slot.booked_places -= 1
    if booking.equipment_type == "rental":
        booking.slot.rental_available += 1
    
    logger.info(f"[CANCEL] Early cancellation successful. Booking {booking_id} cancelled")
    db.commit()
    
    # Здесь можно уведомить первого из Alert List (FR-61)
    # TODO: notify_waitlist(slot_id)
    
    return {"status": "cancelled_by_client"}