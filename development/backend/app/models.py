from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False, default="")
    age = Column(Integer, nullable=True)
    birthday = Column(String, nullable=True)
    is_allowed_to_rope = Column(Boolean, default=False)
    is_permanent = Column(Boolean, default=False)
    violations_count = Column(Integer, default=0)
    blocked_until = Column(DateTime, nullable=True)
    safety_rules_accepted = Column(Boolean, default=False)
    attended_count = Column(Integer, default=0)
    push_subscription = Column(Text, nullable=True)  # Web Push subscription JSON

class Instructor(Base):
    __tablename__ = "instructors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

class Slot(Base):
    __tablename__ = "slots"
    id = Column(Integer, primary_key=True, index=True)
    starts_at = Column(DateTime, nullable=False)
    format = Column(String, nullable=False)  # 'beginner' | 'advanced'
    instructor_id = Column(Integer, ForeignKey("instructors.id"))
    total_places = Column(Integer, nullable=False)
    booked_places = Column(Integer, default=0)
    rental_available = Column(Integer, default=20)
    status = Column(String, default="scheduled")  # 'scheduled' | 'cancelled'
    cancel_reason = Column(String, nullable=True)
    instructor = relationship("Instructor")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    slot_id = Column(Integer, ForeignKey("slots.id"))
    equipment_type = Column(String)  # 'own' | 'rental'
    status = Column(String, default="booked")
    child_age = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    slot = relationship("Slot")

class Rating(Base):
    __tablename__ = "ratings"
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True)
    stars = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class WaitlistEntry(Base):
    __tablename__ = "waitlist"
    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("slots.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    position = Column(Integer, nullable=False)
    status = Column(String, default="active")  # 'active' | 'notified' | 'expired'
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint('slot_id', 'user_id', name='uq_waitlist'),)