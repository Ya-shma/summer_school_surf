from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import Instructor, Slot, User, Booking, Rating, WaitlistEntry
from datetime import datetime, timedelta
import random
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Создание таблиц
Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # Инструкторы
    if db.query(Instructor).count() == 0:
        i1 = Instructor(name="Алексей")
        i2 = Instructor(name="Мария")
        i3 = Instructor(name="Дмитрий")
        db.add_all([i1, i2, i3])
        db.commit()
        db.refresh(i1); db.refresh(i2); db.refresh(i3)
        
        # === ПОЛЬЗОВАТЕЛИ ===
        # Тестовый пользователь
        u1 = User(
            phone="+79991234567",
            name="Тестовый Клиент",
            age=28,
            birthday="1998-05-15",
            is_allowed_to_rope=True,
            is_permanent=False,
            violations_count=0,
            safety_rules_accepted=True,
            attended_count=7,
        )
        
        # Постоянный клиент (для проверки бейджа)
        u2 = User(
            phone="+79997654321",
            name="Постоянный Клиент",
            is_allowed_to_rope=True,
            is_permanent=True,
            attended_count=15,
            safety_rules_accepted=True, 
        )
        
        # Новичок (без допуска к верёвкам)
        u3 = User(
            phone="+79991112233",
            name="Новичок Иван",
            is_allowed_to_rope=False,
            attended_count=2,
            safety_rules_accepted=True, 
        )
        
        # Заблокированный клиент
        u4 = User(
            phone="+79994445566",
            name="Нарушитель Пётр",
            is_allowed_to_rope=True,
            violations_count=3,
            blocked_until=datetime.utcnow() + timedelta(days=5),
            attended_count=4,
            safety_rules_accepted=True,  
        )
        
        db.add_all([u1, u2, u3, u4])
        db.commit()
        db.refresh(u1); db.refresh(u2); db.refresh(u3); db.refresh(u4)
        
        # === СЛОТЫ ===
        now = datetime.utcnow()
        
        # Слот 1: Будущий, новичковый, свободный (через 2 дня)
        s1 = Slot(
            starts_at=now + timedelta(days=2, hours=10),
            format="beginner",
            instructor_id=i1.id,
            total_places=8,
            booked_places=3,
            rental_available=17,
            status="scheduled",
        )
        
        # Слот 2: Будущий, опытный, свободный (через 3 дня)
        s2 = Slot(
            starts_at=now + timedelta(days=3, hours=18),
            format="advanced",
            instructor_id=i2.id,
            total_places=16,
            booked_places=5,
            rental_available=15,
            status="scheduled",
        )
        
        # Слот 3: Заполненный (для проверки Alert List)
        s3 = Slot(
            starts_at=now + timedelta(days=4, hours=20),
            format="beginner",
            instructor_id=i3.id,
            total_places=8,
            booked_places=8,
            rental_available=0,
            status="scheduled",
        )
        
        # Слот 4: Отменённый скалодромом
        s4 = Slot(
            starts_at=now + timedelta(days=5, hours=14),
            format="advanced",
            instructor_id=i1.id,
            total_places=16,
            booked_places=10,
            rental_available=10,
            status="cancelled",
            cancel_reason="Профилактика оборудования",
        )
        
        # Слот 5: Прошедший (для статуса attended)
        s5 = Slot(
            starts_at=now - timedelta(days=1, hours=2),
            format="beginner",
            instructor_id=i2.id,
            total_places=8,
            booked_places=6,
            rental_available=14,
            status="scheduled",
        )
        
        # Слот 6: Сегодня вечером (для проверки отмены)
        s6 = Slot(
            starts_at=now + timedelta(hours=8),
            format="beginner",
            instructor_id=i1.id,
            total_places=8,
            booked_places=2,
            rental_available=18,
            status="scheduled",
        )
        
        # Слот 7: Через 30 минут (для проверки поздней отмены)
        s7 = Slot(
            starts_at=now + timedelta(minutes=30),
            format="advanced",
            instructor_id=i3.id,
            total_places=16,
            booked_places=10,
            rental_available=10,
            status="scheduled",
        )
        
        # Ещё несколько слотов для заполнения расписания
        for d in range(7):
            for h in [10, 14, 18, 20]:
                if d == 0 and h <= now.hour:
                    continue
                fmt = random.choice(["beginner", "advanced"])
                slot = Slot(
                    starts_at=now + timedelta(days=d, hours=h - now.hour),
                    format=fmt,
                    instructor_id=random.choice([i1.id, i2.id, i3.id]),
                    total_places=8 if fmt == "beginner" else 16,
                    booked_places=random.randint(0, 6) if fmt == "beginner" else random.randint(0, 12),
                    rental_available=20,
                    status="scheduled",
                )
                db.add(slot)
        
        db.add_all([s1, s2, s3, s4, s5, s6, s7])
        db.commit()
        db.refresh(s1); db.refresh(s2); db.refresh(s3); db.refresh(s4)
        db.refresh(s5); db.refresh(s6); db.refresh(s7)
        
        # === БРОНИ ===
        b1 = Booking(
            user_id=u1.id,
            slot_id=s1.id,
            equipment_type="rental",
            status="booked",
        )
        
        b2 = Booking(
            user_id=u1.id,
            slot_id=s2.id,
            equipment_type="own",
            status="booked",
        )
        
        b3 = Booking(
            user_id=u1.id,
            slot_id=s6.id,
            equipment_type="own",
            status="cancelled_by_client",
        )
        
        b4 = Booking(
            user_id=u1.id,
            slot_id=s5.id,
            equipment_type="rental",
            status="attended",
        )
        
        b5 = Booking(
            user_id=u1.id,
            slot_id=s4.id,
            equipment_type="own",
            status="cancelled_by_gym",
        )
        
        b6 = Booking(
            user_id=u2.id,
            slot_id=s1.id,
            equipment_type="own",
            status="booked",
        )
        
        b7 = Booking(
            user_id=u2.id,
            slot_id=s3.id,
            equipment_type="rental",
            status="booked",
        )
        
        db.add_all([b1, b2, b3, b4, b5, b6, b7])
        db.commit()
        db.refresh(b1); db.refresh(b2); db.refresh(b3); db.refresh(b4)
        db.refresh(b5); db.refresh(b6); db.refresh(b7)
        
        # === ОЦЕНКИ ===
        r1 = Rating(
            booking_id=b4.id,
            stars=5,
        )
        db.add(r1)
        
        # === ALERT LIST ===
        w1 = WaitlistEntry(
            slot_id=s3.id,
            user_id=u1.id,
            position=1,
            status="active",
        )
        db.add(w1)
        
        db.commit()
        print("✅ Seed data created successfully!")
        print(f"   Users: {db.query(User).count()}")
        print(f"   Slots: {db.query(Slot).count()}")
        print(f"   Bookings: {db.query(Booking).count()}")
        print(f"   Ratings: {db.query(Rating).count()}")
        print(f"   Waitlist: {db.query(WaitlistEntry).count()}")
    
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