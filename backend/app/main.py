from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from app.db import Base, engine, get_db
from app.models import Room, Guest, Reservation, reservation_rooms


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Hotel Management API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to frontend URLs before production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RoomIn(BaseModel):
    room_number: str
    room_type: str
    price_per_night: float = Field(gt=0)
    capacity: int = Field(default=2, ge=1)
    status: str = "available"


class GuestIn(BaseModel):
    name: str
    email: str | None = None
    phone: str


class ReservationIn(BaseModel):
    guest_id: int
    room_ids: list[int] = Field(min_length=1)
    check_in: date
    check_out: date


def room_out(room):
    return {
        "id": room.id,
        "room_number": room.room_number,
        "room_type": room.room_type,
        "price_per_night": room.price_per_night,
        "capacity": room.capacity,
        "status": room.status,
    }


def guest_out(guest):
    return {
        "id": guest.id,
        "name": guest.name,
        "email": guest.email,
        "phone": guest.phone,
    }


def reservation_out(reservation):
    nights = (reservation.check_out - reservation.check_in).days
    return {
        "id": reservation.id,
        "guest": guest_out(reservation.guest),
        "rooms": [room_out(r) for r in reservation.rooms],
        "check_in": reservation.check_in,
        "check_out": reservation.check_out,
        "status": reservation.status,
        "total_price": round(
            nights * sum(r.price_per_night for r in reservation.rooms), 2
        ),
    }


# Health
@app.get("/")
def home():
    return {"message": "Hotel Management API is running"}


# Rooms
@app.post("/rooms", status_code=201)
def create_room(data: RoomIn, db: Session = Depends(get_db)):
    if data.status not in {"available", "maintenance"}:
        raise HTTPException(400, "Invalid room status")

    room = Room(**data.model_dump())
    db.add(room)
    try:
        db.commit()
        db.refresh(room)
    except Exception:
        db.rollback()
        raise HTTPException(409, "Room number already exists or invalid data")
    return room_out(room)


@app.get("/rooms")
def list_rooms(
    search: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(Room)
    if search:
        query = query.where(
            or_(
                Room.room_number.ilike(f"%{search}%"),
                Room.room_type.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.where(Room.status == status)
    return [room_out(r) for r in db.scalars(query.order_by(Room.room_number)).all()]


@app.get("/rooms/{room_id}")
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    return room_out(room)


@app.patch("/rooms/{room_id}")
def update_room(room_id: int, data: RoomIn, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if data.status not in {"available", "maintenance"}:
        raise HTTPException(400, "Invalid room status")

    for key, value in data.model_dump().items():
        setattr(room, key, value)
    try:
        db.commit()
        db.refresh(room)
    except Exception:
        db.rollback()
        raise HTTPException(409, "Room number already exists or invalid data")
    return room_out(room)


@app.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if db.scalar(
        select(reservation_rooms.c.room_id).where(
            reservation_rooms.c.room_id == room_id
        ).limit(1)
    ):
        raise HTTPException(409, "Room has reservation history; mark it maintenance instead")
    db.delete(room)
    db.commit()


# Guests
@app.post("/guests", status_code=201)
def create_guest(data: GuestIn, db: Session = Depends(get_db)):
    guest = Guest(**data.model_dump())
    db.add(guest)
    try:
        db.commit()
        db.refresh(guest)
    except Exception:
        db.rollback()
        raise HTTPException(409, "Guest email already exists or invalid data")
    return guest_out(guest)


@app.get("/guests")
def list_guests(search: str | None = None, db: Session = Depends(get_db)):
    query = select(Guest)
    if search:
        query = query.where(
            or_(
                Guest.name.ilike(f"%{search}%"),
                Guest.email.ilike(f"%{search}%"),
                Guest.phone.ilike(f"%{search}%"),
            )
        )
    return [guest_out(g) for g in db.scalars(query.order_by(Guest.name)).all()]


@app.patch("/guests/{guest_id}")
def update_guest(guest_id: int, data: GuestIn, db: Session = Depends(get_db)):
    guest = db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(404, "Guest not found")
    for key, value in data.model_dump().items():
        setattr(guest, key, value)
    try:
        db.commit()
        db.refresh(guest)
    except Exception:
        db.rollback()
        raise HTTPException(409, "Guest email already exists or invalid data")
    return guest_out(guest)


@app.delete("/guests/{guest_id}", status_code=204)
def delete_guest(guest_id: int, db: Session = Depends(get_db)):
    guest = db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(404, "Guest not found")
    if db.scalar(select(Reservation.id).where(Reservation.guest_id == guest_id).limit(1)):
        raise HTTPException(409, "Guest has reservation history and cannot be deleted")
    db.delete(guest)
    db.commit()


# Reservations
@app.post("/reservations", status_code=201)
def create_reservation(data: ReservationIn, db: Session = Depends(get_db)):
    if data.check_in >= data.check_out:
        raise HTTPException(400, "Check-out must be after check-in")

    guest = db.get(Guest, data.guest_id)
    if not guest:
        raise HTTPException(404, "Guest not found")

    if len(set(data.room_ids)) != len(data.room_ids):
        raise HTTPException(400, "Duplicate room IDs are not allowed")

    rooms = db.scalars(
        select(Room).where(Room.id.in_(data.room_ids)).with_for_update()
    ).all()
    if len(rooms) != len(data.room_ids):
        raise HTTPException(404, "One or more rooms not found")

    if any(r.status != "available" for r in rooms):
        raise HTTPException(409, "A selected room is under maintenance")

    # Checkout day is excluded from the occupied period.
    conflicts = db.scalar(
        select(Reservation.id)
        .join(Reservation.rooms)
        .where(
            Room.id.in_(data.room_ids),
            Reservation.status == "confirmed",
            Reservation.check_in < data.check_out,
            Reservation.check_out > data.check_in,
        )
        .limit(1)
    )
    if conflicts:
        raise HTTPException(409, "A selected room is already booked for those dates")

    reservation = Reservation(
        guest_id=data.guest_id,
        check_in=data.check_in,
        check_out=data.check_out,
        rooms=rooms,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    reservation = db.scalar(
        select(Reservation)
        .options(selectinload(Reservation.guest), selectinload(Reservation.rooms))
        .where(Reservation.id == reservation.id)
    )
    return reservation_out(reservation)


@app.get("/reservations")
def list_reservations(
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(Reservation).options(
        selectinload(Reservation.guest), selectinload(Reservation.rooms)
    )
    if status:
        query = query.where(Reservation.status == status)
    reservations = db.scalars(
        query.order_by(Reservation.check_in.desc())
    ).all()
    return [reservation_out(r) for r in reservations]


@app.patch("/reservations/{reservation_id}/cancel")
def cancel_reservation(reservation_id: int, db: Session = Depends(get_db)):
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(404, "Reservation not found")
    if reservation.status != "confirmed":
        raise HTTPException(409, "Reservation is not confirmed")
    reservation.status = "cancelled"
    db.commit()
    return {"message": "Reservation cancelled"}


# Dashboard
@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()

    total_rooms = db.scalar(select(func.count(Room.id))) or 0
    maintenance = db.scalar(
        select(func.count(Room.id)).where(Room.status == "maintenance")
    ) or 0

    occupied_ids = db.scalars(
        select(reservation_rooms.c.room_id)
        .join(Reservation, Reservation.id == reservation_rooms.c.reservation_id)
        .where(
            Reservation.status == "confirmed",
            Reservation.check_in <= today,
            Reservation.check_out > today,
        )
        .distinct()
    ).all()

    guests = db.scalar(select(func.count(Guest.id))) or 0
    upcoming = db.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.status == "confirmed",
            Reservation.check_in >= today,
        )
    ) or 0

    occupied = len(occupied_ids)
    return {
        "total_rooms": total_rooms,
        "occupied_rooms": occupied,
        "available_rooms": max(0, total_rooms - maintenance - occupied),
        "maintenance_rooms": maintenance,
        "total_guests": guests,
        "upcoming_reservations": upcoming,
        "occupancy_percentage": round(occupied / total_rooms * 100, 1)
        if total_rooms else 0,
    }
