from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from ..database import get_db
from ..models import Slot
from ..schemas import SlotOut
from ..auth import get_current_user

router = APIRouter(prefix="/slots", tags=["slots"])

@router.get("/", response_model=List[SlotOut])
def list_slots(
    days: int = 7,
    format: str = None,
    instructor_id: int = None,
    only_available: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    now = datetime.utcnow()
    to = now + timedelta(days=days)
    q = db.query(Slot).filter(Slot.starts_at >= now, Slot.starts_at <= to)
    if format:
        q = q.filter(Slot.format == format)
    if instructor_id:
        q = q.filter(Slot.instructor_id == instructor_id)
    if only_available:
        q = q.filter(Slot.booked_places < Slot.total_places)
    slots = q.order_by(Slot.starts_at).all()
    return [
        SlotOut(
            id=s.id,
            starts_at=s.starts_at,
            format=s.format,
            instructor_name=s.instructor.name if s.instructor else "—",
            total_places=s.total_places,
            free_places=s.total_places - s.booked_places,
            rental_available=s.rental_available,
        )
        for s in slots
    ]