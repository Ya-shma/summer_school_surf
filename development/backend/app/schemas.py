from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class PhoneRequest(BaseModel):
    phone: str

class VerifyCode(BaseModel):
    phone: str
    code: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    birthday: Optional[str] = None
    safety_rules_accepted: Optional[bool] = None 

class SlotOut(BaseModel):
    id: int
    starts_at: datetime
    format: str
    instructor_name: str
    total_places: int
    free_places: int
    rental_available: int
    price: int = 1500
    status: str = "scheduled"
    cancel_reason: Optional[str] = None

    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    slot_id: int
    equipment_type: str  # 'own' | 'rental'
    child_age: Optional[int] = None

class BookingOut(BaseModel):
    id: int
    slot_id: int
    equipment_type: str
    status: str
    starts_at: datetime
    format: str
    instructor_name: str
    child_age: Optional[int]
    can_cancel: bool
    slot_status: str = "scheduled"
    cancel_reason: Optional[str] = None

    class Config:
        from_attributes = True

class RatingCreate(BaseModel):
    booking_id: int
    stars: int