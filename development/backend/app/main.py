from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import Instructor, Slot, User
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    if db.query(Instructor).count() == 0:
        i1 = Instructor(name="Алексей")
        i2 = Instructor(name="Мария")
        db.add_all([i1, i2])
        db.commit()
        db.refresh(i1); db.refresh(i2)
        for d in range(7):
            for h in [10, 14, 18, 20]:
                fmt = random.choice(["beginner", "advanced"])
                slot = Slot(
                    starts_at=datetime.utcnow() + timedelta(days=d, hours=h),
                    format=fmt,
                    instructor_id=i1.id if random.random() > 0.5 else i2.id,
                    total_places=8 if fmt == "beginner" else 16,
                    rental_available=20,
                )
                db.add(slot)
        db.commit()
    db.close()

seed()

app = FastAPI(title="Скалодром «Вертикаль»")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routers import auth, slots, bookings, ratings, waitlist
app.include_router(auth.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(waitlist.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}