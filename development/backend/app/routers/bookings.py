from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from ..database import get_db
from ..models import Booking, Slot, User
from ..schemas import BookingCreate, BookingOut
from ..auth import get_current_user

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
    # NFR-27: идемпотентность (в MVP — просто принимаем заголовок)
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key обязателен")

    # Проверка блокировки (FR-56)
    if user.blocked_until and user.blocked_until > datetime.utcnow():
        raise HTTPException(403, {"code": "client_blocked", "blocked_until": user.blocked_until.isoformat()})

    slot = db.query(Slot).filter(Slot.id == data.slot_id).first()
    if not slot:
        raise HTTPException(404, "Слот не найден")
    if slot.status == "cancelled":
        raise HTTPException(410, {"code": "slot_cancelled", "reason": slot.cancel_reason})
    if slot.starts_at <= datetime.utcnow():
        raise HTTPException(422, {"code": "slot_started"})

    # Гейткинг (FR-55)
    if slot.format == "advanced" and not user.is_allowed_to_rope:
        raise HTTPException(403, {"code": "rope_access_required"})

    # Лимит мест (FR-13)
    if slot.booked_places >= slot.total_places:
        raise HTTPException(409, {"code": "slot_full", "available_seats": 0, "available_rental_boards": slot.rental_available})

    # Прокат (FR-14, FR-15)
    if data.equipment_type == "rental" and slot.rental_available <= 0:
        raise HTTPException(409, {"code": "rental_unavailable", "available_rental_boards": 0})

    # Двойная бронь
    existing = db.query(Booking).filter(
        Booking.user_id == user.id,
        Booking.slot_id == data.slot_id,
        Booking.status == "booked"
    ).first()
    if existing:
        raise HTTPException(409, {"code": "double_booking", "booking_id": existing.id})

    # Возраст ребёнка (FR-54)
    if data.child_age is not None and data.child_age < 6:
        raise HTTPException(400, {"code": "child_age_invalid", "min_age": 6})

    # Согласие с ТБ (FR-51)
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

    # Обновить статус постоянного клиента (BR-10)
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
    if not idempotency_key:
        raise HTTPException(400, "Idempotency-Key обязателен")

    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(404, "Бронь не найдена")
    if booking.status != "booked":
        raise HTTPException(400, {"code": "already_cancelled"})
    if booking.slot.status == "cancelled":
        raise HTTPException(410, {"code": "slot_cancelled"})

    hours_left = (booking.slot.starts_at - datetime.utcnow()).total_seconds() / 3600
    if hours_left < 6:
        booking.status = "cancelled_late"
        user.violations_count += 1
        if user.violations_count >= 3:
            user.blocked_until = datetime.utcnow() + timedelta(days=7)
            user.violations_count = 0
        db.commit()
        return {"status": "cancelled_late", "message": "Поздняя отмена. Нарушение зафиксировано."}

    booking.status = "cancelled_by_client"
    booking.slot.booked_places -= 1
    if booking.equipment_type == "rental":
        booking.slot.rental_available += 1
    db.commit()
    # Здесь можно уведомить первого из Alert List (FR-61)
    return {"status": "cancelled_by_client"}