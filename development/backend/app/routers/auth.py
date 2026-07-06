from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import PhoneRequest, VerifyCode, ProfileUpdate
from ..auth import PENDING_CODES, create_access_token, get_current_user
import re

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/send-code")
def send_code(req: PhoneRequest, db: Session = Depends(get_db)):
    phone = re.sub(r"\D", "", req.phone)
    if len(phone) < 10:
        raise HTTPException(400, "Неверный номер")
    code = "1234"  # SMS-заглушка
    PENDING_CODES[phone] = code
    return {"status": "ok", "hint": f"Dev-код: {code}"}

@router.post("/verify")
def verify(req: VerifyCode, response: Response, db: Session = Depends(get_db)):
    phone = re.sub(r"\D", "", req.phone)
    expected = PENDING_CODES.get(phone)
    if not expected or expected != req.code:
        raise HTTPException(400, "Неверный код")
    del PENDING_CODES[phone]

    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        user = User(phone=phone, name="")
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"token": create_access_token(user.id), "needs_profile": True}
    return {"token": create_access_token(user.id), "needs_profile": False}

@router.post("/profile")
def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ✅ ДОБАВЛЕНО: обработка safety_rules_accepted
    if data.safety_rules_accepted is not None:
        user.safety_rules_accepted = data.safety_rules_accepted
    
    if data.name:
        user.name = data.name
    if data.age is not None:
        user.age = data.age
    if data.birthday:
        user.birthday = data.birthday
    
    db.commit()
    db.refresh(user)
    
    return {
        "status": "ok",
        "safety_rules_accepted": user.safety_rules_accepted,
        "name": user.name,
    }

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "phone": user.phone,
        "name": user.name,
        "age": user.age,
        "birthday": user.birthday,
        "is_allowed_to_rope": user.is_allowed_to_rope,
        "is_permanent": user.is_permanent,
        "attended_count": user.attended_count,
        "safety_rules_accepted": user.safety_rules_accepted,  # ✅ ДОБАВЛЕНО
        "blocked_until": user.blocked_until.isoformat() if user.blocked_until else None,
    }