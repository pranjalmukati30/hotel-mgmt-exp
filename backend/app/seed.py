from datetime import date, timedelta

from sqlalchemy import select

from app.db import Base, engine, SessionLocal
from app.models import Room, Guest, Reservation

# Ensure tables exist
Base.metadata.create_all(bind=engine)


def seed_data():
    with SessionLocal() as db:
        # Prevent duplicate demo data on reruns
        existing = db.scalar(
            select(Guest.id).where(
                Guest.email == "aarav.sharma@example.com"
            )
        )
        if existing:
            print("Demo data already exists. Skipping seed.")
            return

        room_data = [
            ("101", "Standard", 1800, 2, "available"),
            ("102", "Standard", 1800, 2, "available"),
            ("103", "Standard", 2000, 2, "available"),
            ("104", "Deluxe", 2800, 2, "available"),
            ("105", "Deluxe", 3000, 3, "available"),
            ("106", "Deluxe", 3200, 3, "available"),
            ("107", "Suite", 5000, 4, "available"),
            ("108", "Suite", 5500, 4, "available"),
            ("109", "Standard", 1900, 2, "available"),
            ("110", "Deluxe", 3100, 3, "available"),
            ("111", "Suite", 6000, 4, "available"),
            ("112", "Standard", 1800, 2, "maintenance"),
        ]

        rooms = {}
        for number, kind, price, capacity, status in room_data:
            room = Room(
                room_number=number,
                room_type=kind,
                price_per_night=price,
                capacity=capacity,
                status=status,
            )
            db.add(room)
            rooms[number] = room

        guest_data = [
            ("Aarav Sharma", "aarav.sharma@example.com", "9000000001"),
            ("Priya Verma", "priya.verma@example.com", "9000000002"),
            ("Rahul Mehta", "rahul.mehta@example.com", "9000000003"),
            ("Ananya Patel", "ananya.patel@example.com", "9000000004"),
            ("Vikram Singh", "vikram.singh@example.com", "9000000005"),
            ("Neha Joshi", "neha.joshi@example.com", "9000000006"),
            ("Arjun Kapoor", "arjun.kapoor@example.com", "9000000007"),
            ("Isha Gupta", "isha.gupta@example.com", "9000000008"),
        ]

        guests = {}
        for name, email, phone in guest_data:
            guest = Guest(name=name, email=email, phone=phone)
            db.add(guest)
            guests[email] = guest

        # Assign IDs before creating reservations
        db.flush()

        today = date.today()

        reservation_data = [
            # Past stays
            ("aarav.sharma@example.com", ["101"],
             today - timedelta(days=12), today - timedelta(days=9)),

            ("priya.verma@example.com", ["107"],
             today - timedelta(days=20), today - timedelta(days=17)),

            # Currently staying
            ("rahul.mehta@example.com", ["102", "103"],
             today - timedelta(days=2), today + timedelta(days=2)),

            ("ananya.patel@example.com", ["106"],
             today - timedelta(days=1), today + timedelta(days=3)),

            # Upcoming stays
            ("vikram.singh@example.com", ["104", "105"],
             today + timedelta(days=1), today + timedelta(days=4)),

            ("neha.joshi@example.com", ["101"],
             today + timedelta(days=3), today + timedelta(days=6)),

            ("arjun.kapoor@example.com", ["108"],
             today + timedelta(days=5), today + timedelta(days=8)),

            ("isha.gupta@example.com", ["109", "110"],
             today + timedelta(days=2), today + timedelta(days=5)),
        ]

        for email, room_numbers, check_in, check_out in reservation_data:
            reservation = Reservation(
                guest=guests[email],
                rooms=[rooms[number] for number in room_numbers],
                check_in=check_in,
                check_out=check_out,
                status="confirmed",
            )
            db.add(reservation)

        db.commit()

        print("Demo data seeded successfully!")
        print(f"Rooms: {len(room_data)}")
        print(f"Guests: {len(guest_data)}")
        print(f"Reservations: {len(reservation_data)}")


if __name__ == "__main__":
    seed_data()
