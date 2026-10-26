import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, BedDouble, Users, CalendarCheck, IndianRupee,
  Search, Bell, Plus, ArrowUpRight, ArrowDownRight, MoreHorizontal,
  Clock, CheckCircle2, LogOut, RefreshCw, X, Pencil, Trash2,
  Ban, CircleAlert, LoaderCircle, CalendarDays, UserRound, DoorOpen,
} from "lucide-react";
import {
  api, fetchDashboard, fetchGuests, fetchReservations, fetchRooms,
  createRoom, updateRoom, deleteRoom, createGuest, updateGuest,
  deleteGuest, createReservation, cancelReservation,
} from "./api";
import "./App.css";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Rooms", icon: BedDouble },
  { label: "Guests", icon: Users },
  { label: "Reservations", icon: CalendarCheck },
];

const money = (amount = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const dateLabel = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    })
  : "—";

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "G";

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [dashboardData, roomData, guestData, reservationData] = await Promise.all([
        fetchDashboard(), fetchRooms(), fetchGuests(), fetchReservations(),
      ]);
      setDashboard(dashboardData);
      setRooms(roomData);
      setGuests(guestData);
      setReservations(reservationData);
    } catch (err) {
      setError(err.message || "Unable to load hotel data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const today = todayISO();
  const checkInsToday = useMemo(
    () => reservations.filter((r) => r.status === "confirmed" && String(r.check_in).slice(0, 10) === today).length,
    [reservations, today],
  );
  const checkOutsToday = useMemo(
    () => reservations.filter((r) => r.status === "confirmed" && String(r.check_out).slice(0, 10) === today).length,
    [reservations, today],
  );

  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const matchesSearch = `${room.room_number} ${room.room_type}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (roomStatusFilter === "all" || room.status === roomStatusFilter);
  }), [rooms, search, roomStatusFilter]);

  const filteredGuests = useMemo(() => guests.filter((guest) =>
    `${guest.name} ${guest.email || ""} ${guest.phone}`.toLowerCase().includes(search.toLowerCase())
  ), [guests, search]);

  const filteredReservations = useMemo(() => reservations.filter((reservation) => {
    const roomText = (reservation.rooms || []).map((room) => room.room_number).join(" ");
    return `${reservation.id} ${reservation.guest?.name || ""} ${reservation.guest?.email || ""} ${roomText} ${reservation.status}`
      .toLowerCase().includes(search.toLowerCase());
  }), [reservations, search]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  async function handleSave(type, values) {
    setSaving(true);
    setError("");
    try {
      if (type === "room") {
        if (modal?.mode === "edit") await updateRoom(modal.item.id, values);
        else await createRoom(values);
        showNotice(modal?.mode === "edit" ? "Room updated successfully." : "Room created successfully.");
      } else if (type === "guest") {
        if (modal?.mode === "edit") await updateGuest(modal.item.id, values);
        else await createGuest(values);
        showNotice(modal?.mode === "edit" ? "Guest updated successfully." : "Guest created successfully.");
      } else if (type === "reservation") {
        await createReservation({
          guest_id: Number(values.guest_id),
          room_ids: values.room_ids.map(Number),
          check_in: values.check_in,
          check_out: values.check_out,
        });
        showNotice("Reservation created successfully.");
      }
      setModal(null);
      setSearch("");
      await loadAll({ quiet: true });
    } catch (err) {
      setError(err.message || "The operation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type, item) {
    const message = type === "room"
      ? `Delete room ${item.room_number}? Rooms with reservation history cannot be deleted.`
      : `Delete guest ${item.name}? Guests with reservation history cannot be deleted.`;
    if (!window.confirm(message)) return;
    setError("");
    try {
      if (type === "room") await deleteRoom(item.id);
      else await deleteGuest(item.id);
      showNotice(`${type === "room" ? "Room" : "Guest"} deleted successfully.`);
      await loadAll({ quiet: true });
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  }

  async function handleCancel(reservation) {
    if (!window.confirm(`Cancel reservation #${reservation.id} for ${reservation.guest?.name || "this guest"}?`)) return;
    setError("");
    try {
      await cancelReservation(reservation.id);
      showNotice(`Reservation #${reservation.id} cancelled.`);
      await loadAll({ quiet: true });
    } catch (err) {
      setError(err.message || "Could not cancel reservation.");
    }
  }

  const openCreate = () => {
    setError("");
    if (activePage === "Rooms") setModal({ type: "room", mode: "create" });
    else if (activePage === "Guests") setModal({ type: "guest", mode: "create" });
    else setModal({ type: "reservation", mode: "create" });
  };

  const pageSubtitle = {
    Dashboard: "Here's what's happening at your property today.",
    Rooms: "Manage room inventory, pricing, and maintenance status.",
    Guests: "Keep guest contact information accurate and up to date.",
    Reservations: "Review stays, create bookings, and cancel reservations.",
  }[activePage];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><BedDouble size={23} /></div>
          <div><h2>Haven<span>.</span></h2><p>HOTEL MANAGEMENT</p></div>
        </div>

        <div className="property-switcher">
          <div className="property-avatar">H</div>
          <div className="property-info"><strong>Haven Grand Hotel</strong><span>Indore, India</span></div>
          <MoreHorizontal size={19} />
        </div>

        <p className="nav-heading">WORKSPACE</p>
        <nav className="navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`}
              onClick={() => { setActivePage(label); setSearch(""); setError(""); }}>
              <Icon size={19} /><span>{label}</span>
              {label === "Reservations" && <span className="nav-count">{reservations.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CheckCircle2 size={20} /></div>
            <strong>Everything in order?</strong>
            <p>Live information from your hotel database.</p>
          </div>
          <div className="profile">
            <div className="profile-avatar">AD</div>
            <div className="profile-info"><strong>Admin User</strong><span>Administrator</span></div>
            <LogOut size={17} className="logout-icon" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="today-label"><Clock size={15} /> {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</div>
            <button className="icon-button" aria-label="Refresh data" onClick={() => loadAll({ quiet: true })}><RefreshCw size={18} className={refreshing ? "spin" : ""} /></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /></button>
            <div className="top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="alert alert-error"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}

          <section className="welcome-row">
            <div>
              <p className="eyebrow">HOTEL OVERVIEW</p>
              <h1>{activePage === "Dashboard" ? "Good evening, Admin" : activePage}</h1>
              <p className="subtitle">{pageSubtitle}</p>
            </div>
            <div className="welcome-actions">
              <button className="secondary-button" onClick={() => loadAll({ quiet: true })}><RefreshCw size={16} /> Refresh</button>
              {activePage !== "Dashboard" && (
                <button className="primary-button" onClick={openCreate}><Plus size={18} /> {activePage === "Rooms" ? "Add Room" : activePage === "Guests" ? "Add Guest" : "New Reservation"}</button>
              )}
              {activePage === "Dashboard" && <button className="primary-button" onClick={() => { setActivePage("Reservations"); setModal({ type: "reservation", mode: "create" }); }}><Plus size={18} /> New Reservation</button>}
            </div>
          </section>

          {loading ? (
            <div className="loading-panel"><LoaderCircle className="spin" size={28} /><strong>Loading hotel data…</strong><span>Connecting to your FastAPI backend</span></div>
          ) : (
            <>
              {activePage === "Dashboard" && (
                <DashboardView dashboard={dashboard} reservations={reservations} checkInsToday={checkInsToday}
                  checkOutsToday={checkOutsToday} setActivePage={setActivePage} search={search}
                  setSearch={setSearch} onCancel={handleCancel} />
              )}
              {activePage === "Rooms" && (
                <RoomsView rooms={filteredRooms} search={search} setSearch={setSearch}
                  statusFilter={roomStatusFilter} setStatusFilter={setRoomStatusFilter}
                  onEdit={(item) => setModal({ type: "room", mode: "edit", item })}
                  onDelete={(item) => handleDelete("room", item)} />
              )}
              {activePage === "Guests" && (
                <GuestsView guests={filteredGuests} search={search} setSearch={setSearch}
                  onEdit={(item) => setModal({ type: "guest", mode: "edit", item })}
                  onDelete={(item) => handleDelete("guest", item)} />
              )}
              {activePage === "Reservations" && (
                <ReservationsView reservations={filteredReservations} search={search} setSearch={setSearch}
                  onCancel={handleCancel} onCreate={() => setModal({ type: "reservation", mode: "create" })} />
              )}
            </>
          )}
          <footer className="page-footer"><span>© {new Date().getFullYear()} Haven Hotel Management</span><span>Frontend A · Connected to FastAPI</span></footer>
        </div>
      </main>

      {modal && <Modal title={modalTitle(modal)} onClose={() => !saving && setModal(null)}>
        {modal.type === "room" && <RoomForm item={modal.item} saving={saving} onSubmit={(values) => handleSave("room", values)} />}
        {modal.type === "guest" && <GuestForm item={modal.item} saving={saving} onSubmit={(values) => handleSave("guest", values)} />}
        {modal.type === "reservation" && <ReservationForm guests={guests} rooms={rooms.filter((room) => room.status === "available")}
          saving={saving} onSubmit={(values) => handleSave("reservation", values)} />}
      </Modal>}
    </div>
  );
}

function DashboardView({ dashboard, reservations, checkInsToday, checkOutsToday, setActivePage, search, setSearch, onCancel }) {
  const occupied = dashboard?.occupied_rooms ?? 0;
  const available = dashboard?.available_rooms ?? 0;
  const maintenance = dashboard?.maintenance_rooms ?? 0;
  const total = dashboard?.total_rooms ?? 0;
  const occupancy = dashboard?.occupancy_percentage ?? 0;
  const upcoming = reservations.filter((r) => r.status === "confirmed" && String(r.check_in).slice(0, 10) >= todayISO()).length;
  const recent = [...reservations].sort((a, b) => b.id - a.id).slice(0, 5);
  const max = Math.max(total, 1);
  const occupiedDeg = occupied / max * 360;
  const availableDeg = available / max * 360;
  const maintenanceDeg = maintenance / max * 360;

  return <>
    <section className="stats-grid">
      <StatCard title="Total Rooms" value={total} note={`${available} available`} icon={BedDouble} tone="blue" />
      <StatCard title="Occupied Rooms" value={occupied} note={`${occupancy}% occupancy`} icon={DoorOpen} tone="purple" />
      <StatCard title="Total Guests" value={dashboard?.total_guests ?? 0} note="Registered guests" icon={Users} tone="orange" />
      <StatCard title="Upcoming Reservations" value={dashboard?.upcoming_reservations ?? 0} note={`${maintenance} rooms under maintenance`} icon={CalendarCheck} tone="green" />
    </section>

    <section className="overview-grid">
      <div className="panel occupancy-panel">
        <div className="panel-heading"><div><h3>Room occupancy</h3><p>Live room status from your database</p></div><button className="subtle-button" onClick={() => setActivePage("Rooms")}>View rooms <ArrowUpRight size={15} /></button></div>
        <div className="occupancy-body">
          <div className="donut-wrap">
            <div className="donut" style={{ background: `conic-gradient(#5b70e8 0deg ${occupiedDeg}deg, #42b995 ${occupiedDeg}deg ${occupiedDeg + availableDeg}deg, #e5a54b ${occupiedDeg + availableDeg}deg ${Math.min(360, occupiedDeg + availableDeg + maintenanceDeg)}deg, #edf0f7 ${Math.min(360, occupiedDeg + availableDeg + maintenanceDeg)}deg 360deg)` }}>
              <div><strong>{occupancy}%</strong><span>Occupied</span></div>
            </div>
          </div>
          <div className="occupancy-legend">
            <Legend color="#5b70e8" label="Occupied" value={`${occupied} rooms`} />
            <Legend color="#42b995" label="Available" value={`${available} rooms`} />
            <Legend color="#e5a54b" label="Maintenance" value={`${maintenance} room${maintenance === 1 ? "" : "s"}`} />
          </div>
        </div>
        <div className="occupancy-footer"><span>{total} total rooms</span><span>Live API data</span></div>
      </div>

      <div className="panel arrivals-panel">
        <div className="panel-heading"><div><h3>Today's activity</h3><p>Based on confirmed reservations</p></div><span className="live-badge"><span /> Live</span></div>
        <ActivityRow icon={ArrowDownRight} tone="checkin" title="Check-ins" subtitle="Reservations arriving today" value={checkInsToday} />
        <ActivityRow icon={ArrowUpRight} tone="checkout" title="Check-outs" subtitle="Reservations departing today" value={checkOutsToday} />
        <ActivityRow icon={CalendarCheck} tone="bookings" title="Upcoming stays" subtitle="Confirmed future bookings" value={upcoming} />
      </div>
    </section>

    <section className="panel reservations-panel">
      <div className="panel-heading reservation-heading">
        <div><h3>Recent reservations</h3><p>Latest bookings from the database</p></div>
        <div className="table-actions">
          <SearchBox value={search} onChange={setSearch} placeholder="Search bookings..." />
          <button className="subtle-button" onClick={() => setActivePage("Reservations")}>View all <ArrowUpRight size={15} /></button>
        </div>
      </div>
      <ReservationsTable reservations={recent.filter((r) => `${r.guest?.name || ""} ${r.id} ${(r.rooms || []).map((room) => room.room_number).join(" ")}`.toLowerCase().includes(search.toLowerCase()))} onCancel={onCancel} compact />
      <div className="table-footer"><span>Showing {Math.min(recent.length, 5)} of {reservations.length} reservations</span><button onClick={() => { setSearch(""); setActivePage("Reservations"); }}>Manage reservations</button></div>
    </section>
  </>;
}

function RoomsView({ rooms, search, setSearch, statusFilter, setStatusFilter, onEdit, onDelete }) {
  return <section className="panel data-panel">
    <div className="panel-heading list-heading"><div><h3>Room inventory</h3><p>{rooms.length} rooms match your filters</p></div><div className="table-actions"><SearchBox value={search} onChange={setSearch} placeholder="Search room or type..." /><select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="available">Available</option><option value="maintenance">Maintenance</option></select></div></div>
    <div className="table-scroll"><table><thead><tr><th>ROOM</th><th>TYPE</th><th>CAPACITY</th><th>PRICE / NIGHT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
      {rooms.map((room) => <tr key={room.id}><td><div className="entity-cell"><div className="entity-icon room-entity"><BedDouble size={17} /></div><div><strong>Room {room.room_number}</strong><span>ID #{room.id}</span></div></div></td><td>{room.room_type}</td><td>{room.capacity} guests</td><td className="amount-cell">{money(room.price_per_night)}</td><td><StatusPill status={room.status} /></td><td><RowActions onEdit={() => onEdit(room)} onDelete={() => onDelete(room)} /></td></tr>)}
      {rooms.length === 0 && <EmptyRow colSpan={6} text="No rooms found for this search." />}
    </tbody></table></div>
  </section>;
}

function GuestsView({ guests, search, setSearch, onEdit, onDelete }) {
  return <section className="panel data-panel">
    <div className="panel-heading list-heading"><div><h3>Guest directory</h3><p>{guests.length} guests match your search</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search name, email, phone..." /></div>
    <div className="table-scroll"><table><thead><tr><th>GUEST</th><th>EMAIL</th><th>PHONE</th><th>ACTIONS</th></tr></thead><tbody>
      {guests.map((guest) => <tr key={guest.id}><td><div className="guest-cell"><div className="guest-avatar">{initials(guest.name)}</div><div><strong>{guest.name}</strong><span>Guest #{guest.id}</span></div></div></td><td>{guest.email || "—"}</td><td>{guest.phone}</td><td><RowActions onEdit={() => onEdit(guest)} onDelete={() => onDelete(guest)} /></td></tr>)}
      {guests.length === 0 && <EmptyRow colSpan={4} text="No guests found for this search." />}
    </tbody></table></div>
  </section>;
}

function ReservationsView({ reservations, search, setSearch, onCancel, onCreate }) {
  return <section className="panel data-panel">
    <div className="panel-heading list-heading"><div><h3>Reservations</h3><p>{reservations.length} bookings match your search</p></div><div className="table-actions"><SearchBox value={search} onChange={setSearch} placeholder="Search guest, room, ID..." /><button className="primary-button" onClick={onCreate}><Plus size={16} /> New Reservation</button></div></div>
    <ReservationsTable reservations={reservations} onCancel={onCancel} />
  </section>;
}

function ReservationsTable({ reservations, onCancel, compact = false }) {
  return <div className="table-scroll"><table><thead><tr><th>GUEST</th><th>ROOMS</th><th>STAY DATES</th><th>TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
    {reservations.map((reservation) => {
      const rooms = reservation.rooms || [];
      const roomText = rooms.map((room) => room.room_number).join(", ") || "—";
      const canCancel = reservation.status === "confirmed";
      return <tr key={reservation.id}>
        <td><div className="guest-cell"><div className="guest-avatar">{initials(reservation.guest?.name)}</div><div><strong>{reservation.guest?.name || "Unknown guest"}</strong><span>RES-{String(reservation.id).padStart(4, "0")}</span></div></div></td>
        <td><span className="room-pill">{roomText}</span></td>
        <td className="date-cell">{dateLabel(reservation.check_in)} – {dateLabel(reservation.check_out)}</td>
        <td className="amount-cell">{money(reservation.total_price)}</td>
        <td><StatusPill status={reservation.status} /></td>
        <td>{canCancel ? <button className="action-button cancel-action" onClick={() => onCancel(reservation)} title="Cancel reservation"><Ban size={16} /><span>Cancel</span></button> : <span className="muted">No actions</span>}</td>
      </tr>;
    })}
    {reservations.length === 0 && <EmptyRow colSpan={6} text={compact ? "No recent reservations match your search." : "No reservations found."} />}
  </tbody></table></div>;
}

function StatCard({ title, value, note, icon: Icon, tone }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}><Icon size={20} /></div></div><strong className="stat-value">{value}</strong><div className="stat-note">{note}</div></div>;
}
function Legend({ color, label, value }) {
  return <div className="legend-row"><span className="legend-dot" style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}
function ActivityRow({ icon: Icon, tone, title, subtitle, value }) {
  return <div className="activity-row"><div className={`activity-icon ${tone}`}><Icon size={20} /></div><div className="activity-copy"><strong>{title}</strong><span>{subtitle}</span></div><strong className="activity-number">{value}</strong></div>;
}
function SearchBox({ value, onChange, placeholder }) {
  return <label className="search-box"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
function StatusPill({ status }) {
  const normalized = String(status || "unknown").toLowerCase().replace(/\s+/g, "-");
  const label = String(status || "Unknown").replace(/^\w/, (c) => c.toUpperCase());
  return <span className={`status-pill status-${normalized}`}><span />{label}</span>;
}
function RowActions({ onEdit, onDelete }) {
  return <div className="row-actions"><button className="action-button" onClick={onEdit} title="Edit"><Pencil size={15} /><span>Edit</span></button><button className="action-button delete-action" onClick={onDelete} title="Delete"><Trash2 size={15} /><span>Delete</span></button></div>;
}
function EmptyRow({ colSpan, text }) {
  return <tr><td colSpan={colSpan} className="empty-state">{text}</td></tr>;
}
function modalTitle(modal) {
  if (modal.type === "room") return modal.mode === "edit" ? "Edit room" : "Add room";
  if (modal.type === "guest") return modal.mode === "edit" ? "Edit guest" : "Add guest";
  return "Create reservation";
}
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("close-modal", close);
    return () => window.removeEventListener("close-modal", close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><p className="eyebrow">HOTEL MANAGEMENT</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}</section></div>;
}
function RoomForm({ item, saving, onSubmit }) {
  const [form, setForm] = useState({ room_number: item?.room_number || "", room_type: item?.room_type || "Standard", price_per_night: item?.price_per_night ?? 1800, capacity: item?.capacity ?? 2, status: item?.status || "available" });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="entity-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, price_per_night: Number(form.price_per_night), capacity: Number(form.capacity) }); }}>
    <label>Room number<input required value={form.room_number} onChange={(e) => change("room_number", e.target.value)} placeholder="e.g. 201" /></label>
    <label>Room type<select value={form.room_type} onChange={(e) => change("room_type", e.target.value)}><option>Standard</option><option>Deluxe</option><option>Suite</option></select></label>
    <div className="form-grid"><label>Price per night (₹)<input required type="number" min="1" value={form.price_per_night} onChange={(e) => change("price_per_night", e.target.value)} /></label><label>Capacity<input required type="number" min="1" value={form.capacity} onChange={(e) => change("capacity", e.target.value)} /></label></div>
    <label>Status<select value={form.status} onChange={(e) => change("status", e.target.value)}><option value="available">Available</option><option value="maintenance">Maintenance</option></select></label>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => window.dispatchEvent(new Event("close-modal"))}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save room"}</button></div>
  </form>;
}
function GuestForm({ item, saving, onSubmit }) {
  const [form, setForm] = useState({ name: item?.name || "", email: item?.email || "", phone: item?.phone || "" });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="entity-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, email: form.email.trim() || null }); }}>
    <label>Full name<input required value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="Guest name" /></label>
    <label>Email address<input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} placeholder="guest@example.com" /></label>
    <label>Phone number<input required value={form.phone} onChange={(e) => change("phone", e.target.value)} placeholder="Phone number" /></label>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => window.dispatchEvent(new Event("close-modal"))}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save guest"}</button></div>
  </form>;
}
function ReservationForm({ guests, rooms, saving, onSubmit }) {
  const [form, setForm] = useState({ guest_id: guests[0]?.id || "", room_ids: [], check_in: todayISO(), check_out: "" });
  const [formError, setFormError] = useState("");
  useEffect(() => { if (!form.guest_id && guests.length) setForm((current) => ({ ...current, guest_id: guests[0].id })); }, [guests, form.guest_id]);
  const toggleRoom = (id) => setForm((current) => ({ ...current, room_ids: current.room_ids.includes(id) ? current.room_ids.filter((roomId) => roomId !== id) : [...current.room_ids, id] }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.room_ids.length) { setFormError("Select at least one room."); return; }
    if (!form.check_out || form.check_out <= form.check_in) { setFormError("Check-out must be after check-in."); return; }
    setFormError("");
    onSubmit(form);
  };
  return <form className="entity-form" onSubmit={submit}>
    <label>Guest<select required value={form.guest_id} onChange={(e) => setForm((current) => ({ ...current, guest_id: e.target.value }))}>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name} · #{guest.id}</option>)}</select></label>
    <div className="form-grid"><label>Check-in<input required type="date" min={todayISO()} value={form.check_in} onChange={(e) => setForm((current) => ({ ...current, check_in: e.target.value }))} /></label><label>Check-out<input required type="date" min={form.check_in || todayISO()} value={form.check_out} onChange={(e) => setForm((current) => ({ ...current, check_out: e.target.value }))} /></label></div>
    <div><div className="field-heading"><span>Select rooms</span><small>{form.room_ids.length} selected</small></div><div className="room-picker">{rooms.map((room) => <label key={room.id} className={`room-option ${form.room_ids.includes(room.id) ? "selected" : ""}`}><input type="checkbox" checked={form.room_ids.includes(room.id)} onChange={() => toggleRoom(room.id)} /><span><strong>Room {room.room_number}</strong><small>{room.room_type} · {room.capacity} guests</small></span><b>{money(room.price_per_night)}<small>/night</small></b></label>)}{rooms.length === 0 && <p className="muted">No rooms are currently marked available.</p>}</div></div>
    {formError && <p className="form-error">{formError}</p>}
    <p className="form-hint">The API checks room availability for the selected dates. Conflicts will be shown as an error.</p>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => window.dispatchEvent(new Event("close-modal"))}>Cancel</button><button className="primary-button" disabled={saving || !guests.length || !rooms.length}>{saving ? "Creating…" : "Create reservation"}</button></div>
  </form>;
}

export default App;
