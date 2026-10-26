from datetime import date

from sqlalchemy import (
    String, Integer, Float, Date, ForeignKey, Table, Column
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


reservation_rooms = Table(
    "reservation_rooms",
    Base.metadata,
    Column("reservation_id", ForeignKey("reservations.id"), primary_key=True),
    Column("room_id", ForeignKey("rooms.id"), primary_key=True),
    Column("nightly_rate", Float, nullable=False),
)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True)
    room_type: Mapped[str] = mapped_column(String(50))
    price_per_night: Mapped[float] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(String(20), default="available")


class Guest(Base):
    __tablename__ = "guests"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(20))


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guests.id"))
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")

    guest: Mapped[Guest] = relationship()
    rooms: Mapped[list[Room]] = relationship(
    secondary=reservation_rooms,
    collection_class=list,
)
