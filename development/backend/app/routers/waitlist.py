from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import WaitlistEntry, Slot, User
from ..auth import get_current_user

router = APIRouter(prefix="/slots", tags=["waitlist"])

@router.post("/{slot_id}/waitlist")
def join_waitlist(
    slot_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slot = db.query(Slot).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Слот не найден")
    if slot.status == "cancelled":
        raise HTTPException(410, "Слот отменён")
    if slot.booked_places < slot.total_places:
        raise HTTPException(409, {"code": "slot_not_full"})

    existing = db.query(WaitlistEntry).filter(
        WaitlistEntry.slot_id == slot_id,
        WaitlistEntry.user_id == user.id,
        WaitlistEntry.status == "active"
    ).first()
    if existing:
        raise HTTPException(409, {"code": "waitlist_already_joined", "position": existing.position})

    max_pos = db.query(WaitlistEntry).filter(
        WaitlistEntry.slot_id == slot_id,
        WaitlistEntry.status.in_(["active", "notified"])
    ).count()
    entry = WaitlistEntry(slot_id=slot_id, user_id=user.id, position=max_pos + 1)
    db.add(entry)
    db.commit()
    return {"position": entry.position}

@router.delete("/{slot_id}/waitlist")
def leave_waitlist(
    slot_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.slot_id == slot_id,
        WaitlistEntry.user_id == user.id,
        WaitlistEntry.status == "active"
    ).first()
    if not entry:
        raise HTTPException(404, "Вы не в списке")
    entry.status = "expired"
    db.commit()
    return {"status": "ok"}